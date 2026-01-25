// import { Component } from '@angular/core';
// import { FormBuilder, Validators } from '@angular/forms';
// import { ToastController } from '@ionic/angular';
// import { PatientService } from '../../../services/patient.service';

// function onlyDigits(v: string) {
//   return (v || '').replace(/\D/g, '');
// }

// function splitFullName(full: string): { firstName: string; lastName: string } {
//   const s = (full || '').trim().replace(/\s+/g, ' ');
//   if (!s) return { firstName: '', lastName: 'NA' };
//   const parts = s.split(' ');
//   if (parts.length === 1) return { firstName: parts[0], lastName: 'NA' };
//   return { firstName: parts[0], lastName: parts.slice(1).join(' ') || 'NA' };
// }

// // Supports "YYYY-MM-DD" or ISO string
// function toIso(dateOnlyOrIso: string): string {
//   if (!dateOnlyOrIso) return new Date().toISOString();
//   if (dateOnlyOrIso.includes('T')) return dateOnlyOrIso;

//   const [y, m, d] = dateOnlyOrIso.split('-').map(Number);
//   const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0));
//   return dt.toISOString();
// }

// function isoFallbackDate(): string {
//   return '2000-01-01T00:00:00.000Z';
// }

// @Component({
//   selector: 'app-create-patient',
//   templateUrl: './create-patient.page.html',
//   styleUrls: ['./create-patient.page.scss'],
//   standalone:false,
// })
// export class CreatePatientPage {
//   loading = false;
//   createdPid: string | null = null;

//   form = this.fb.group({
//     // UI required
//     fullName: ['', [Validators.required, Validators.minLength(2)]],
//     gender: ['Male', [Validators.required]],
//     dateOfBirth: ['', [Validators.required]],
//     phoneNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],

//     // optional inputs (backend requires many; we auto-fill on submit)
//     alternateNumber: [''],
//     email: [''],
//     address: [''],
//     city: [''],
//     state: [''],
//     pinCode: [''],

//     maritalStatus: ['Single'],
//     maritalStatusSince: [''],

//     religion: [''],
//     diet: [''],
//     education: [''],
//     occupation: [''],

//     aadharNumber: [''],
//     panNumber: [''],
//     referredBy: [''],
//   });

//   constructor(
//     private fb: FormBuilder,
//     private patient: PatientService,
//     private toastCtrl: ToastController
//   ) {}

//   // ---------- input cleaners ----------
//   onPhoneInput() {
//     const cleaned = onlyDigits(this.form.value.phoneNumber || '').slice(0, 10);
//     this.form.patchValue({ phoneNumber: cleaned }, { emitEvent: false });
//   }

//   onAltPhoneInput() {
//     const cleaned = onlyDigits(this.form.value.alternateNumber || '').slice(0, 10);
//     this.form.patchValue({ alternateNumber: cleaned }, { emitEvent: false });
//   }

//   onAadharInput() {
//     const cleaned = onlyDigits(this.form.value.aadharNumber || '').slice(0, 12);
//     this.form.patchValue({ aadharNumber: cleaned }, { emitEvent: false });
//   }

//   // ---------- helpers ----------
//   private safeString(v: any, fallback: string) {
//     const s = (v ?? '').toString().trim();
//     return s ? s : fallback;
//   }

//   private buildBackendSafePayload() {
//     const v = this.form.value;

//     const { firstName, lastName } = splitFullName(v.fullName || '');

//     const phone = onlyDigits(v.phoneNumber || '').slice(0, 10);
//     const alt = onlyDigits(v.alternateNumber || '').slice(0, 10);

//     // IMPORTANT: backend validates Required on these fields.
//     // So we send safe defaults if user left them blank.
//     const payload = {
//       // PascalCase keys for ASP.NET binding safety
//       FirstName: this.safeString(firstName, 'NA'),
//       LastName: this.safeString(lastName, 'NA'),
//       DateOfBirth: toIso(v.dateOfBirth || ''),
//       Gender: this.safeString(v.gender, 'Male'),

//       PhoneNumber: phone,
//       AlternateNumber: alt.length === 10 ? alt : phone, // fallback to phone

//       Email: (v.email || '').toString().trim(), // keep optional
//       Address: this.safeString(v.address, 'NA'),
//       City: this.safeString(v.city, 'NA'),
//       State: this.safeString(v.state, 'NA'),
//       PinCode: this.safeString(v.pinCode, '000000'),

//       MaritalStatus: this.safeString(v.maritalStatus, 'Single'),
//       MaritalStatusSince: v.maritalStatusSince ? toIso(v.maritalStatusSince) : isoFallbackDate(),

//       Religion: this.safeString(v.religion, 'NA'),
//       Diet: this.safeString(v.diet, 'NA'),
//       Education: this.safeString(v.education, 'NA'),
//       Occupation: this.safeString(v.occupation, 'NA'),

//       AadharNumber: this.safeString(v.aadharNumber, '000000000000'),
//       PanNumber: this.safeString(v.panNumber, 'NA'),
//       ReferredBy: this.safeString(v.referredBy, 'Self'),
//     };

