import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AppointmentService } from 'src/app/services/appointment.service';

type ApptStatus = string; // backend gives statusText anyway

type ApptRow = {
  appointmentId: number;
  patientId: number;
  _pid: string;
  _name: string;
  _phone: string;

  apptTime: string;       // "11:45" / "11:45 AM"
  statusText: string;     // "InPatient" etc
  status: ApptStatus;     // optional
  raw: any;
};

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit {
  loading = false;

  page = 1;
  pageSize = 50;

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
    this.loading = true;

    // ✅ Today’s appointments (as your title says)
    const date = todayYmd();

    this.apptService.getAppointments({ date, page: this.page, pageSize: this.pageSize }).subscribe({
      next: (res: any) => {
        const list = this.extractArray(res);
        this.rows = this.normalize(list);
        this.applyFilter();
      },
      error: async (err) => {
        const t = await this.toastCtrl.create({
          message: err?.error?.message || err?.message || 'Failed to load appointments',
          duration: 3000,
          position: 'top',
        });
        t.present();
      },
      complete: () => (this.loading = false),
    });
  }

  refresh() {
    this.page = 1;
    this.load();
  }

  private extractArray(res: any): any[] {
    if (Array.isArray(res)) return res;

    const candidates = [
      res?.items,
      res?.data,
      res?.appointments,
      res?.result,
      res?.data?.items,
      res?.data?.appointments,
      res?.result?.items,
    ];
    for (const c of candidates) if (Array.isArray(c)) return c;

    return [];
  }

  private normalize(list: any[]): ApptRow[] {
    return (list || []).map((a: any) => {
      const apptId = Number(a?.appointmentId ?? a?.id ?? 0) || 0;

      const patient = a?.patient || {};
      const patientId = Number(patient?.patientId ?? a?.patientId ?? 0) || 0;

      const pid = String(patient?.patientIdFormatted ?? a?.patientIdFormatted ?? '').trim();
      const name = String(patient?.fullName ?? a?.fullName ?? '').trim() || 'NA';
      const phone = String(patient?.phoneNumber ?? a?.phoneNumber ?? '').trim() || '-';

      // time
      const timeFormatted = String(a?.appointmentTimeFormatted ?? '').trim(); // "11:45"
      const timeRaw = String(a?.appointmentTime ?? '').trim();               // "11:45:00"
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

  // ---------- actions dropdown (for now UI only) ----------
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

  // Optional: open patient profile
  openPatient(r: ApptRow) {
    // if you have patient profile page:
    this.router.navigate(['/patients/create'], {
      queryParams: { patientId: r.patientId },
    });
  }
}
