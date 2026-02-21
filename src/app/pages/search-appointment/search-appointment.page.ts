import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import {
  SearchAppointmentService,
  ApiAppointment,
  AppointmentStatus,
} from 'src/app/services/search-appointment.service';

type ViewMode = 'queue' | 'today';

interface UiRow extends ApiAppointment {
  _editing: boolean;
  _saving: boolean;
  _remarkDraft: string;
  _dateDraft: string;
  _timeDraft: string;
}

@Component({
  selector: 'app-search-appointment',
  templateUrl: './search-appointment.page.html',
  styleUrls: ['./search-appointment.page.scss'],
  standalone:false
})
export class SearchAppointmentPage implements OnInit {

  loading = false;
  viewMode: ViewMode = 'queue';

  searchText = '';
  statusFilter: number = 0;

  rows: UiRow[] = [];
  filtered: UiRow[] = [];

  AppointmentStatus = AppointmentStatus;

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
    private alertCtrl: AlertController
  ) {}

  ngOnInit(): void {
    this.load();
  }

  onSegmentChange(event: CustomEvent) {
    const value = event?.detail?.value;
    if (value === 'queue' || value === 'today') {
      this.viewMode = value;
      this.statusFilter = 0;
      this.load();
    }
  }

  load(ev?: any) {
    this.loading = true;

    const req$ =
      this.viewMode === 'today'
        ? this.api.getToday()
        : this.api.getQueue();

    req$.subscribe({
      next: (res) => {
        const list = res?.appointments ?? [];
        this.rows = list.map(a => this.mapToUiRow(a));
        this.applyFilter();
        this.loading = false;
        ev?.target?.complete?.();
      },
      error: () => {
        this.loading = false;
        ev?.target?.complete?.();
        this.toast('Failed to load appointments');
      },
    });
  }

  private mapToUiRow(a: ApiAppointment): UiRow {
    return {
      ...a,
      _editing: false,
      _saving: false,
      _remarkDraft: a.remark || '',
      _dateDraft: a.appointmentDate?.slice(0, 10) || '',
      _timeDraft: this.toHHmm(a.appointmentTimeFormatted),
    };
  }

  applyFilter() {
    const q = this.searchText.trim().toLowerCase();

    this.filtered = this.rows.filter(r => {
      const matchText =
        !q ||
        r.patient?.fullName?.toLowerCase().includes(q) ||
        r.patient?.phoneNumber?.includes(q) ||
        r.patient?.patientIdFormatted?.toLowerCase().includes(q);

      const matchStatus =
        this.statusFilter === 0 || r.status === this.statusFilter;

      return matchText && matchStatus;
    });
  }

  openEdit(row: UiRow) {
    row._editing = true;
  }

  closeEdit(row: UiRow) {
    row._editing = false;
    row._remarkDraft = row.remark || '';
    row._dateDraft = row.appointmentDate?.slice(0, 10) || '';
    row._timeDraft = this.toHHmm(row.appointmentTimeFormatted);
  }

  saveEdit(row: UiRow) {
    if (row._saving) return;

    row._saving = true;

    this.api.updateAppointment(row.appointmentId, {
      appointmentDate: row._dateDraft,
      appointmentTime: row._timeDraft + ':00',
      remark: row._remarkDraft,
    }).subscribe({
      next: (updated) => {
        Object.assign(row, this.mapToUiRow(updated));
        row._saving = false;
        row._editing = false;
        this.toast('Appointment updated');
      },
      error: () => {
        row._saving = false;
        this.toast('Update failed');
      },
    });
  }

  async confirmStatus(row: UiRow, status: AppointmentStatus) {
    if (!status || status === row.status) return;

    const alert = await this.alertCtrl.create({
      header: 'Change Status',
      message: 'Are you sure?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: () => this.updateStatus(row, status),
        },
      ],
    });

    await alert.present();
  }

  updateStatus(row: UiRow, status: AppointmentStatus) {
    row._saving = true;

    this.api.updateStatus(row.appointmentId, status).subscribe({
      next: () => {
        row._saving = false;
        this.load();
      },
      error: () => {
        row._saving = false;
        this.toast('Failed to update status');
      },
    });
  }

  statusColor(status: AppointmentStatus): string {
    switch (status) {
      case AppointmentStatus.Pending: return 'warning';
      case AppointmentStatus.InPatient: return 'primary';
      case AppointmentStatus.AwaitingPayment: return 'tertiary';
      case AppointmentStatus.OutPatient: return 'success';
      case AppointmentStatus.Cancelled: return 'danger';
      default: return 'medium';
    }
  }

  trackById(_: number, r: UiRow) {
    return r.appointmentId;
  }

  private toHHmm(time?: string): string {
    if (!time) return '';
    const d = new Date(`1970-01-01T${time}`);
    return isNaN(d.getTime())
      ? ''
      : `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  private async toast(msg: string) {
    const t = await this.toastCtrl.create({
      message: msg,
      duration: 1500,
    });
    await t.present();
  }
}