//     return payload;
//   }

//   // ---------- actions ----------
//   async submit() {
//     this.createdPid = null;

//     // UI level validation
//     if (this.form.invalid) {
//       this.form.markAllAsTouched();
//       const t = await this.toastCtrl.create({
//         message: 'Full Name, DOB and Phone Number (10 digits) are required.',
//         duration: 2200,
//         position: 'top',
//       });
//       return t.present();
//     }

//     const phone = onlyDigits(this.form.value.phoneNumber || '').slice(0, 10);
//     if (phone.length !== 10) {
//       const t = await this.toastCtrl.create({
//         message: 'Phone Number must be exactly 10 digits.',
//         duration: 2200,
//         position: 'top',
//       });
//       return t.present();
//     }

//     const payload = this.buildBackendSafePayload();

//     this.loading = true;

//     // ✅ FIXED: no "here as any"
//     this.patient.createPatient(payload).subscribe({
//       next: async (res: any) => {
//         this.createdPid =
//           res?.patientId ||
//           res?.patientID ||
//           res?.pid ||
//           res?.data?.patientId ||
//           res?.data?.pid ||
//           null;

//         const toast = await this.toastCtrl.create({
//           message: this.createdPid
//             ? `Patient Created ✅ PID: ${this.createdPid}`
//             : 'Patient Created ✅',
//           duration: 2500,
//           position: 'top',
//         });
//         await toast.present();
//       },
//       error: async (err) => {
//         const apiErr = err?.error?.errors;
//         const msg =
//           apiErr
//             ? Object.keys(apiErr)
//                 .map((k) => `${k}: ${apiErr[k]?.[0] || ''}`.trim())
//                 .join(' | ')
//             : (err?.error?.title || err?.error?.message || 'Create Patient failed');

//         const toast = await this.toastCtrl.create({
//           message: msg,
//           duration: 4000,
//           position: 'top',
//         });
//         await toast.present();

//         this.loading = false;
//       },
//       complete: () => (this.loading = false),
//     });
//   }

//   async autofill() {
//     this.form.patchValue({
//       fullName: 'Arfat Wadekar',
//       gender: 'Male',
//       dateOfBirth: '1998-06-15',

//       phoneNumber: '9967027888', // ✅ 10 digits
//       alternateNumber: '',

//       email: 'arfuwadekar74@gmail.com',
//       address: 'Naheed Apt, B Wing 204, Mumbra',
//       city: 'Mumbai',
//       state: 'Maharashtra',
//       pinCode: '400612',

//       maritalStatus: 'Single',
//       maritalStatusSince: '',

//       religion: '',
//       diet: '',
//       education: '',
//       occupation: '',

//       aadharNumber: '',
//       panNumber: '',
//       referredBy: '',
//     });

//     const t = await this.toastCtrl.create({
//       message: 'Auto-filled. Now click Create.',
//       duration: 1500,
//       position: 'top',
//     });
//     t.present();
//   }
// }



// ==================================================================================
import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ToastController, ModalController } from '@ionic/angular';
import { PatientService } from '../../../services/patient.service';
import { PidSuccessPage } from '../../patients/pid-success/pid-success.page'; // ✅ path check

function onlyDigits(v: string) {
  return (v || '').replace(/\D/g, '');
}

function splitFullName(full: string): { firstName: string; lastName: string } {
  const s = (full || '').trim().replace(/\s+/g, ' ');
  if (!s) return { firstName: '', lastName: 'NA' };
  const parts = s.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: 'NA' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || 'NA' };
}

function toIso(dateOnlyOrIso: string): string {
  if (!dateOnlyOrIso) return new Date().toISOString();
  if (dateOnlyOrIso.includes('T')) return dateOnlyOrIso;

  const [y, m, d] = dateOnlyOrIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0));
  return dt.toISOString();
}

function isoFallbackDate(): string {
  return '2000-01-01T00:00:00.000Z';
}

@Component({
  selector: 'app-create-patient',
  templateUrl: './create-patient.page.html',
  styleUrls: ['./create-patient.page.scss'],
  standalone: false,
})
export class CreatePatientPage {
  loading = false;
  createdPid: string | null = null;

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    gender: ['Male', [Validators.required]],
    dateOfBirth: ['', [Validators.required]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],

    alternateNumber: [''],
    email: [''],
    address: [''],
    city: [''],
    state: [''],
    pinCode: [''],

    maritalStatus: ['Single'],
    maritalStatusSince: [''],

    religion: [''],
    diet: [''],
    education: [''],
    occupation: [''],

