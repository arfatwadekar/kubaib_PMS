import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { firstValueFrom, Observable } from 'rxjs';
import { NotificationService } from 'src/app/services/notification.service';
import {
  SearchAppointmentService,
  ApiAppointment,
  AppointmentStatus,
} from 'src/app/services/search-appointment.service';


/* =========================================================
   TYPES
========================================================= */

type ViewMode = 'today' | 'future' | 'past';

interface UiRow extends ApiAppointment {
  _saving: boolean;
}

/* =========================================================
   COMPONENT
========================================================= */

@Component({
  selector: 'app-search-appointment',
  templateUrl: './search-appointment.page.html',
  styleUrls: ['./search-appointment.page.scss'],
  standalone:false,
})
export class SearchAppointmentPage implements OnInit {

  /* ================= STATE ================= */

  loading = false;
  viewMode: ViewMode = 'today';

  searchText = '';
  statusFilter: number = 0;

  rows: UiRow[] = [];
  filtered: UiRow[] = [];

  /* ================= PAGINATION ================= */

  pageSize = 5;
  currentPage = 1;
  totalPages = 1;
  // ADD THESE:
  apiPage       = 1;
  apiPageSize   = 50;
  apiTotalPages = 0;
  apiTotalCount = 0;
  /* ================= MODAL STATE ================= */

  isEditOpen = false;
  selectedAppointment: any = null;

  /* ================= STATUS OPTIONS ================= */

  statusOptions = [
    { value: 0, label: 'All' },
    { value: AppointmentStatus.Pending, label: 'Pending' },
    { value: AppointmentStatus.InPatient, label: 'In Patient' },
    { value: AppointmentStatus.AwaitingPayment, label: 'Awaiting Payment' },
    { value: AppointmentStatus.OutPatient, label: 'Out Patient' },
    { value: AppointmentStatus.Cancelled, label: 'Cancelled' },
  ];

  constructor(
    private api: SearchAppointmentService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
        private notificationService: NotificationService,
            private router:    Router,
  ) {}

  /* =========================================================
     LIFECYCLE
  ========================================================= */

  ngOnInit(): void {
    this.load();
      this.loadNotifications();
  }

  /* =========================================================
     LOAD DATA
  ========================================================= */

  load(ev?: any) {
    this.loading = true;

    const statusMap: Record<number, string> = {
      1: 'Pending',
      2: 'InPatient',
      3: 'AwaitingPayment',
      4: 'OutPatient',
      5: 'Cancelled',
    };

    const statusParam = this.statusFilter ? statusMap[this.statusFilter] : '';

    this.api.getAppointments(
      this.viewMode,
      this.apiPage,
      this.apiPageSize,
      statusParam,
      this.searchText.trim()
    ).subscribe({
      next: (res) => {
        this.rows = (res?.appointments ?? []).map(a => ({
          ...a,
          _saving: false
        }));

        this.apiTotalPages = res?.totalPages ?? 0;
        this.apiTotalCount = res?.totalCount ?? 0;

        this.currentPage = 1;
        this.applyFilter();

        this.loading = false;
        ev?.target?.complete?.();
      },
      error: () => {
        this.loading = false;
        ev?.target?.complete?.();
        this.toast('Failed to load appointments');
      }
    });
  }

  /* =========================================================
     FILTER + PAGINATION
  ========================================================= */

  applyFilter() {
    const temp = this.rows;

    this.totalPages = Math.ceil(temp.length / this.pageSize) || 1;

    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    this.filtered = temp.slice(start, start + this.pageSize);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyFilter();
    }
  }
// Add this import at the top (already have AppointmentStatus imported ✅)

// Add this method to the class
openPatient(row: UiRow): void {
  const patientId = row.patient?.patientId ?? (row as any).patientId;
  if (!patientId) return;

  const role = localStorage.getItem('mhcrole')?.trim().toLowerCase();
  let route = 'patients/prelim';
  let tab = 'prelim';

  // Doctor → always medical tab
  if (role === 'doctor') {
    route = 'patients/medical';
    tab = 'medical';
  }
  // Receptionist → route based on status
  else if (role === 'receptionist') {
    if (Number(row.status) === AppointmentStatus.AwaitingPayment) {
      route = 'patients/payment';
      tab = 'payment';
    } else {
      route = 'patients/prelim';
      tab = 'prelim';
    }
  }

  this.router.navigate([route], {
    queryParams: {
      patientId: patientId,
      appointmentId: row.appointmentId,
      from: 'dashboard',   // ← same as dashboard so tab-disable logic works
      tab
    }
  });
}
  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyFilter();
    }
  }

  /* =========================================================
     MODAL EDIT
  ========================================================= */

  openEditModal(row: UiRow) {
    // FROM:
    // if (this.viewMode === 'past') return;

    // TO: only block if past AND already cancelled
    if (this.viewMode === 'past' && row.status === 5) return;

    const isPastCancel = this.viewMode === 'past' && row.status !== 5;

    this.selectedAppointment = {
      ...row,
      _dateDraft:      row.appointmentDate?.slice(0, 10),
      _timeDraft:      this.toHHmm(row.appointmentTimeFormatted),
      _remarkDraft:    row.remark ?? '',
      _originalStatus: row.status,
      _isPastCancel:   isPastCancel,
      status:          isPastCancel ? 5 : row.status
    };

    this.isEditOpen = true;
  }
  closeEditModal() {
    this.isEditOpen = false;
    this.selectedAppointment = null;
  }
