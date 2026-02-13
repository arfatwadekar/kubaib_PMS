import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular';
import {
  AppointmentService,
  AppointmentStatus,
} from 'src/app/services/appointment.service';
import { catchError, map, of, switchMap } from 'rxjs';

export type PatientMini = {
  id: number;
  pid: string;
  name: string;
  phone: string;
};

type Mode = 'create' | 'edit';

function todayYmd(): string {
  const d = new Date();
  return d.toISOString().substring(0, 10);
}

function addMonthsYmd(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().substring(0, 10);
}

@Component({
  selector: 'app-create-appointment-modal',
  templateUrl: './create-appointment-modal.component.html',
  styleUrls: ['./create-appointment-modal.component.scss'],
  standalone: false,
})
export class CreateAppointmentModalComponent implements OnInit {

  @Input() patient!: PatientMini;
  @Input() mode: Mode = 'create';

  creating = false;
  loadingDetail = false;

  appointmentId: number | null = null;

  currentStatus: AppointmentStatus | null = null;
  selectedStatus: AppointmentStatus | null = null;
  statusText = '-';

  minDate = todayYmd();
  maxDate = addMonthsYmd(3);

  statusOptions = [
    { value: AppointmentStatus.Pending, label: 'Pending' },
    { value: AppointmentStatus.InPatient, label: 'InPatient' },
    { value: AppointmentStatus.AwaitingPayment, label: 'AwaitingPayment' },
    { value: AppointmentStatus.OutPatient, label: 'OutPatient' },
    { value: AppointmentStatus.Cancelled, label: 'Cancelled' },
  ];

  form = this.fb.group({
    appointmentDate: [todayYmd(), Validators.required],
    appointmentTime: ['11:45', Validators.required],
    remark: [''],
  });

  constructor(
    private fb: FormBuilder,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private apptService: AppointmentService
  ) {}

  ngOnInit(): void {
    if (this.mode === 'edit') {
      this.loadActiveAppointment();
    }
  }

  close(): void {
    if (this.creating) return;
    this.modalCtrl.dismiss(null, 'cancel');
  }

  onStatusChange(value: AppointmentStatus): void {
    this.selectedStatus = Number(value) as AppointmentStatus;
  }

  private loadActiveAppointment(): void {
    const patientId = Number(this.patient?.id || 0);
    if (!patientId) return;

    this.loadingDetail = true;

    this.apptService.getActiveAppointmentByPatient(patientId)
      .pipe(
        catchError(err => {
          this.loadingDetail = false;
          this.showToast(err, 'Failed to load appointment');
          return of(null);
        })
      )
      .subscribe(appt => {
        this.loadingDetail = false;

        if (!appt) {
          this.mode = 'create';
          return;
        }

        this.appointmentId = Number(appt?.appointmentId || 0) || null;

        const status = Number(appt?.status || 0) as AppointmentStatus;
        this.currentStatus = status;
        this.selectedStatus = status;
        this.statusText =
          appt?.statusText || this.apptService.statusLabel(status);

        this.form.patchValue({
          appointmentDate: appt?.appointmentDate?.substring(0, 10) || todayYmd(),
          appointmentTime: this.apptService.toHHmmFromApiTime(appt),
          remark: appt?.remark || '',
        });
      });
  }

  async submit(): Promise<void> {

    if (this.creating) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.showToast(null, 'Date and Time are required.');
    }

    const patientId = Number(this.patient?.id || 0);
    const appointmentDate = this.form.value.appointmentDate!;
    const hhmm = this.form.value.appointmentTime!;
    const remark = this.form.value.remark || '';

    this.creating = true;

    if (this.mode === 'create') {
      const payload = {
        patientId,
        appointmentDate,
        appointmentTime: this.apptService.hhmmToTimeString(hhmm),
        remark,
      };

      this.apptService.createAppointment(payload).subscribe({
        next: async res => {
          this.creating = false;
          await this.showToast(null, 'Appointment Created ✅');
          this.modalCtrl.dismiss(res, 'success');
        },
        error: async err => {
          this.creating = false;
          await this.showToast(err, 'Create Appointment failed');
        },
      });

      return;
    }

    const apptId = Number(this.appointmentId || 0);
    if (!apptId) {
      this.creating = false;
      return this.showToast(null, 'Appointment ID missing.');
    }

    const updatePayload = {
      appointmentDate,
      appointmentTime: this.apptService.hhmmToTimeString(hhmm),
      remark,
    };

    const shouldUpdateStatus =
      this.selectedStatus &&
      this.selectedStatus !== this.currentStatus;

    this.apptService.updateAppointment(apptId, updatePayload)
      .pipe(
        switchMap(res => {
          if (!shouldUpdateStatus) return of(res);

          return this.apptService.updateAppointmentStatus(
            apptId,
            this.selectedStatus!
          );
        })
      )
      .subscribe({
        next: async () => {
          this.creating = false;
          await this.showToast(null, 'Appointment Updated ✅');
          this.modalCtrl.dismiss(true, 'success');
        },
        error: async err => {
          this.creating = false;
          await this.showToast(err, 'Update failed');
        },
      });
  }

  private async showToast(err: any, fallback: string): Promise<void> {
    const message =
      err?.error?.title ||
      err?.error?.detail ||
      err?.error?.message ||
      err?.message ||
      fallback;

    const toast = await this.toastCtrl.create({
      message,
      duration: 2800,
      position: 'top',
    });

    await toast.present();
  }
}
