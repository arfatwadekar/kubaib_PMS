// src/app/pages/patients/create-patient/create-patient.page.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { PatientService } from 'src/app/services/patient.service';

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

function toIso(dateOnlyOrIso: string): string | null {
  const s = (dateOnlyOrIso || '').toString().trim();
  if (!s) return null;
  if (s.includes('T')) return s;

  const [y, m, d] = s.split('-').map(Number);
  if (!y) return null;
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toISOString();
}

function toDateInput(isoOrDateOrYear: any): string {
  const s = (isoOrDateOrYear ?? '').toString().trim();
  if (!s) return '';
  if (/^\d{4}$/.test(s)) return s;
  if (s.includes('T')) return s.slice(0, 10);
  return s;
}

function nullIfBlank(v: any): string | null {
  const s = (v ?? '').toString().trim();
  return s ? s : null;
}

function nullIfDigitsBlank(v: any, maxLen: number): string | null {
  const d = onlyDigits((v ?? '').toString()).slice(0, maxLen);
  return d ? d : null;
}

function normalizeMaritalSince(v: any): string | null {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  if (/^\d{4}$/.test(s)) return s; // year allowed
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return toIso(s);
  return s; // if backend supports other format
}

@Component({
  selector: 'app-create-patient',
  templateUrl: './create-patient.page.html',
  styleUrls: ['./create-patient.page.scss'],
  standalone: false,
})
export class CreatePatientPage implements OnInit, OnDestroy {
  loading = false;

  isEditMode = false;
  patientId: number | null = null;

  // ✅ store latest patient from DB
  private currentPatient: any = null;

