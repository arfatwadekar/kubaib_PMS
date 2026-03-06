import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { DashboardService } from 'src/app/services/dashboard.service';

// ─── Enums & Types ───────────────────────────────────────────────────────────

export enum AppointmentStatus {
  Pending         = 1,
  InPatient       = 2,
  AwaitingPayment = 3,
  OutPatient      = 4,
  Cancelled       = 5,
}

type AppointmentRow = {
  appointmentId: number;
  patientId:     number;
  pid:           string;
  name:          string;
  phone:         string;
  timeText:      string;
  statusCode:    number;
  statusText:    string;
  raw:           any;
};

type DashboardCards = {
  today:           number;
  pending:         number;
  inPatient:       number;
  awaitingPayment: number;
  outPatient:      number;
  cancelled:       number;
};

type CardFilterKey =
  | 'today' | 'pending' | 'inPatient'
  | 'awaitingPayment' | 'outPatient' | 'cancelled';

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector:    'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls:   ['./dashboard.page.scss'],
  standalone:  false,
})
export class DashboardPage {

  @ViewChild('barChartRef')   barChartRef?:   BaseChartDirective;
  @ViewChild('donutChartRef') donutChartRef?: BaseChartDirective;

  isLoading = false;

  // Search UI
  search                    = '';
  private lastAppliedSearch = '';

  // KPI cards
  cards: DashboardCards = {
    today: 0, pending: 0, inPatient: 0,
    awaitingPayment: 0, outPatient: 0, cancelled: 0,
  };

  // Table rows
  rows:        AppointmentRow[] = [];
  visibleRows: AppointmentRow[] = [];
  activeCard: CardFilterKey = 'today';

  // Popover
  actionOpen  = false;
  actionEvent: any = null;
  selectedRow: AppointmentRow | null = null;

  // ─── Weekly Bar Chart ──────────────────────────────────────────
  weekLabel         = '';
  private weekOffset = 0;

  barChartType: ChartConfiguration<'bar'>['type'] = 'bar';

