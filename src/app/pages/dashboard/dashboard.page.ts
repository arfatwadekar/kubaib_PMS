import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { DashboardService } from 'src/app/services/dashboard.service';

export enum AppointmentStatus {
  Pending = 1,
  InPatient = 2,
  AwaitingPayment = 3,
  OutPatient = 4,
  Cancelled = 5,
}

type AppointmentRow = {
  appointmentId: number;
  patientId: number;

  pid: string;
  name: string;
  phone: string;

  timeText: string;

  statusCode: number;
  statusText: string;

  raw: any;
};

type DashboardCards = {
  today: number;
  pending: number;
  inPatient: number;
  awaitingPayment: number;
  outPatient: number;
  cancelled: number;
};

type CardFilterKey =
  | 'today'
  | 'pending'
  | 'inPatient'
  | 'awaitingPayment'
  | 'outPatient'
  | 'cancelled';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage {
  isLoading = false;

  // search UI
  search = '';
  private lastAppliedSearch = '';

  // KPI
  cards: DashboardCards = {
    today: 0,
    pending: 0,
    inPatient: 0,
    awaitingPayment: 0,
    outPatient: 0,
    cancelled: 0,
  };

  // rows
  rows: AppointmentRow[] = [];
  visibleRows: AppointmentRow[] = [];

  // card filter state
  activeCard: CardFilterKey = 'today';

  // popover
  actionOpen = false;
  actionEvent: any = null;
  selectedRow: AppointmentRow | null = null;

  private readonly VALID_STATUS = new Set<number>([
    AppointmentStatus.Pending,
    AppointmentStatus.InPatient,
    AppointmentStatus.AwaitingPayment,
    AppointmentStatus.OutPatient,
    AppointmentStatus.Cancelled,
  ]);

  constructor(
    private api: DashboardService,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  // =========================
  // LIFECYCLE
  // =========================
  ionViewWillEnter() {
    this.loadToday();
  }

  async doRefresh(ev?: any) {
    await this.loadToday(true);
    ev?.target?.complete?.();
  }

  // =========================
  // KPI CLICK -> FILTER TABLE
  // =========================
  onCardClick(key: CardFilterKey) {
    this.activeCard = key;
    this.recomputeVisible();
  }

  // =========================
  // LOAD TODAY
  // =========================
  private loadToday(force = false): Promise<void> {
    if (this.isLoading && !force) return Promise.resolve();
    this.isLoading = true;

    const todayISO = this.todayISO_Local();

    return new Promise((resolve) => {
      this.api
        .getTodayAppointments()
        .pipe(
          catchError(() => of(null)),
          finalize(() => {
            this.isLoading = false;
            resolve();
          })
        )
        .subscribe(async (res) => {
          const list = this.extractList(res);

          // ✅ Strict filter: show only local-today rows
          const mapped = this.mapRows(list).filter((r) => {
            const d = this.toISODate_LocalSafe(r.raw?.appointmentDate);
            return d === todayISO;
          });

          this.rows = mapped.sort((a, b) =>
            (a.timeText || '').localeCompare(b.timeText || '')
          );

          this.cards = this.buildCards(this.rows);
          this.recomputeVisible();

          if (!res) await this.toast('Failed to load today appointments.');
        });
    });
  }

  // =========================
  // SEARCH
  // =========================
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

  // =========================
  // NAV
  // =========================
  openPatient(row: AppointmentRow) {
    if (!row?.patientId) return;

    const role = (localStorage.getItem('mhc_role') || '')
      .trim()
      .toLowerCase();

    this.router.navigate(['/patients'], {
      queryParams: {
        patientId: row.patientId,
        tab: role === 'doctor' ? 'medical' : 'prelim',
      },
    });
  }

  // =========================
  // ACTIONS (Popover)
  // =========================
  openActions(ev: any, row: AppointmentRow) {
    ev?.stopPropagation();
    this.selectedRow = row;
    this.actionEvent = ev;
    this.actionOpen = true;
  }

  closeActions() {
    this.actionOpen = false;
    this.actionEvent = null;
    this.selectedRow = null;
  }

  allowedNextStatuses(row: AppointmentRow): number[] {
    const s = row?.statusCode;

    if (s === AppointmentStatus.Pending) {
      return [AppointmentStatus.InPatient, AppointmentStatus.Cancelled];
    }

    if (s === AppointmentStatus.InPatient) {
      return [AppointmentStatus.AwaitingPayment, AppointmentStatus.Cancelled];
    }

    if (s === AppointmentStatus.AwaitingPayment) {
      return [AppointmentStatus.OutPatient];
    }

    return [];
  }

  async markStatus(nextStatus: number) {
    if (!this.VALID_STATUS.has(nextStatus)) {
      await this.toast(`Invalid status: ${nextStatus}`);
      return;
    }

    const selected = this.selectedRow;
    if (!selected?.appointmentId) {
      await this.toast('No appointment selected');
      return;
    }

    const apptId = selected.appointmentId;
    const row = this.rows.find((x) => x.appointmentId === apptId);

    if (!row) {
      await this.toast('Appointment not found');
      this.closeActions();
      return;
    }

    if (row.statusCode === nextStatus) {
      await this.toast('Already in same status');
      this.closeActions();
      return;
    }

    this.closeActions();
    this.isLoading = true;

    this.api
      .updateStatus(apptId, nextStatus)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: async (updated: any) => {
          const newCode = Number(updated?.status ?? nextStatus);
          row.statusCode = newCode;
          row.statusText = String(
            updated?.statusText || this.statusLabel(newCode)
          );

          this.cards = this.buildCards(this.rows);
          this.recomputeVisible();

          await this.toast('Status updated');
          await this.loadToday(true);
        },
        error: async (err) => {
          await this.toast(
            err?.error?.message ||
              err?.error?.title ||
              err?.message ||
              'Failed to update status'
          );
        },
      });
  }

  // =========================
  // FILTER PIPELINE (CARD + SEARCH)
  // =========================
  private recomputeVisible() {
    let base = [...this.rows];

    base = this.applyCardFilter(base, this.activeCard);
    base = this.applySearchOnList(base, this.lastAppliedSearch);

    this.visibleRows = base;
  }

  private applyCardFilter(list: AppointmentRow[], key: CardFilterKey): AppointmentRow[] {
    if (key === 'today') return list;

    const statusMap: Record<Exclude<CardFilterKey, 'today'>, number> = {
      pending: AppointmentStatus.Pending,
      inPatient: AppointmentStatus.InPatient,
      awaitingPayment: AppointmentStatus.AwaitingPayment,
      outPatient: AppointmentStatus.OutPatient,
      cancelled: AppointmentStatus.Cancelled,
    };

    const wanted = statusMap[key as Exclude<CardFilterKey, 'today'>];
    return list.filter((r) => Number(r.statusCode) === wanted);
  }

  private applySearchOnList(list: AppointmentRow[], qRaw: string): AppointmentRow[] {
    const q = (qRaw || '').trim().toLowerCase();
    if (!q) return list;

    return list.filter((r) => {
      return (
        (r.pid || '').toLowerCase().includes(q) ||
        (r.name || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q)
      );
    });
  }

  // =========================
  // UI HELPERS
  // =========================
  statusLabel(code: number): string {
    if (code === AppointmentStatus.Pending) return 'Pending';
    if (code === AppointmentStatus.InPatient) return 'In Patient';
    if (code === AppointmentStatus.AwaitingPayment) return 'Awaiting Payment';
    if (code === AppointmentStatus.OutPatient) return 'Out Patient';
    if (code === AppointmentStatus.Cancelled) return 'Cancelled';
    return 'Unknown';
  }

  statusPillClass(code: number): string {
    if (code === AppointmentStatus.InPatient) return 'pill pill--blue';
    if (code === AppointmentStatus.OutPatient) return 'pill pill--green';
    if (code === AppointmentStatus.AwaitingPayment) return 'pill pill--amber';
    if (code === AppointmentStatus.Pending) return 'pill pill--gray';
    if (code === AppointmentStatus.Cancelled) return 'pill pill--red';
    return 'pill pill--gray';
  }

  // =========================
  // MAPPING (✅ FIXED PID MISMATCH)
  // =========================
  private extractList(res: any): any[] {
    if (!res) return [];
    if (Array.isArray(res)) return res;

    const candidates = [
      res?.appointments,
      res?.items,
      res?.data,
      res?.result,
      res?.data?.appointments,
      res?.data?.items,
      res?.result?.items,
    ];

    for (const c of candidates) if (Array.isArray(c)) return c;
    return [];
  }

  /** Accepts P-1035 / PID036 / 36 etc */
  private normalizePid(v: any): string {
    const s = String(v ?? '').trim();
    if (!s) return '';

    if (/^p-\d+$/i.test(s)) return s.toUpperCase();   // P-1035
    if (/^pid\d+$/i.test(s)) return s.toUpperCase();  // PID036
    if (/^\d+$/.test(s)) return `PID${String(s).padStart(3, '0')}`;

    return s;
  }

  /**
   * ✅ RULE:
   * - patientId is for navigation
   * - pid is for display and must come from API first (x.pid or x.patient.pid)
   * - fallback only if pid missing
   */
  private mapRows(list: any[]): AppointmentRow[] {
    return (list || []).map((x: any) => {
      const patient = x?.patient ?? {};

      const appointmentId = this.toNum(x?.appointmentId ?? x?.id);

      // ✅ patientId FK for patient page navigation
      const patientId = this.toNum(
        x?.patientId ?? patient?.patientId ?? patient?.patientsId
      );

      // ✅ PID source-of-truth from backend
      const pidRaw =
        x?.pid ??
        x?.patientPid ??
        patient?.pid ??
        patient?.patientPid ??
        patient?.patientCode ??
        x?.patientCode ??
        x?.patientUID ??
        '';

      const pid =
        this.normalizePid(pidRaw) ||
        (patientId ? `PID${String(patientId).padStart(3, '0')}` : '-');

      const name = String(
        patient?.fullName ?? x?.fullName ?? x?.patientName ?? 'NA'
      ).trim();

      const phone = String(
        patient?.phoneNumber ?? x?.phoneNumber ?? x?.mobile ?? '-'
      ).trim();

      const timeText =
        String(x?.appointmentTimeFormatted ?? '').trim() ||
        this.timeFromRaw(x?.appointmentTime);

      const statusCode = this.toNum(x?.status);
      const statusText =
        String(x?.statusText ?? '').trim() || this.statusLabel(statusCode);

      // ✅ DEBUG: see mismatch
      console.log('[DASH][ROW]', {
        appointmentId,
        patientId,
        pidRaw,
        pidShown: pid,
        appointmentDate: x?.appointmentDate,
      });

      return {
        appointmentId,
        patientId,
        pid,
        name,
        phone,
        timeText,
        statusCode,
        statusText,
        raw: x,
      };
    });
  }

  private buildCards(rows: AppointmentRow[]): DashboardCards {
    const c: DashboardCards = {
      today: rows.length,
      pending: 0,
      inPatient: 0,
      awaitingPayment: 0,
      outPatient: 0,
      cancelled: 0,
    };

    for (const r of rows) {
      if (r.statusCode === AppointmentStatus.Pending) c.pending++;
      else if (r.statusCode === AppointmentStatus.InPatient) c.inPatient++;
      else if (r.statusCode === AppointmentStatus.AwaitingPayment) c.awaitingPayment++;
      else if (r.statusCode === AppointmentStatus.OutPatient) c.outPatient++;
      else if (r.statusCode === AppointmentStatus.Cancelled) c.cancelled++;
    }

    return c;
  }

  // =========================
  // DATE/TIME LOCAL SAFE
  // =========================
  private todayISO_Local(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toISODate_LocalSafe(v: any): string {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
    const t = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
    });
    t.present();
  }
}
