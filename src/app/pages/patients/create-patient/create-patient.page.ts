// src/app/pages/patients/create-patient/create-patient.page.ts
import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

import { PatientService } from 'src/app/services/patient.service';
import { PidSuccessPage } from '../pid-success/pid-success.page';

function onlyDigits(v: string) {
  return (v || '').replace(/\D/g, '');
}

function splitFullName(full: string) {
  const s = (full || '').trim().replace(/\s+/g, ' ');
  if (!s) return { firstName: 'NA', lastName: 'NA' };

  const parts = s.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: 'NA' };

  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || 'NA' };
}

function toIso(dateOnlyOrIso: string): string {
  if (!dateOnlyOrIso) return new Date().toISOString();
  if (dateOnlyOrIso.includes('T')) return dateOnlyOrIso;

  const [y, m, d] = dateOnlyOrIso.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toISOString();
}

@Component({
  selector: 'app-create-patient',
  templateUrl: './create-patient.page.html',
  styleUrls: ['./create-patient.page.scss'],
  standalone: false,
})
export class CreatePatientPage {
  loading = false;

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
    private modalCtrl: ModalController,
    private router: Router
  ) {
    // ✅ if patient data passed from previous page
    const nav = this.router.getCurrentNavigation();
    const data = nav?.extras?.state?.['patient'];
    if (data) this.patchFromDashboard(data);
  }

  // -------------------------
  // Input cleaners
  // -------------------------

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

  // -------------------------
  // Submit
  // -------------------------

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.toast('Full Name, DOB and Phone Number (10 digits) are required.');
    }

    const phone = onlyDigits(this.form.value.phoneNumber || '').slice(0, 10);
    if (phone.length !== 10) return this.toast('Phone Number must be exactly 10 digits.');

    const payload = this.buildPayload();
    this.loading = true;

    this.patient.createPatient(payload).subscribe({
      next: async (res: any) => {
        this.loading = false;

        const pid =
          res?.pid ||
          res?.patientId ||
          res?.patientID ||
          res?.data?.pid ||
          res?.data?.patientId ||
          null;

        if (!pid) {
          return this.toast('Patient created but PID not received from API.');
        }

        // ✅ show success modal
        await this.openSuccessModal(pid);

        // ✅ reset form after success
        this.resetForm();
      },
      error: async (err) => {
        this.loading = false;

        const apiErr = err?.error?.errors;
        const msg = apiErr
          ? Object.keys(apiErr)
              .map((k) => `${k}: ${apiErr[k]?.[0] || ''}`.trim())
              .join(' | ')
          : err?.error?.title || err?.error?.message || 'Create Patient failed';

        this.toast(msg);
      },
    });
  }

  // -------------------------
  // Helpers
  // -------------------------

  private buildPayload() {
    const v = this.form.value;
    const { firstName, lastName } = splitFullName(v.fullName || '');

    const phone = onlyDigits(v.phoneNumber || '').slice(0, 10);
    const alt = onlyDigits(v.alternateNumber || '').slice(0, 10);

    return {
      FirstName: firstName || 'NA',
      LastName: lastName || 'NA',
      DateOfBirth: toIso(v.dateOfBirth || ''),
      Gender: v.gender || 'Male',

      PhoneNumber: phone,
      AlternateNumber: alt.length === 10 ? alt : phone,

      Email: (v.email || '').toString().trim(),
      Address: (v.address || 'NA').toString().trim(),
      City: (v.city || 'NA').toString().trim(),
      State: (v.state || 'NA').toString().trim(),
      PinCode: (v.pinCode || '000000').toString().trim(),

      MaritalStatus: (v.maritalStatus || 'Single').toString(),
      MaritalStatusSince: v.maritalStatusSince ? toIso(v.maritalStatusSince) : '2000-01-01T00:00:00.000Z',

      Religion: (v.religion || 'NA').toString().trim(),
      Diet: (v.diet || 'NA').toString().trim(),
      Education: (v.education || 'NA').toString().trim(),
      Occupation: (v.occupation || 'NA').toString().trim(),

      AadharNumber: (v.aadharNumber || '000000000000').toString().trim(),
      PanNumber: (v.panNumber || 'NA').toString().trim(),
      ReferredBy: (v.referredBy || 'Self').toString().trim(),
    };
  }

  private async openSuccessModal(pid: string) {
    const modal = await this.modalCtrl.create({
      component: PidSuccessPage,
      componentProps: { pid, registeredBy: 'Receptionist' },
      backdropDismiss: false,
      cssClass: 'pid-success-modal', // ✅ IMPORTANT (global.scss)
    });

    await modal.present();
  }

  private resetForm() {
    this.form.reset({
      gender: 'Male',
      maritalStatus: 'Single',
    });
  }

  private patchFromDashboard(p: any) {
    const fullName =
      `${(p.firstName || '').trim()} ${(p.lastName || '').trim()}`.trim() || (p._name || '');

    const dob = (p.dateOfBirth || '').toString().includes('T')
      ? (p.dateOfBirth || '').toString().substring(0, 10)
      : (p.dateOfBirth || '');

    this.form.patchValue({
      fullName,
      gender: p.gender || 'Male',
      dateOfBirth: dob || '',
      phoneNumber: (p.phoneNumber || p._phone || '').toString(),
      email: (p.email || '').toString(),
      address: (p.address || '').toString(),
      city: (p.city || '').toString(),
      state: (p.state || '').toString(),
      pinCode: (p.pinCode || '').toString(),
      maritalStatus: p.maritalStatus || 'Single',
      maritalStatusSince: (p.maritalStatusSince || '').toString().includes('T')
        ? (p.maritalStatusSince || '').toString().substring(0, 10)
        : (p.maritalStatusSince || ''),
      religion: (p.religion || '').toString(),
      diet: (p.diet || '').toString(),
      education: (p.education || '').toString(),
      occupation: (p.occupation || '').toString(),
      aadharNumber: (p.aadharNumber || '').toString(),
      panNumber: (p.panNumber || '').toString(),
      referredBy: (p.referredBy || '').toString(),
      alternateNumber: (p.alternateNumber || '').toString(),
    });
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
    });
    t.present();
  }

  async autofill() {
    this.form.patchValue({
      fullName: 'Arfat Wadekar',
      gender: 'Male',
      dateOfBirth: '1998-06-15',
      phoneNumber: '9967027888',
      email: 'arfuwadekar74@gmail.com',
      address: 'Naheed Apt, B Wing 204, Mumbra',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400612',
      maritalStatus: 'Single',
    });

    this.toast('Auto-filled. Now click Create.');
  }
}
