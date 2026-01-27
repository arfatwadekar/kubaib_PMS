import { Component, Input } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular';
import { AppointmentService } from 'src/app/services/appointment.service';

export type PatientMini = {
  id: number;
  pid: string;
  name: string;
  phone: string;
};

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ✅ "HH:mm" -> "HH:mm:00" for backend TimeSpan
function toTimeSpanString(hhmm: string): string {
  const s = (hhmm || '').trim();
  const [hhStr, mmStr] = s.split(':');
  const hh = Number(hhStr);
  const mm = Number(mmStr);

  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '';
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

@Component({
  selector: 'app-create-appointment-modal',
  templateUrl: './create-appointment-modal.component.html',
  styleUrls: ['./create-appointment-modal.component.scss'],
  standalone:false
})
export class CreateAppointmentModalComponent {
  @Input() patient!: PatientMini;

  creating = false;

  form = this.fb.group({
    appointmentDate: [todayYmd(), [Validators.required]],
    appointmentTime: ['11:45', [Validators.required]], // HH:mm
    remark: [''],
  });

  constructor(
    private fb: FormBuilder,
    private modalCtrl: ModalController,
    private apptService: AppointmentService,
    private toastCtrl: ToastController
  ) {}

  close() {
    if (this.creating) return;
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const t = await this.toastCtrl.create({
        message: 'Date aur Time required hai.',
        duration: 2200,
        position: 'top',
      });
      return t.present();
    }

    const patientId = Number(this.patient?.id || 0);
    const appointmentDate = String(this.form.value.appointmentDate || '');
    const hhmm = String(this.form.value.appointmentTime || '');
    const appointmentTime = toTimeSpanString(hhmm);

    if (!patientId || !appointmentDate || !appointmentTime) {
      const t = await this.toastCtrl.create({
        message: 'Invalid data.',
        duration: 2000,
        position: 'top',
      });
      return t.present();
    }

    const payload = {
      patientId,
      appointmentDate,
      appointmentTime, // "11:45:00"
      remark: String(this.form.value.remark || '').trim(),
    };

    this.creating = true;

    this.apptService.createAppointment(payload).subscribe({
      next: async (res: any) => {
        this.creating = false;

        const apptId = res?.appointmentId ?? res?.data?.appointmentId ?? null;
        const toast = await this.toastCtrl.create({
          message: apptId ? `Appointment Created ✅ ID: ${apptId}` : 'Appointment Created ✅',
          duration: 2200,
          position: 'top',
        });
        await toast.present();

        this.modalCtrl.dismiss(res, 'success');
      },
      error: async (err) => {
        this.creating = false;
        const msg =
          err?.error?.title ||
          err?.error?.detail ||
          err?.error?.message ||
          err?.message ||
          'Create Appointment failed';

        const toast = await this.toastCtrl.create({
          message: msg,
          duration: 3500,
          position: 'top',
        });
        toast.present();
      },
    });
  }
}
