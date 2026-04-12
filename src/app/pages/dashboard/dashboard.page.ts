import { Component, Input, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { PopoverController, ToastController } from '@ionic/angular';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { DashboardService } from 'src/app/services/dashboard.service';
import { NotificationService } from 'src/app/services/notification.service';

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

  unreadCount   = 0;
  notifications: any[] = [];

  @ViewChild('lineChartRef')  lineChartRef?:  BaseChartDirective;
  @ViewChild('donutChartRef') donutChartRef?: BaseChartDirective;
 @Input() profileInitial?: string;
 @Input() profileRole?: string;
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

  // ─── Weekly Line Chart ─────────────────────────────────────────
  weekLabel          = '';
  private weekOffset = 0;

  lineChartType: ChartConfiguration<'line'>['type'] = 'line';

lineChartData: ChartData<'line'> = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [{
    data: [0, 0, 0, 0, 0, 0, 0],
    label: 'Patients',

    borderColor: '#16a34a',              // main green line
    backgroundColor: 'rgba(34,197,94,0.18)', // light green fill

    pointBackgroundColor: '#22c55e',     // green points
    pointBorderColor: '#ffffff',
    pointBorderWidth: 2,

    pointRadius: 5,
    pointHoverRadius: 7,

    borderWidth: 2,
    tension: 0.4,
    fill: true,
  }],
};

lineChartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },

  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: { label: (ctx) => ` ${ctx.parsed.y} patients` },
    },
  },

  scales: {
    x: {
      grid: { display: false },
      ticks: {
        color: '#16a34a', // 🔥 green text
        font: { size: 12 },
        padding: 4,
      },
      border: { display: false },
    },

    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(34,197,94,0.15)', // 🔥 light green grid
      },
      ticks: {
        color: '#16a34a', // 🔥 green text
        font: { size: 11 },
        maxTicksLimit: 5,
        padding: 8,
        callback: (v) => v + '%', // same rakha as per tera code
      },
      border: { display: false },
    },
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
    private api:         DashboardService,
    private toastCtrl:   ToastController,
    private router:      Router,
    private popoverCtrl: PopoverController,
    private notificationService: NotificationService,
  ) {}

  // ─── Lifecycle ───────────────────────────────────────────────