  barChartData: ChartData<'bar'> = {
    labels:   ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      data:            [0, 0, 0, 0, 0, 0, 0],
      label:           'Patients',
      backgroundColor: Array(7).fill('#BFDBFE'),
      hoverBackgroundColor: Array(7).fill('#3B82F6'),
      borderRadius:    6,
      borderSkipped:   false,
    }],
  };

  barChartOptions: ChartOptions<'bar'> = {
    responsive:          true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => ` ${ctx.parsed.y} patients` },
      },
    },
    scales: {
      x: {
        grid:  { display: false },
        ticks: { color: '#94a3b8', font: { size: 12 } },
      },
      y: { display: false, beginAtZero: true },
    },
  };

  // ─── Doughnut Chart ───────────────────────────────────────────
  doughnutChartType: ChartConfiguration<'doughnut'>['type'] = 'doughnut';

  doughnutChartData: ChartData<'doughnut'> = {
    labels:   ['Pending', 'In Patient', 'Awaiting Payment', 'Out Patient'],
    datasets: [{
      data:            [0, 0, 0, 0],
      backgroundColor: ['#F97316', '#3B82F6', '#EAB308', '#22C55E'],
      hoverOffset:     4,
      borderWidth:     2,
      borderColor:     '#ffffff',
    }],
  };

  doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive:          true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0) || 1;
            const pct   = Math.round(((ctx.raw as number) / total) * 100);
            return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
          },
        },
      },
    },
  };

  private readonly VALID_STATUS = new Set<number>([
    AppointmentStatus.Pending, AppointmentStatus.InPatient,
    AppointmentStatus.AwaitingPayment, AppointmentStatus.OutPatient,
    AppointmentStatus.Cancelled,
  ]);

  constructor(
    private api:       DashboardService,
    private toastCtrl: ToastController,
    private router:    Router,
  ) {}

  // ─── Lifecycle ───────────────────────────────────────────────

  ionViewWillEnter() {
    this.weekOffset = 0;
    this.loadAll();
  }

  async doRefresh(ev?: any) {
    await this.loadAll(true);
    ev?.target?.complete?.();
  }

  // ─── Load everything in parallel ─────────────────────────────

  private loadAll(force = false): Promise<void> {
    if (this.isLoading && !force) return Promise.resolve();
    this.isLoading = true;

    return new Promise((resolve) => {
      forkJoin({
        appointments: this.api.getTodayAppointments().pipe(catchError(() => of(null))),
        stats:        this.api.getDashboardStats().pipe(catchError(() => of(null))),
        weekly:       this.api.getWeeklyOverview().pipe(catchError(() => of(null))),
      })
      .pipe(finalize(() => { this.isLoading = false; resolve(); }))
      .subscribe(async ({ appointments, stats, weekly }) => {

        // 1. Rows
        const todayISO = this.todayISO_Local();
        const mapped   = this.mapRows(this.extractList(appointments)).filter((r) =>
          this.toISODate_LocalSafe(r.raw?.appointmentDate) === todayISO);

        this.rows = mapped.sort((a, b) => (a.timeText || '').localeCompare(b.timeText || ''));

        // 2. KPI — always build from rows (source of truth for today's filtered list)
        // Use stats API for individual counts if available, but recompute 'today' from rows
        const rowCards  = this.buildCards(this.rows);
        const statsCards = stats ? this.buildCardsFromStats(stats) : null;

        // ✅ Always use row counts only — rows are already filtered to today's local date.
        // The stats API may include cancelled appointments or other dates, causing mismatch.
        this.cards = rowCards;

        this.recomputeVisible();

        // 3. Charts
        this.refreshDoughnut();
        this.refreshBarChart(weekly);

        if (!appointments) await this.toast('Failed to load today\'s appointments.');
      });
    });
  }

  // ─── Week navigation ─────────────────────────────────────────

  prevWeek() { this.weekOffset--; this.loadWeekOnly(); }
  nextWeek() { this.weekOffset++; this.loadWeekOnly(); }

  private loadWeekOnly() {
    this.api.getWeeklyOverview()
      .pipe(catchError(() => of(null)))
      .subscribe((w) => this.refreshBarChart(w));
  }

  // ─── Chart updaters ──────────────────────────────────────────

  private refreshDoughnut() {
    this.doughnutChartData = {
      ...this.doughnutChartData,
      datasets: [{
        ...this.doughnutChartData.datasets[0],
        data: [
          this.cards.pending,
          this.cards.inPatient,
          this.cards.awaitingPayment,
          this.cards.outPatient,
        ],
      }],
    };
    this.donutChartRef?.update();
  }

  private refreshBarChart(raw: any) {
    const today  = new Date();
    const monday = this.getMonday(today, this.weekOffset);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    this.weekLabel = `${this.fmtShort(monday)} – ${this.fmtShort(sunday)}`;

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return { iso: this.toLocalISO(d), count: 0, isToday: this.toLocalISO(d) === this.todayISO_Local() };
    });

    // Debug: log raw weekly shape
    console.log('[DASH][WEEKLY] raw:', JSON.stringify(raw));

    const list: any[] = Array.isArray(raw) ? raw
      : (raw?.data ?? raw?.items ?? raw?.result ?? raw?.weeklyData ?? raw?.overview ?? raw?.appointments ?? []);

    for (const item of list) {
      const iso  = this.toISODate_LocalSafe(item?.date ?? item?.appointmentDate ?? item?.day);
      const slot = days.find(d => d.iso === iso);
      if (slot) slot.count = Number(item?.count ?? item?.total ?? item?.patients ?? 0);
    }

    this.barChartData = {
      labels:   ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        data:                days.map(d => d.count),
        label:               'Patients',
        backgroundColor:     days.map(d => d.isToday ? '#3B82F6' : '#BFDBFE'),
        hoverBackgroundColor:days.map(d => d.isToday ? '#2563EB' : '#93C5FD'),
        borderRadius:        6,
        borderSkipped:       false,
      }],
    };
    this.barChartRef?.update();
  }

  /** Percentage helper for legend labels */
  pct(n: number): string {
    if (!this.cards.today) return '0%';
    return Math.round((n / this.cards.today) * 100) + '%';
  }

  // ─── KPI click ───────────────────────────────────────────────

  onCardClick(key: CardFilterKey) {
    this.activeCard = key;
    this.recomputeVisible();
  }

  // ─── Search ──────────────────────────────────────────────────

  onSearchClick() {
    this.lastAppliedSearch = (this.search || '').trim();
    this.recomputeVisible();
  }

  onClearClick() {
    this.search = '';
    this.lastAppliedSearch = '';
    this.activeCard = 'today';
    this.recomputeVisible();
  }

  // ─── Navigation ──────────────────────────────────────────────

  // openPatient(row: AppointmentRow) {
  //   if (!row?.patientId) return;
  //   const role = (localStorage.getItem('mhc_role') || '').trim().toLowerCase();
  //   const tab  = role === 'doctor'
  //     ? (row.statusCode === AppointmentStatus.AwaitingPayment ? 'payment' : 'medical')
  //     : 'prelim';
  //   this.router.navigate(['/patients'], { queryParams: { patientId: row.patientId, tab } });
  // }

