import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular';
import { AppointmentService, AppointmentStatus } from 'src/app/services/appointment.service';
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
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

  form = this.fb.group({
    appointmentDate: [todayYmd(), [Validators.required]],
    appointmentTime: ['11:45', [Validators.required]], // HH:mm
    remark: [''],
  });

  constructor(
    private fb: FormBuilder,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private apptService: AppointmentService
  ) {}

  ngOnInit(): void {
    if (this.mode === 'edit') this.loadActiveAppointment();
  }

  close(): void {
    if (this.creating) return;
    this.modalCtrl.dismiss(null, 'cancel');
  }

  onStatusChange(v: any) {
    const n = Number(v);
    this.selectedStatus = (n as AppointmentStatus) || null;
  }

  private loadActiveAppointment(): void {
    const patientId = Number(this.patient?.id || 0);
    if (!patientId) return;

    this.loadingDetail = true;

    this.apptService
      .getActiveAppointmentByPatient(patientId)
      .pipe(
        catchError((err) => {
          this.loadingDetail = false;
          this.showToast(err, 'Failed to load appointment');
          return of(null);
        })
      )
      .subscribe((appt: any) => {
        this.loadingDetail = false;

        if (!appt) {
          this.showToast(null, 'No active appointment found');
          this.mode = 'create';
          return;
        }

        this.appointmentId = Number(appt?.appointmentId || 0) || null;

        const s = Number(appt?.status || 0) as AppointmentStatus;
        this.currentStatus = s || null;
        this.selectedStatus = s || null;
        this.statusText = String(appt?.statusText || this.apptService.statusLabel(s));

        const dateIso = String(appt?.appointmentDate || '');
        const date = dateIso ? dateIso.substring(0, 10) : todayYmd();

        const timeHHmm = this.apptService.toHHmmFromApiTime(appt);

        this.form.patchValue({
          appointmentDate: date,
          appointmentTime: timeHHmm,
          remark: String(appt?.remark || ''),
        });
      });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.showToast(null, 'Date aur Time required hai.');
    }

    const patientId = Number(this.patient?.id || 0);
    const appointmentDate = String(this.form.value.appointmentDate || '').trim();
    const hhmm = String(this.form.value.appointmentTime || '').trim();
    const remark = String(this.form.value.remark || '').trim();

    if (!appointmentDate || !hhmm) return this.showToast(null, 'Invalid data.');

    this.creating = true;

    // ---------------- CREATE ----------------
    if (this.mode === 'create') {
      if (!patientId) {
        this.creating = false;
        return this.showToast(null, 'Patient ID missing.');
      }

      const payload = {
        patientId,
        appointmentDate,
        appointmentTime: this.apptService.hhmmToTimeString(hhmm), // ✅ HH:mm:00
        remark,
      };

      this.apptService.createAppointment(payload).subscribe({
        next: async (res: any) => {
          this.creating = false;
          await this.showToast(null, 'Appointment Created ✅');
          this.modalCtrl.dismiss(res, 'success');
        },
        error: async (err) => {
          this.creating = false;
          await this.showToast(err, 'Create Appointment failed');
        },
      });

      return;
    }

    // ---------------- EDIT (ONE BUTTON -> 2 APIs) ----------------
    const apptId = Number(this.appointmentId || 0);
    if (!apptId) {
      this.creating = false;
      return this.showToast(null, 'Appointment ID missing.');
    }

    // 1) Always update appointment details
    const updatePayload = {
      appointmentDate,
      appointmentTime: this.apptService.hhmmToTimeString(hhmm), // ✅ HH:mm:00
      remark,
    };

    // 2) If status changed, call status API after details update
    const newStatus = Number(this.selectedStatus || 0) as AppointmentStatus;
    const oldStatus = Number(this.currentStatus || 0) as AppointmentStatus;
    const shouldUpdateStatus = !!newStatus && !!oldStatus && newStatus !== oldStatus;

    this.apptService
      .updateAppointment(apptId, updatePayload)
      .pipe(
        switchMap((res1) => {
          if (!shouldUpdateStatus) return of({ appt: res1, statusRes: null });

          return this.apptService.updateAppointmentStatus(apptId, newStatus).pipe(
            map((statusRes) => ({ appt: res1, statusRes }))
          );
        })
      )
      .subscribe({
        next: async ({ statusRes }) => {
          this.creating = false;

          // update status display locally if updated
          if (statusRes) {
            const s = Number(statusRes?.status || newStatus) as AppointmentStatus;
            this.currentStatus = s;
            this.selectedStatus = s;
            this.statusText = String(statusRes?.statusText || this.apptService.statusLabel(s));
          }

          await this.showToast(null, 'Appointment Updated ✅');
          this.modalCtrl.dismiss(true, 'success');
        },
        error: async (err) => {
          this.creating = false;
          await this.showToast(err, 'Update failed');
        },
      });
  }

  private async showToast(err: any, fallback: string): Promise<void> {
    const msg =
      err?.error?.title ||
      err?.error?.detail ||
      err?.error?.message ||
      err?.message ||
      fallback;

    const t = await this.toastCtrl.create({
      message: msg,
      duration: 2800,
      position: 'top',
    });
    await t.present();
  }
}
