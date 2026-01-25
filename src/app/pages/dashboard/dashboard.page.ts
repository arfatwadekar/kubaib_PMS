import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { PatientService, PatientDto } from 'src/app/services/patient.service';

export type ApptStatus = 'TODAYS_APPOINTMENT' | 'PENDING_CONSULTATION' | 'IN_PATIENT';

type Row = PatientDto & {
  _pid: string;
  _name: string;
  _phone: string;

  // UI-only fields (until appointment API)
  apptTime: string;
  status: ApptStatus;
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit {
  loading = false;

  page = 1;
  pageSize = 10;

  searchText = '';

  rows: Row[] = [];
  filtered: Row[] = [];

  // popover state
  actionOpen = false;
  actionEvent: any = null;
  selectedRow: Row | null = null;

  constructor(
    private patientService: PatientService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.load();
  }

  // ---------- UI text/classes ----------
  pillLabel(s: ApptStatus) {
    if (s === 'TODAYS_APPOINTMENT') return "Today's Appointment";
    if (s === 'PENDING_CONSULTATION') return 'Pending Consultation';
    return 'Out Patient'; // screenshot second row shows Out Patient (use IN_PATIENT if you want)
  }

  pillClass(s: ApptStatus) {
    if (s === 'TODAYS_APPOINTMENT') return 'today';
    if (s === 'PENDING_CONSULTATION') return 'pending';
    return 'inp';
  }

  // ---------- normalization ----------
  private normalize(list: PatientDto[]): Row[] {
    return (list || []).map((p: any, idx) => {
      const pid = (p.patientId || p.patientID || p.pid || '').toString();
      const name = `${(p.firstName || '').trim()} ${(p.lastName || '').trim()}`.trim();
      const phone = (p.phoneNumber || '').toString();

      // UI-only (until appointment API)
      const apptTime = idx % 2 === 0 ? '09:00 AM' : '09:30 AM';
      const status: ApptStatus =
        idx % 2 === 0 ? 'TODAYS_APPOINTMENT' : 'IN_PATIENT';

      return {
        ...p,
        _pid: pid || '-',
        _name: name || 'NA',
        _phone: phone || '-',
        apptTime,
        status,
      };
    });
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

  // ---------- load ----------
  load() {
    this.loading = true;

    this.patientService.getPatients(this.page, this.pageSize).subscribe({
      next: (res: any) => {
        const list: PatientDto[] =
          res?.data || res?.items || res?.patients || (Array.isArray(res) ? res : []);

        this.rows = this.normalize(list);
        this.applyFilter();
      },
      error: async (err) => {
        const t = await this.toastCtrl.create({
          message: err?.error?.message || err?.message || 'Failed to load patients',
          duration: 2500,
          position: 'top',
        });
        t.present();
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }

  refresh() {
    this.page = 1;
    this.load();
  }

  // ---------- Actions dropdown ----------
  openActions(ev: any, row: Row) {
    this.selectedRow = row;
    this.actionEvent = ev;
    this.actionOpen = true;
  }

  closeActions() {
    this.actionOpen = false;
    this.actionEvent = null;
    this.selectedRow = null;
  }

  setStatus(status: ApptStatus) {
    if (!this.selectedRow) return;
    this.selectedRow.status = status;
    this.closeActions();
  }
}