openPatient(row: AppointmentRow) {
  if (!row?.patientId) return;

  const role = (localStorage.getItem('mhc_role') || '').trim().toLowerCase();

  let tab: string;

  if (role === 'doctor') {
    tab = 'medical';   // ✅ Doctor → Medical
  } else {
    tab = 'payment';   // ✅ Receptionist → Payment
  }

  this.router.navigate(['/patients'], {
    queryParams: {
      patientId: row.patientId,
      tab,
      from: 'dashboard'   // 🔥 important flag
    }
  });
}
  // ─── Popover / actions ───────────────────────────────────────

  openActions(ev: any, row: AppointmentRow) {
    ev?.stopPropagation();
    this.selectedRow  = row;
    this.actionEvent  = ev;
    this.actionOpen   = true;
  }

  closeActions() {
    this.actionOpen  = false;
    this.actionEvent = null;
    this.selectedRow = null;
  }

  allowedNextStatuses(row: AppointmentRow): number[] {
    const s = row?.statusCode;
    if (s === AppointmentStatus.Pending)
      return [AppointmentStatus.InPatient, AppointmentStatus.Cancelled];
    if (s === AppointmentStatus.InPatient)
      return [AppointmentStatus.AwaitingPayment, AppointmentStatus.Cancelled];
    if (s === AppointmentStatus.AwaitingPayment)
      return [AppointmentStatus.OutPatient];
    return [];
  }

  async markStatus(nextStatus: number) {
    if (!this.VALID_STATUS.has(nextStatus)) { await this.toast(`Invalid status: ${nextStatus}`); return; }
    const selected = this.selectedRow;
    if (!selected?.appointmentId) { await this.toast('No appointment selected'); return; }

    const apptId = selected.appointmentId;
    const row    = this.rows.find(x => x.appointmentId === apptId);
    if (!row) { await this.toast('Appointment not found'); this.closeActions(); return; }
    if (row.statusCode === nextStatus) { await this.toast('Already in same status'); this.closeActions(); return; }

    this.closeActions();
    this.isLoading = true;

    this.api.updateStatus(apptId, nextStatus)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: async (updated: any) => {
          const newCode  = Number(updated?.status ?? nextStatus);
          row.statusCode = newCode;
          row.statusText = String(updated?.statusText || this.statusLabel(newCode));
          this.cards     = this.buildCards(this.rows);
          this.refreshDoughnut();
          this.recomputeVisible();
          await this.toast('Status updated');
          await this.loadAll(true);
        },
        error: async (err) => {
          await this.toast(err?.error?.message ?? err?.error?.title ?? err?.message ?? 'Failed to update status');
        },
      });
  }

  // ─── Filter pipeline ─────────────────────────────────────────

  private recomputeVisible() {
    let base = [...this.rows];
    base = this.applyCardFilter(base, this.activeCard);
    base = this.applySearchOnList(base, this.lastAppliedSearch);
    this.visibleRows = base;
  }

  private applyCardFilter(list: AppointmentRow[], key: CardFilterKey): AppointmentRow[] {
    if (key === 'today') return list;
    const map: Record<Exclude<CardFilterKey,'today'>, number> = {
      pending: AppointmentStatus.Pending, inPatient: AppointmentStatus.InPatient,
      awaitingPayment: AppointmentStatus.AwaitingPayment,
      outPatient: AppointmentStatus.OutPatient, cancelled: AppointmentStatus.Cancelled,
    };
    return list.filter(r => Number(r.statusCode) === map[key as Exclude<CardFilterKey,'today'>]);
  }

  private applySearchOnList(list: AppointmentRow[], qRaw: string): AppointmentRow[] {
    const q = (qRaw || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(r =>
      (r.pid || '').toLowerCase().includes(q) ||
      (r.name || '').toLowerCase().includes(q) ||
      (r.phone || '').toLowerCase().includes(q));
  }

  // ─── UI helpers ──────────────────────────────────────────────

  statusLabel(code: number): string {
    if (code === AppointmentStatus.Pending)         return 'Pending';
    if (code === AppointmentStatus.InPatient)       return 'In Patient';
    if (code === AppointmentStatus.AwaitingPayment) return 'Awaiting Payment';
    if (code === AppointmentStatus.OutPatient)      return 'Out Patient';
    if (code === AppointmentStatus.Cancelled)       return 'Cancelled';
    return 'Unknown';
  }

  statusPillClass(code: number): string {
    if (code === AppointmentStatus.InPatient)       return 'pill pill--blue';
    if (code === AppointmentStatus.OutPatient)      return 'pill pill--green';
    if (code === AppointmentStatus.AwaitingPayment) return 'pill pill--amber';
    if (code === AppointmentStatus.Pending)         return 'pill pill--gray';
    if (code === AppointmentStatus.Cancelled)       return 'pill pill--red';
    return 'pill pill--gray';
  }

  // ─── Data mapping ────────────────────────────────────────────

  private extractList(res: any): any[] {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    for (const c of [res?.appointments, res?.items, res?.data, res?.result,
                     res?.data?.appointments, res?.data?.items, res?.result?.items])
      if (Array.isArray(c)) return c;
    return [];
  }

  private normalizePid(v: any): string {
    const s = String(v ?? '').trim();
    if (!s) return '';
    if (/^p-\d+$/i.test(s))  return s.toUpperCase();
    if (/^pid\d+$/i.test(s)) return s.toUpperCase();
    if (/^\d+$/.test(s))     return `PID${String(s).padStart(3,'0')}`;
    return s;
  }

  private mapRows(list: any[]): AppointmentRow[] {
    return (list || []).map((x: any) => {
      const patient       = x?.patient ?? {};
      const appointmentId = this.toNum(x?.appointmentId ?? x?.id);
      const patientId     = this.toNum(x?.patientId ?? patient?.patientId ?? patient?.patientsId);
      const pidRaw        = x?.pid ?? x?.patientPid ?? patient?.pid ?? patient?.patientPid ??
                            patient?.patientCode ?? x?.patientCode ?? x?.patientUID ?? '';
      const pid           = this.normalizePid(pidRaw) ||
                            (patientId ? `PID${String(patientId).padStart(3,'0')}` : '-');
      const name          = String(patient?.fullName ?? x?.fullName ?? x?.patientName ?? 'NA').trim();
      const phone         = String(patient?.phoneNumber ?? x?.phoneNumber ?? x?.mobile ?? '-').trim();
      const timeText      = String(x?.appointmentTimeFormatted ?? '').trim() ||
                            this.timeFromRaw(x?.appointmentTime);
      const statusCode    = this.toNum(x?.status);
      const statusText    = String(x?.statusText ?? '').trim() || this.statusLabel(statusCode);
      return { appointmentId, patientId, pid, name, phone, timeText, statusCode, statusText, raw: x };
    });
  }

  private buildCardsFromStats(stats: any): DashboardCards {
    // Debug: log raw stats shape to find exact field names from your API
    console.log('[DASH][STATS] raw:', JSON.stringify(stats));
    return {
      today:           this.toNum(stats?.todayAppointments ?? stats?.todayCount ?? stats?.today ?? stats?.total ?? stats?.totalAppointments),
      pending:         this.toNum(stats?.pending           ?? stats?.pendingCount ?? stats?.pendingAppointments),
      inPatient:       this.toNum(stats?.inPatient         ?? stats?.inPatientCount ?? stats?.in_patient ?? stats?.inpatient),
      awaitingPayment: this.toNum(stats?.awaitingPayment   ?? stats?.awaitingPaymentCount ?? stats?.awaiting_payment),
      outPatient:      this.toNum(stats?.outPatient        ?? stats?.outPatientCount ?? stats?.out_patient ?? stats?.outpatient),
      cancelled:       this.toNum(stats?.cancelled         ?? stats?.cancelledCount ?? stats?.canceled),
    };
  }

  private buildCards(rows: AppointmentRow[]): DashboardCards {
    const c: DashboardCards = {
      today: rows.length, pending: 0, inPatient: 0,
      awaitingPayment: 0, outPatient: 0, cancelled: 0,
    };
    for (const r of rows) {
      if      (r.statusCode === AppointmentStatus.Pending)         c.pending++;
      else if (r.statusCode === AppointmentStatus.InPatient)       c.inPatient++;
      else if (r.statusCode === AppointmentStatus.AwaitingPayment) c.awaitingPayment++;
      else if (r.statusCode === AppointmentStatus.OutPatient)      c.outPatient++;
      else if (r.statusCode === AppointmentStatus.Cancelled)       c.cancelled++;
    }
    return c;
  }

  // ─── Date helpers ─────────────────────────────────────────────

  private todayISO_Local() { return this.toLocalISO(new Date()); }

  private toLocalISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  private toISODate_LocalSafe(v: any): string {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : this.toLocalISO(d);
  }

  private getMonday(from: Date, offset: number): Date {
    const d   = new Date(from);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private fmtShort(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private timeFromRaw(v: any): string {
    const s = String(v ?? '').trim();
    if (!s)              return '-';
    if (s.includes(':')) return s.slice(0, 5);
    return s;
  }

  private toNum(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2500, position: 'top' });
    t.present();
  }

  onEditProfile() {
  console.log('Navigate to profile page');
}

onLogout() {
  localStorage.clear();
  console.log('Navigate to login');
}
}