  private sub = new Subscription();

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
    private alertCtrl: AlertController,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.route.queryParams.subscribe((qp) => {
        const id = Number(qp?.['patientId'] ?? 0) || 0;

        if (id > 0) {
          this.isEditMode = true;
          this.patientId = id;
          this.loadPatient(id);
        } else {
          this.isEditMode = false;
          this.patientId = null;
          this.currentPatient = null;
          this.resetForm();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

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

  private loadPatient(id: number) {
    this.loading = true;

    this.patient.getPatientById(id).subscribe({
      next: (res: any) => {
        const p = res?.data ?? res;

        // ✅ keep exact DB data for update merge
        this.currentPatient = p;

        this.resetForm();

        const fullName =
          `${String(p?.firstName ?? '').trim()} ${String(p?.lastName ?? '').trim()}`.trim() ||
          String(p?.fullName ?? '').trim();

        this.form.patchValue({
          fullName: fullName || '',
          gender: p?.gender || 'Male',
          dateOfBirth: toDateInput(p?.dateOfBirth),
          phoneNumber: String(p?.phoneNumber ?? '').trim(),
          alternateNumber: String(p?.alternateNumber ?? '').trim(),
          email: String(p?.email ?? '').trim(),
          address: String(p?.address ?? '').trim(),
          city: String(p?.city ?? '').trim(),
          state: String(p?.state ?? '').trim(),
          pinCode: String(p?.pinCode ?? '').trim(),

          maritalStatus: p?.maritalStatus || 'Single',
          maritalStatusSince: toDateInput(p?.maritalStatusSince),

          religion: String(p?.religion ?? '').trim(),
          diet: String(p?.diet ?? '').trim(),
          education: String(p?.education ?? '').trim(),
          occupation: String(p?.occupation ?? '').trim(),

          aadharNumber: String(p?.aadharNumber ?? '').trim(),
          panNumber: String(p?.panNumber ?? '').trim(),
          referredBy: String(p?.referredBy ?? '').trim(),
        });
      },
      error: (err) => this.toast(err?.error?.message || err?.message || 'Failed to load patient'),
      complete: () => (this.loading = false),
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast('Full Name, DOB and Phone Number (10 digits) are required.');
      return;
    }

    const phone = onlyDigits(this.form.value.phoneNumber || '').slice(0, 10);
    if (phone.length !== 10) {
      this.toast('Phone Number must be exactly 10 digits.');
      return;
    }

    this.loading = true;

    // ✅ Update mode: merge with currentPatient so backend gets full object
    if (this.isEditMode && this.patientId) {
      const payload = this.buildUpdatePayload(); // ✅ full object with nulls

      this.patient.updatePatient(this.patientId, payload).subscribe({
        next: async () => {
          this.loading = false;
          await this.openSuccessModalAndReload();
        },
        error: (err) => {
          this.loading = false;
          this.toast(err?.error?.message || err?.message || 'Update Patient failed');
        },
      });

      return;
    }

    // ✅ Create mode
    const payload = this.buildCreatePayload();
    this.patient.createPatient(payload).subscribe({
      next: async () => {
        this.loading = false;
        await this.toast('Patient created successfully.');
        this.resetForm();
      },
      error: (err) => {
        this.loading = false;
        this.toast(err?.error?.message || err?.message || 'Create Patient failed');
      },
    });
  }

  // ✅ Create payload (null instead of "")
  private buildCreatePayload() {
    const v = this.form.value;
    const { firstName, lastName } = splitFullName(v.fullName || '');

    const phone = onlyDigits(v.phoneNumber || '').slice(0, 10);
    const alt = onlyDigits(v.alternateNumber || '').slice(0, 10);

    return {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: toIso(v.dateOfBirth || ''),
      gender: (v.gender || 'Male').toString(),

      phoneNumber: phone,
      alternateNumber: alt.length === 10 ? alt : phone,

      email: nullIfBlank(v.email),
      address: nullIfBlank(v.address),
      city: nullIfBlank(v.city),
      state: nullIfBlank(v.state),
      pinCode: nullIfBlank(v.pinCode),

      maritalStatus: nullIfBlank(v.maritalStatus) ?? 'Single',
      maritalStatusSince: normalizeMaritalSince(v.maritalStatusSince),

      religion: nullIfBlank(v.religion),
      diet: nullIfBlank(v.diet),
      education: nullIfBlank(v.education),
      occupation: nullIfBlank(v.occupation),

      aadharNumber: nullIfDigitsBlank(v.aadharNumber, 12),
      panNumber: nullIfBlank(v.panNumber),
      referredBy: nullIfBlank(v.referredBy),
    };
  }

  // ✅ Update payload: base = currentPatient + override form + nulls
  private buildUpdatePayload() {
    const base = this.currentPatient || {};
    const v = this.form.value;

    const { firstName, lastName } = splitFullName(v.fullName || '');
    const phone = onlyDigits(v.phoneNumber || '').slice(0, 10);
    const alt = onlyDigits(v.alternateNumber || '').slice(0, 10);

    return {
      // keep ids if backend expects them (safe)
      patientsId: base?.patientsId ?? this.patientId,

      pid: base?.pid ?? null,

      // overwrite with form
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: toIso(v.dateOfBirth || ''),
      gender: (v.gender || base?.gender || 'Male').toString(),

      phoneNumber: phone,
      alternateNumber: alt.length === 10 ? alt : phone,

      // optional => null
      email: nullIfBlank(v.email),
      address: nullIfBlank(v.address),
      city: nullIfBlank(v.city),
      state: nullIfBlank(v.state),
      pinCode: nullIfBlank(v.pinCode),

      maritalStatus: nullIfBlank(v.maritalStatus) ?? base?.maritalStatus ?? 'Single',
      maritalStatusSince: normalizeMaritalSince(v.maritalStatusSince),

      religion: nullIfBlank(v.religion),
      diet: nullIfBlank(v.diet),
      education: nullIfBlank(v.education),
      occupation: nullIfBlank(v.occupation),

      aadharNumber: nullIfDigitsBlank(v.aadharNumber, 12),
      panNumber: nullIfBlank(v.panNumber),
      referredBy: nullIfBlank(v.referredBy),
    };
  }

  private async openSuccessModalAndReload() {
    const alert = await this.alertCtrl.create({
      header: 'Success',
      message: 'Patient details updated successfully.',
      backdropDismiss: false,
      buttons: [
        {
          text: 'OK',
          handler: () => {
            if (this.patientId) this.loadPatient(this.patientId);
          },
        },
      ],
    });

    await alert.present();
  }

  private resetForm() {
    this.form.reset({
      fullName: '',
      gender: 'Male',
      dateOfBirth: '',
      phoneNumber: '',
      alternateNumber: '',
      email: '',
      address: '',
      city: '',
      state: '',
      pinCode: '',
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
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
    });
    await t.present();
  }
}
