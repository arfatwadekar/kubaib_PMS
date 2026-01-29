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

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit {
  loading = false;

  searchText = '';

  rows: ApptRow[] = [];
  filtered: ApptRow[] = [];

  // popover state
  actionOpen = false;
  actionEvent: any = null;
  selectedRow: ApptRow | null = null;

  constructor(
    private apptService: AppointmentService,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
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

    // ✅ Correct API: GET /api/Appointment/today
    this.apptService.getTodayAppointments().subscribe({
      next: (res: any) => {
        const list = this.extractArray(res);
        this.rows = this.normalize(list);
        this.applyFilter();
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

    // Today endpoint returns: { appointments: [...] }
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

      const name = String(patient?.fullName ?? a?.fullName ?? '').trim() || 'NA';
      const phone = String(patient?.phoneNumber ?? a?.phoneNumber ?? '').trim() || '-';

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
