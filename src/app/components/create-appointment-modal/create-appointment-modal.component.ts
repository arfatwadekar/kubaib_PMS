import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular';
import {
  AppointmentService,
  AppointmentStatus,
} from 'src/app/services/appointment.service';
import { catchError, of, switchMap } from 'rxjs';

type Mode = 'create' | 'edit';

type PatientMini = {
  id: number;
  pid: string;
  name: string;
  phone: string;
};

function todayYmd(): string {
  return new Date().toISOString().substring(0, 10);
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
  standalone: false, // keep false if using module
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

  // ✅ STRICT SAFE FORM (TIME OPTIONAL)
  form = this.fb.group({
    appointmentDate: new FormControl<string | null>(
      todayYmd(),
      { nonNullable: false, validators: [Validators.required] }
    ),
    appointmentTime: new FormControl<string | null>(null),
    remark: new FormControl<string | null>(''),
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
    if (!this.creating) {
      this.modalCtrl.dismiss(null, 'cancel');
    }
  }

  onStatusChange(value: AppointmentStatus): void {
    this.selectedStatus = Number(value);
  }

  private loadActiveAppointment(): void {
    const patientId = Number(this.patient?.id);
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

        this.appointmentId = Number(appt.appointmentId) || null;

        const status = Number(appt.status) as AppointmentStatus;
        this.currentStatus = status;
        this.selectedStatus = status;
        this.statusText =
          appt.statusText || this.apptService.statusLabel(status);

        this.form.patchValue({
          appointmentDate:
            appt.appointmentDate?.substring(0, 10) || todayYmd(),
          appointmentTime:
            this.apptService.toHHmmFromApiTime(appt) || null,
          remark: appt.remark || '',
        });
      });
  }

  async submit(): Promise<void> {

    if (this.creating) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.showToast(null, 'Appointment Date is required.');
    }

    const raw = this.form.getRawValue();

    const appointmentDate = raw.appointmentDate as string; // safe because required
    const appointmentTime = raw.appointmentTime;
    const remark = raw.remark ?? '';

    const patientId = Number(this.patient?.id);

    const timeString = appointmentTime
      ? this.apptService.hhmmToTimeString(appointmentTime)
      : null;

    this.creating = true;

    if (this.mode === 'create') {

      const payload = {
        patientId,
        appointmentDate,
        appointmentTime: timeString ?? '', // adjust if backend doesn't allow null
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
        }
      });

      return;
    }

    if (!this.appointmentId) {
      this.creating = false;
      return this.showToast(null, 'Appointment ID missing.');
    }

    const updatePayload = {
      appointmentDate,
      appointmentTime: timeString ?? '',
      remark,
    };

    const shouldUpdateStatus =
      this.selectedStatus !== this.currentStatus;

    this.apptService.updateAppointment(this.appointmentId, updatePayload)
      .pipe(
        switchMap(res => {
          if (!shouldUpdateStatus || this.selectedStatus == null) {
            return of(res);
          }
          return this.apptService.updateAppointmentStatus(
            this.appointmentId!,
            this.selectedStatus
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
        }
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
      duration: 2500,
      position: 'top'
    });

    await toast.present();
  }
}