greetingText: string = '';
  ngOnInit(

  ) { this.loadNotifications(); this.setGreeting(); }

  async loadNotifications() {
    const res: any = await this.notificationService.getNotifications().toPromise();
    this.notifications = res || [];
    this.unreadCount   = this.notifications.filter(n => !n.isRead).length;
  }

  openNotifications() { this.router.navigate(['/notifications']); }

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
        weekly:       this.api.getWeeklyOverview(this.weekOffset).pipe(catchError(() => of(null))),
      })
      .pipe(finalize(() => { this.isLoading = false; resolve(); }))
      .subscribe(async ({ appointments, stats, weekly }) => {

        const todayISO = this.todayISO_Local();
        const mapped   = this.mapRows(this.extractList(appointments)).filter((r) =>
          this.toISODate_LocalSafe(r.raw?.appointmentDate) === todayISO);

        this.rows = mapped.sort((a, b) => (a.timeText || '').localeCompare(b.timeText || ''));
        this.cards = this.buildCards(this.rows);

        this.recomputeVisible();
        this.refreshDoughnut();
        this.refreshLineChart(weekly);

        if (!appointments) await this.toast('Failed to load today\'s appointments.');
      });
    });
  }

  // ─── Week navigation ─────────────────────────────────────────

  prevWeek() { this.weekOffset--; this.loadWeekOnly(); }
  nextWeek() { this.weekOffset++; this.loadWeekOnly(); }

  private loadWeekOnly() {
    this.api.getWeeklyOverview(this.weekOffset)
      .pipe(catchError(() => of(null)))
      .subscribe((w) => this.refreshLineChart(w));
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

  private refreshLineChart(raw: any) {
    const today  = new Date();
    const monday = this.getMonday(today, this.weekOffset);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    this.weekLabel = `${this.fmtShort(monday)} – ${this.fmtShort(sunday)}`;

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return { iso: this.toLocalISO(d), count: 0 };
    });

    console.log('[DASH][WEEKLY] raw:', JSON.stringify(raw));

    const list: any[] = Array.isArray(raw) ? raw
      : (raw?.data ?? raw?.items ?? raw?.result ?? raw?.weeklyData ?? raw?.overview ?? raw?.appointments ?? []);

    for (const item of list) {
      const iso  = this.toISODate_LocalSafe(item?.date ?? item?.appointmentDate ?? item?.day);
      const slot = days.find(d => d.iso === iso);
      if (slot) slot.count = Number(item?.count ?? item?.total ?? item?.patients ?? 0);
    }

    this.lineChartData = {
      labels:   ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        ...this.lineChartData.datasets[0],
        data: days.map(d => d.count),
      }],
    };
    this.lineChartRef?.update();
  }

  /** Percentage helper for legend */
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
    this.search            = '';
    this.lastAppliedSearch = '';
    this.activeCard        = 'today';
    this.recomputeVisible();
  }

  // ─── Navigation ──────────────────────────────────────────────

  openPatient(row: AppointmentRow) {
    if (!row?.patientId) return;

    const role  = (localStorage.getItem('mhc_role') || '').trim().toLowerCase();
    let route   = '/patients/prelim';
    let tab     = 'prelim';

    // Doctor always goes to medical tab
    if (role === 'doctor') {
      route = '/patients/medical';
      tab = 'medical';
    }
    // Receptionist routing based on status
    else if (role === 'receptionist') {
      if (Number(row.statusCode) === AppointmentStatus.AwaitingPayment) {
        route = '/patients/payment';
        tab = 'payment';
      } else if (Number(row.statusCode) === AppointmentStatus.InPatient) {
        route = '/patients/prelim';
        tab = 'prelim';
      }
    }

    this.router.navigate([route], {
      queryParams: { patientId: row.patientId, appointmentId: row.appointmentId, from: 'dashboard', tab },
    });
  }

  // ─── Popover / actions ───────────────────────────────────────

  openActions(ev: any, row: AppointmentRow) {
    ev?.stopPropagation();
    this.selectedRow = row;
    this.actionEvent = ev;
    this.actionOpen  = true;
  }

  closeActions() {
    this.actionOpen  = false;
    this.actionEvent = null;
    this.selectedRow = null;
  }

  allowedNextStatuses(row: AppointmentRow): number[] {
    const s = row?.statusCode;
    if (s === AppointmentStatus.Pending)   return [AppointmentStatus.InPatient, AppointmentStatus.Cancelled];
    if (s === AppointmentStatus.InPatient) return [AppointmentStatus.OutPatient, AppointmentStatus.Cancelled];
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
    const map: Record<Exclude<CardFilterKey, 'today'>, number> = {
      pending:        AppointmentStatus.Pending,
      inPatient:      AppointmentStatus.InPatient,
      awaitingPayment:AppointmentStatus.AwaitingPayment,
      outPatient:     AppointmentStatus.OutPatient,
      cancelled:      AppointmentStatus.Cancelled,
    };
    return list.filter(r => Number(r.statusCode) === map[key as Exclude<CardFilterKey, 'today'>]);
  }

  private applySearchOnList(list: AppointmentRow[], qRaw: string): AppointmentRow[] {
    const q = (qRaw || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(r =>
      (r.pid   || '').toLowerCase().includes(q) ||
      (r.name  || '').toLowerCase().includes(q) ||
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
    if (/^\d+$/.test(s))     return `PID${String(s).padStart(3, '0')}`;
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
                            (patientId ? `PID${String(patientId).padStart(3, '0')}` : '-');
      const name          = String(patient?.fullName ?? x?.fullName ?? x?.patientName ?? 'NA').trim();
      const phone         = String(patient?.phoneNumber ?? x?.phoneNumber ?? x?.mobile ?? '-').trim();
      const timeText      = String(x?.appointmentTimeFormatted ?? '').trim() ||
                            this.timeFromRaw(x?.appointmentTime);
      const statusCode    = this.toNum(x?.status);
      const statusText    = String(x?.statusText ?? '').trim() || this.statusLabel(statusCode);
      return { appointmentId, patientId, pid, name, phone, timeText, statusCode, statusText, raw: x };
    });
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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    if (!s) return '-';
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

  async onLogout() {
    localStorage.clear();
    sessionStorage.clear();
    try { await this.popoverCtrl.dismiss(); } catch {}
    this.router.navigate(['/login']);
  }


// setGreeting() {
//   const hour = new Date().getHours();

//   if (hour < 12) {
//     this.greetingText = 'Good Morning';
//   } else if (hour < 18) {
//     this.greetingText = 'Good Afternoon';
//   } else {
//     this.greetingText = 'Good Evening';
//   }
// }

setGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    this.greetingText = 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    this.greetingText = 'Good Afternoon';
  } else if (hour >= 17 && hour < 21) {
    this.greetingText = 'Good Evening';
  } else {
    this.greetingText = 'Good Night'; // 👈 ye missing tha
  }
}

get userName(): string {
  return localStorage.getItem('mhc_username') || 'Guest User';
}


  get resolvedRole(): string {
    return (
      this.profileRole ||
      localStorage.getItem('mhc_role') ||
      'Doctor'
    );
  }

  get resolvedInitial(): string {
    const name =
      this.profileInitial ||
      localStorage.getItem('mhc_user_name') ||
      this.resolvedRole ||
      'U';

    return name.substring(0, 1).toUpperCase();
  }

}