import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import {
  SearchAppointmentService,
  ApiAppointment,
  AppointmentStatus,
} from 'src/app/services/search-appointment.service';

type ViewMode = 'queue' | 'today';

type UiRow = ApiAppointment & {
  _editing?: boolean;
  _saving?: boolean;

  _remarkDraft?: string; // textarea
  _dateDraft?: string;   // YYYY-MM-DD
  _timeDraft?: string;   // HH:mm (from ion-input type="time")
};

function isoToYmd(iso: string): string {
  return (iso || '').slice(0, 10);
}

/** Convert API formatted time -> HH:mm for <ion-input type="time"> */
function toHHmmFromFormatted(formatted?: string): string {
  const s = (formatted || '').trim();
  if (!s) return '';

  // already "HH:mm"
  if (/^\d{2}:\d{2}$/.test(s)) return s;

  // "HH:mm:ss"
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);

  // try parse "11:45 AM" / "1:05 PM"
  const d = new Date(`1970-01-01 ${s}`);
  if (!isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  return '';
}

/** Always returns HH:mm:ss */
function toTimeWithSeconds(time?: string): string {
  const t = (time || '').trim();

  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;

  // fallback
  return '00:00:00';
}

@Component({
  selector: 'app-search-appointment',
  templateUrl: './search-appointment.page.html',
  styleUrls: ['./search-appointment.page.scss'],
  standalone: false,
})
export class SearchAppointmentPage implements OnInit {
  loading = false;
  viewMode: ViewMode = 'queue';

  searchText = '';
  statusFilter = 0; // 0 = All (UI only)

  statusOptions = [
    { value: 0, label: 'All' },
    { value: AppointmentStatus.Pending, label: 'Pending' },
    { value: AppointmentStatus.InPatient, label: 'In Patient' },
    { value: AppointmentStatus.AwaitingPayment, label: 'Awaiting Payment' },
    { value: AppointmentStatus.OutPatient, label: 'Out Patient' },
    { value: AppointmentStatus.Cancelled, label: 'Cancelled' },
  ];

  rows: UiRow[] = [];
  filtered: UiRow[] = [];

  constructor(
    private api: SearchAppointmentService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.load();
  }

  // called from HTML: (ionChange)="onSegmentChange($event)"
  onSegmentChange(event: CustomEvent) {
    const value = (event as any)?.detail?.value;
    if (value === 'today' || value === 'queue') this.setMode(value);
    else this.setMode('queue');
  }

  setMode(mode: ViewMode) {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.load();
  }

  load(ev?: any) {
    this.loading = true;

    const req$ = this.viewMode === 'today'
      ? this.api.getToday()
      : this.api.getQueue();

    req$.subscribe({
      next: (res) => {
        const list = res?.appointments || [];
        this.rows = list.map((a) => this.toUiRow(a));
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

  private toUiRow(a: ApiAppointment): UiRow {
    return {
      ...a,
      _editing: false,
      _saving: false,

      // ✅ set drafts from API so edit shows values by default
      _remarkDraft: a.remark || '',
      _dateDraft: isoToYmd(a.appointmentDate),
      _timeDraft: toHHmmFromFormatted(a.appointmentTimeFormatted),
    };
  }

  applyFilter() {
    const q = (this.searchText || '').toLowerCase().trim();

    this.filtered = this.rows.filter((r) => {
      const matchText =
        !q ||
        (r.patient?.fullName || '').toLowerCase().includes(q) ||
        (r.patient?.phoneNumber || '').includes(q) ||
        (r.patient?.patientIdFormatted || '').toLowerCase().includes(q) ||
        String(r.appointmentId || '').includes(q);

      const matchStatus =
        this.statusFilter === 0 || r.status === this.statusFilter;

      return matchText && matchStatus;
    });
  }

  // ----- Edit panel -----
  openEdit(row: UiRow) {
    row._editing = true;

    // ✅ always ensure defaults are filled
    row._remarkDraft = row.remark || row._remarkDraft || '';
    row._dateDraft = isoToYmd(row.appointmentDate);
    row._timeDraft = toHHmmFromFormatted(row.appointmentTimeFormatted) || row._timeDraft || '';
  }

  closeEdit(row: UiRow) {
    row._editing = false;
  }

  saveEdit(row: UiRow) {
    row._saving = true;

    // ✅ Always send HH:mm:ss (if ion time gives HH:mm -> append :00)
    const appointmentTimeToSend = toTimeWithSeconds(
      row._timeDraft || toHHmmFromFormatted(row.appointmentTimeFormatted)
    );

    this.api.updateAppointment(row.appointmentId, {
      appointmentDate: row._dateDraft || isoToYmd(row.appointmentDate),
      appointmentTime: appointmentTimeToSend,
      remark: row._remarkDraft || '',
    })
    .subscribe({
      next: (updated) => {
        Object.assign(row, this.toUiRow(updated));
        row._saving = false;
        row._editing = false;
        this.toast('Appointment updated');
        this.applyFilter();
      },
      error: () => {
        row._saving = false;
        this.toast('Update failed');
      },
    });
  }

  // ----- Status update -----
  async confirmStatus(row: UiRow, status: number) {
    if (!status || status === 0) return;

    const label = this.statusOptions.find(s => s.value === status)?.label || String(status);

    const alert = await this.alertCtrl.create({
      header: 'Change Status',
      message: `Set status to <b>${label}</b>?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Yes', handler: () => this.updateStatus(row, status as AppointmentStatus) },
      ],
    });

    await alert.present();
  }

  updateStatus(row: UiRow, status: AppointmentStatus) {
    row._saving = true;

    this.api.updateStatus(row.appointmentId, status).subscribe({
      next: (updated) => {
        Object.assign(row, this.toUiRow(updated));
        row._saving = false;
        this.toast('Status updated');
        this.applyFilter();
      },
      error: () => {
        row._saving = false;
        this.toast('Failed to update status');
      },
    });
  }

  trackById(_: number, r: UiRow) {
    return r.appointmentId;
  }

  private async toast(msg: string) {
    const t = await this.toastCtrl.create({
      message: msg,
      duration: 1300,
      position: 'bottom',
    });
    await t.present();
  }
}