async saveEdit() {
  if (!this.selectedAppointment) return;

  const row = this.rows.find(r =>
    r.appointmentId === this.selectedAppointment.appointmentId
  );

  if (!row) return;

  // ── Past cancel: only update status, skip appointment update ──────────
  if (this.selectedAppointment._isPastCancel) {
    row._saving = true;
    try {
      await firstValueFrom(
        this.api.updateStatus(row.appointmentId, 5)
      );
      row.status      = 5;
      this.isEditOpen = false;
      this.toast('Appointment cancelled');
      this.load();
    } catch {
      this.toast('Cancel failed');
    } finally {
      row._saving = false;
    }
    return;
  }

  row._saving = true;

  const statusChanged =
    Number(this.selectedAppointment.status) !==
    Number(this.selectedAppointment._originalStatus);

  // ── Build payload — appointmentTime only if user selected it ──────────
  const updatePayload: any = {
    appointmentDate: this.selectedAppointment._dateDraft,
    remark:          this.selectedAppointment._remarkDraft,
  };

  if (this.selectedAppointment._timeDraft) {
    updatePayload.appointmentTime = this.toTimeWithSeconds(this.selectedAppointment._timeDraft);
  }

  this.api.updateAppointment(row.appointmentId, updatePayload).subscribe({
    next: async (updated) => {

      // ── Call status API only if status actually changed ──────────────
      if (statusChanged) {
        try {
          await firstValueFrom(
            this.api.updateStatus(
              row.appointmentId,
              Number(this.selectedAppointment.status)
            )
          );
          row.status = Number(this.selectedAppointment.status);
        } catch {
          this.toast('Status update failed');
        }
      }

      Object.assign(row, updated);

      row._saving     = false;
      this.isEditOpen = false;

      this.toast('Appointment updated');
      this.load();
    },
    error: () => {
      row._saving = false;
      this.toast('Update failed');
    }
  });
}

  /* =========================================================
     STATUS UPDATE
  ========================================================= */

  async confirmStatus(row: UiRow, status: number) {

    if (this.viewMode === 'past') return;
    if (!status || status === row.status) return;

    const label =
      this.statusOptions.find(s => s.value === status)?.label || 'Selected';

    const alert = await this.alertCtrl.create({
      header: 'Change Status',
      message: `Set status to <b>${label}</b>?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: () =>
            this.updateStatus(row, status as AppointmentStatus)
        }
      ]
    });

    await alert.present();
  }

  updateStatus(row: UiRow, status: AppointmentStatus) {

    if (this.viewMode === 'past') return;

    row._saving = true;

    this.api.updateStatus(row.appointmentId, status)
      .subscribe({
        next: (updated) => {

          Object.assign(row, updated);

          row._saving = false;
          this.toast('Status updated');
          this.applyFilter();
        },
        error: () => {
          row._saving = false;
          this.toast('Failed to update status');
        }
      });
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  trackById(_: number, r: UiRow) {
    return r.appointmentId;
  }

  private toHHmm(time?: string): string {
    if (!time) return '';
    const d = new Date(`1970-01-01 ${time}`);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private toTimeWithSeconds(time: string): string {
    return /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  }

  private async toast(msg: string) {
    const t = await this.toastCtrl.create({
      message: msg,
      duration: 1500,
      position: 'bottom',
    });
    await t.present();
  }

  changeTab(mode: ViewMode) {
    this.viewMode     = mode;
    this.apiPage      = 1;
    this.currentPage  = 1;
    this.searchText   = '';
    this.statusFilter = 0;
    this.load();
  }

  onSearchInput() {
    this.apiPage = 1;
    this.load();
  }

  onStatusChange() {
    this.apiPage = 1;
    this.load();
  }

  getStatusClass(status: AppointmentStatus): string {
  switch (status) {
    case AppointmentStatus.Pending:
      return 'pending';

    case AppointmentStatus.InPatient:
      return 'confirmed';

    case AppointmentStatus.AwaitingPayment:
      return 'pending';

    case AppointmentStatus.OutPatient:
      return 'confirmed';

    case AppointmentStatus.Cancelled:
      return 'cancelled';

    default:
      return '';
  }
}
 
  unreadCount = 0;
notifications: any[] = [];
async loadNotifications() {
  const res: any = await this.notificationService.getNotifications().toPromise();

  this.notifications = res || [];

  this.unreadCount = this.notifications.filter(n => !n.isRead).length;
}

openNotifications() {
  this.router.navigate(['/notifications']);
}
}
