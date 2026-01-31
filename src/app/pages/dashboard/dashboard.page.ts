import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AppointmentService } from 'src/app/services/appointment.service';

type ApptStatus = string;

type ApptRow = {
  appointmentId: number;
  patientId: number;

  _pid: string;
  _name: string;
  _phone: string;

  apptTime: string;
  statusText: string;
  status: ApptStatus;

  raw: any;
};

type Kpi = {
  today: number;
  pending: number;
  inPatient: number;
  awaiting: number;
  outPatient: number;
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit {
  loading = false;

  // table search
  searchText = '';

  rows: ApptRow[] = [];
  filtered: ApptRow[] = [];

  // popover state
  actionOpen = false;
  actionEvent: any = null;
  selectedRow: ApptRow | null = null;

  // ✅ Dashboard UI (top cards + charts)
  kpi: Kpi = {
    today: 0,
    pending: 0,
    inPatient: 0,
    awaiting: 0,
    outPatient: 0,
  };

  donutTotal = 0;
  donutAngles = { today: 0, pending: 0, inp: 0, awaiting: 0, out: 0 };

  weekly: Array<{ day: string; value: number; pct: number }> = [];
  weekRangeText = 'Jan 26 - Feb 1';

  constructor(
    private apptService: AppointmentService,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
    this.buildWeekly(); // UI-only demo, replace later with API aggregation if needed
    this.load();
  }

  // ✅ when coming back from patient create page, refresh today list
  ionViewWillEnter() {
    this.load();
  }

  // ---------- UI helpers ----------
  pillLabel(r: ApptRow) {
    return r.statusText || '—';
  }

  pillClass(r: ApptRow) {
    const s = (r.statusText || '').toLowerCase();

    if (s.includes('today')) return 'today';
    if (s.includes('pending')) return 'pending';
    if (s.includes('await')) return 'awaiting';
    if (s.includes('out')) return 'out';
    if (s.includes('inpatient') || s.includes('in patient')) return 'inp';

    return 'neutral';
  }

  // ---------- search ----------
  onSearch() {
    this.applyFilter();
  }

  clearSearch() {
    this.searchText = '';
    this.applyFilter();
  }

  private applyFilter() {
    const q = (this.searchText || '').trim().toLowerCase();
    if (!q) {
      this.filtered = [...this.rows];
      return;
    }

    this.filtered = this.rows.filter((r) => {
      return (
        (r._pid || '').toLowerCase().includes(q) ||
        (r._phone || '').toLowerCase().includes(q) ||
        (r._name || '').toLowerCase().includes(q)
      );
    });
  }

  // ---------- load appointments ----------
  load() {
    if (this.loading) return;
    this.loading = true;

    this.apptService.getTodayAppointments().subscribe({
      next: (res: any) => {
        const list = this.extractArray(res);
        this.rows = this.normalize(list);
        this.applyFilter();

        // ✅ update dashboard stats
        this.computeKpiFromRows();
        this.computeDonut();
      },
      error: async (err) => {
        const t = await this.toastCtrl.create({
          message:
            err?.error?.message ||
            err?.message ||
            'Failed to load appointments',
          duration: 3000,
          position: 'top',
        });
        t.present();
      },
      complete: () => (this.loading = false),
    });
  }

  refresh() {
    this.load();
  }

  private extractArray(res: any): any[] {
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

    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }
    return [];
  }

  private normalize(list: any[]): ApptRow[] {
    return (list || []).map((a: any) => {
      const apptId = Number(a?.appointmentId ?? a?.id ?? 0) || 0;

      const patient = a?.patient || {};
      const patientId = Number(patient?.patientId ?? a?.patientId ?? 0) || 0;

      const pid = String(
        patient?.patientIdFormatted ??
          a?.patientIdFormatted ??
          (patientId ? `P-${patientId}` : '')
      ).trim();

      const name =
        String(patient?.fullName ?? a?.fullName ?? '').trim() || 'NA';
      const phone =
        String(patient?.phoneNumber ?? a?.phoneNumber ?? '').trim() || '-';

      const timeFormatted = String(a?.appointmentTimeFormatted ?? '').trim();
      const timeRaw = String(a?.appointmentTime ?? '').trim();
      const apptTime = timeFormatted || (timeRaw ? timeRaw.slice(0, 5) : '-');

      const statusText = String(a?.statusText ?? '').trim() || '-';

      return {
        appointmentId: apptId,
        patientId,
        _pid: pid || (patientId ? `P-${patientId}` : '-'),
        _name: name,
        _phone: phone,
        apptTime,
        statusText,
        status: String(a?.status ?? ''),
        raw: a,
      };
    });
  }

  // ---------- KPI + Donut (computed from rows) ----------
  private computeKpiFromRows() {
    const counts: Kpi = {
      today: 0,
      pending: 0,
      inPatient: 0,
      awaiting: 0,
      outPatient: 0,
    };

    for (const r of this.rows) {
      const s = (r.statusText || '').toLowerCase();

      if (s.includes('today')) counts.today++;
      else if (s.includes('pending')) counts.pending++;
      else if (s.includes('await')) counts.awaiting++;
      else if (s.includes('out')) counts.outPatient++;
      else if (s.includes('inpatient') || s.includes('in patient'))
        counts.inPatient++;
    }

    this.kpi = counts;
  }

  private computeDonut() {
    const a = this.kpi.today;
    const b = this.kpi.pending;
    const c = this.kpi.inPatient;
    const d = this.kpi.awaiting;
    const e = this.kpi.outPatient;

    const total = a + b + c + d + e;
    this.donutTotal = total;

    if (!total) {
      this.donutAngles = { today: 0, pending: 0, inp: 0, awaiting: 0, out: 0 };
      return;
    }

    const toDeg = (v: number) => Math.round((v / total) * 360);

    const da = toDeg(a);
    const db = toDeg(b);
    const dc = toDeg(c);
    const dd = toDeg(d);

    this.donutAngles = {
      today: da,
      pending: db,
      inp: dc,
      awaiting: dd,
      out: 360 - (da + db + dc + dd), // rounding fix
    };
  }

  // ---------- Weekly (UI-only sample) ----------
  private buildWeekly() {
    // Replace later with grouping your real data by weekday if needed
    const data = [
      { day: 'Mon', value: 6 },
      { day: 'Tue', value: 9 },
      { day: 'Wed', value: 7 },
      { day: 'Thu', value: 10 },
      { day: 'Fri', value: 5 },
      { day: 'Sat', value: 1 },
      { day: 'Sun', value: 2 },
    ];

    const max = Math.max(...data.map((x) => x.value), 1);
    this.weekly = data.map((d) => ({
      ...d,
      pct: Math.round((d.value / max) * 100),
    }));
  }

  // ---------- actions dropdown ----------
  openActions(ev: any, row: ApptRow) {
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

  // ✅ Dashboard row click -> open patient form with prefilled data (edit mode)
  openPatient(r: ApptRow) {
    if (!r?.patientId) return;
    this.router.navigate(['/patients/create'], {
      queryParams: { patientId: r.patientId },
    });
  }
}