    aadharNumber: [''],
    panNumber: [''],
    referredBy: [''],
  });

  constructor(
    private fb: FormBuilder,
    private patient: PatientService,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController
  ) {}

  // ---------- input cleaners ----------
  onPhoneInput() {
    const cleaned = onlyDigits(this.form.value.phoneNumber || '').slice(0, 10);
    this.form.patchValue({ phoneNumber: cleaned }, { emitEvent: false });
  }

  onAltPhoneInput() {
    const cleaned = onlyDigits(this.form.value.alternateNumber || '').slice(0, 10);
    this.form.patchValue({ alternateNumber: cleaned }, { emitEvent: false });
  }

  onAadharInput() {
    const cleaned = onlyDigits(this.form.value.aadharNumber || '').slice(0, 12);
    this.form.patchValue({ aadharNumber: cleaned }, { emitEvent: false });
  }

  private safeString(v: any, fallback: string) {
    const s = (v ?? '').toString().trim();
    return s ? s : fallback;
  }

  private buildBackendSafePayload() {
    const v = this.form.value;
    const { firstName, lastName } = splitFullName(v.fullName || '');

    const phone = onlyDigits(v.phoneNumber || '').slice(0, 10);
    const alt = onlyDigits(v.alternateNumber || '').slice(0, 10);

    return {
      FirstName: this.safeString(firstName, 'NA'),
      LastName: this.safeString(lastName, 'NA'),
      DateOfBirth: toIso(v.dateOfBirth || ''),
      Gender: this.safeString(v.gender, 'Male'),

      PhoneNumber: phone,
      AlternateNumber: alt.length === 10 ? alt : phone,

      Email: (v.email || '').toString().trim(),
      Address: this.safeString(v.address, 'NA'),
      City: this.safeString(v.city, 'NA'),
      State: this.safeString(v.state, 'NA'),
      PinCode: this.safeString(v.pinCode, '000000'),

      MaritalStatus: this.safeString(v.maritalStatus, 'Single'),
      MaritalStatusSince: v.maritalStatusSince ? toIso(v.maritalStatusSince) : isoFallbackDate(),

      Religion: this.safeString(v.religion, 'NA'),
      Diet: this.safeString(v.diet, 'NA'),
      Education: this.safeString(v.education, 'NA'),
      Occupation: this.safeString(v.occupation, 'NA'),

      AadharNumber: this.safeString(v.aadharNumber, '000000000000'),
      PanNumber: this.safeString(v.panNumber, 'NA'),
      ReferredBy: this.safeString(v.referredBy, 'Self'),
    };
  }

  // ✅ SUCCESS MODAL OPEN
  private async openSuccessModal(pid: string) {
    const modal = await this.modalCtrl.create({
      component: PidSuccessPage,
      componentProps: {
        pid,
        registeredBy: 'Receptionist', // later token user name se fill kar dena
      },
      backdropDismiss: false,
    });

    await modal.present();
  }

  async submit() {
    this.createdPid = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const t = await this.toastCtrl.create({
        message: 'Full Name, DOB and Phone Number (10 digits) are required.',
        duration: 2200,
        position: 'top',
      });
      return t.present();
    }

    const phone = onlyDigits(this.form.value.phoneNumber || '').slice(0, 10);
    if (phone.length !== 10) {
      const t = await this.toastCtrl.create({
        message: 'Phone Number must be exactly 10 digits.',
        duration: 2200,
        position: 'top',
      });
      return t.present();
    }

    const payload = this.buildBackendSafePayload();
    this.loading = true;

    this.patient.createPatient(payload).subscribe({
      next: async (res: any) => {
        const pid =
          res?.pid ||
          res?.patientId ||
          res?.patientID ||
          res?.data?.pid ||
          res?.data?.patientId ||
          null;

        this.loading = false;

        if (!pid) {
          const t = await this.toastCtrl.create({
            message: 'Patient created but PID not received from API.',
            duration: 2500,
            position: 'top',
          });
          return t.present();
        }

        this.createdPid = pid;

      
          // ✅ OPEN SUCCESS MODAL
  await this.openSuccessModal(pid);

  // ✅ CLEAR FORM AFTER SUCCESS
  this.resetForm();
      },

      error: async (err) => {
        this.loading = false;

        const apiErr = err?.error?.errors;
        const msg =
          apiErr
            ? Object.keys(apiErr)
                .map((k) => `${k}: ${apiErr[k]?.[0] || ''}`.trim())
                .join(' | ')
            : err?.error?.title || err?.error?.message || 'Create Patient failed';

        const toast = await this.toastCtrl.create({
          message: msg,
          duration: 4000,
          position: 'top',
        });
        await toast.present();
      },
    });
  }

  async autofill() {
    this.form.patchValue({
      fullName: 'Arfat Wadekar',
      gender: 'Male',
      dateOfBirth: '1998-06-15',

      phoneNumber: '9967027888',
      alternateNumber: '',

      email: 'arfuwadekar74@gmail.com',
      address: 'Naheed Apt, B Wing 204, Mumbra',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400612',

      maritalStatus: 'Single',
      maritalStatusSince: '',

      religion: '',
      diet: '',
      education: '',
      occupation: '',

      aadharNumber: '',
      panNumber: '',
      referredBy: '',
    });

    const t = await this.toastCtrl.create({
      message: 'Auto-filled. Now click Create.',
      duration: 1500,
      position: 'top',
    });
    t.present();
  }

  private resetForm() {
  this.form.reset({
    gender: 'Male',
    maritalStatus: 'Single',
  });

  this.createdPid = null;
}

}
