import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { PatientService } from 'src/app/services/patient.service';

// =====================
// Helpers
// =====================
function onlyDigits(v: string) {
  return (v || '').replace(/\D/g, '');
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
  if (/^\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return toIso(s);
  return s;
}
function safeStr(v: any): string {
  return (v ?? '').toString().trim();
}
function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type UserRole = 'Doctor' | 'Receptionist';

/* =========================
   COMPONENT
========================= */

@Component({
  selector: 'app-prelim',
  templateUrl: './prelim.page.html',
  styleUrls: ['./prelim.page.scss'],
  standalone: false,
})
export class PrelimPage implements OnInit, OnDestroy {
 // =====================
  // STATE
  // =====================
  loading = false;
  isEditMode = false;
  patientId: number | null = null;
  role: UserRole = 'Receptionist';
  today = new Date().toLocaleDateString('en-GB');

  showSuccessModal = false;
  successMode: 'create' | 'update' = 'create';
  successPatient: any = null;

  private currentPatient: any = null;
  private sub = new Subscription();

  // =====================
  // FORM
  // =====================
  form = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],

    gender: ['Male', [Validators.required]],
    dateOfBirth: ['', [Validators.required]],
    age: [{ value: '', disabled: true }],

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
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  // =====================
  // INIT / DESTROY
  // =====================
  ngOnInit(): void {
    this.loadRoleFromStorage();
    this.initAgeAutoCalculation();

    this.sub.add(
      this.route.queryParams.subscribe((qp) => {
        this.loadRoleFromStorage();

        const id = safeNum(qp?.['patientId']);

        if (id > 0) {
          this.isEditMode = true;
          this.patientId = id;
          this.loadPatient(id);
        } else {
          this.isEditMode = false;
          this.patientId = null;
          this.currentPatient = null;
          this.resetPatientForm();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // =====================
  // ROLE
  // =====================
  private loadRoleFromStorage() {
    const raw = (localStorage.getItem('mhc_role') || '').trim().toLowerCase();
    this.role = raw === 'doctor' ? 'Doctor' : 'Receptionist';
  }

  // =====================
  // AGE AUTO CALC
  // =====================
  private initAgeAutoCalculation() {
    this.form.get('dateOfBirth')?.valueChanges.subscribe((dob) => {
      if (!dob) {
        this.form.patchValue({ age: '' }, { emitEvent: false });
        return;
      }

      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      this.form.patchValue({ age: age.toString() }, { emitEvent: false });
    });
  }

  // =====================
  // INPUT HELPERS
  // =====================
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

  // =====================
  // LOAD PATIENT
  // =====================
  private loadPatient(id: number) {
    this.loading = true;

    this.patient.getPatientById(id).subscribe({
      next: (res: any) => {
        const p = res?.data ?? res;
        this.currentPatient = p;
        this.resetPatientForm();

        this.form.patchValue({
          firstName: safeStr(p?.firstName),
          lastName: safeStr(p?.lastName),
          gender: safeStr(p?.gender) || 'Male',
          dateOfBirth: toDateInput(p?.dateOfBirth),
          phoneNumber: safeStr(p?.phoneNumber),
          alternateNumber: safeStr(p?.alternateNumber),
          email: safeStr(p?.email),
          address: safeStr(p?.address),
          city: safeStr(p?.city),
          state: safeStr(p?.state),
          pinCode: safeStr(p?.pinCode),
          maritalStatus: safeStr(p?.maritalStatus) || 'Single',
          maritalStatusSince: toDateInput(p?.maritalStatusSince),
          religion: safeStr(p?.religion),
          diet: safeStr(p?.diet),
          education: safeStr(p?.education),
          occupation: safeStr(p?.occupation),
          aadharNumber: safeStr(p?.aadharNumber),
          panNumber: safeStr(p?.panNumber),
          referredBy: safeStr(p?.referredBy),
        });
      },
      error: (err) => {
        void this.toast(err?.error?.message || err?.message || 'Failed to load patient');
      },
      complete: () => (this.loading = false),
    });
  }

  // =====================
  // SUBMIT
  // =====================
  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      void this.toast('Full Name, DOB and Phone Number (10 digits) are required.');
      return;
    }

    const phone = onlyDigits(this.form.value.phoneNumber || '').slice(0, 10);
    if (phone.length !== 10) {
      void this.toast('Phone Number must be exactly 10 digits.');
      return;
    }

    this.loading = true;

    // UPDATE
    if (this.isEditMode && this.patientId) {
      const payload = this.buildUpdatePayload();

      this.patient.updatePatient(this.patientId, payload).subscribe({
        next: async () => {
          this.loading = false;
          this.successMode = 'update';
          this.successPatient = this.currentPatient;
          this.showSuccessModal = true;

          if (this.patientId) this.loadPatient(this.patientId);
        },
        error: (err) => {
          this.loading = false;
          void this.toast(err?.error?.message || err?.message || 'Update Patient failed');
        },
      });

      return;
    }

    // CREATE
    const payload = this.buildCreatePayload();

    this.patient.createPatient(payload).subscribe({
      next: async (res: any) => {
        this.loading = false;
        const created = res?.data ?? res;

        this.successMode = 'create';
        this.successPatient = created;
        this.showSuccessModal = true;

        this.patientId = created?.patientsId || created?.patientId;
        this.isEditMode = true;
      },
      error: (err) => {
        this.loading = false;
        void this.toast(err?.error?.message || err?.message || 'Create Patient failed');
      },
    });
  }

  closeSuccessModal() {
    this.showSuccessModal = false;

    if (this.successMode === 'create') {
      this.router.navigate(['/patients/list']);
    }
  }

  // =====================
  // PAYLOAD BUILDERS
  // =====================
  private buildCreatePayload() {
    const v = this.form.value;
    const phone = onlyDigits(v.phoneNumber || '').slice(0, 10);
    const alt = onlyDigits(v.alternateNumber || '').slice(0, 10);

    return {
      firstName: safeStr(v.firstName),
      lastName: safeStr(v.lastName),
      dateOfBirth: toIso(v.dateOfBirth || ''),
      gender: safeStr(v.gender) || 'Male',

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

  private buildUpdatePayload() {
    const base = this.currentPatient || {};
    const v = this.form.value;
    const phone = onlyDigits(v.phoneNumber || '').slice(0, 10);
    const alt = onlyDigits(v.alternateNumber || '').slice(0, 10);

    return {
      patientsId: base?.patientsId ?? this.patientId,
      pid: base?.pid ?? null,

      firstName: safeStr(v.firstName),
      lastName: safeStr(v.lastName),
      dateOfBirth: toIso(v.dateOfBirth || ''),
      gender: safeStr(v.gender) || safeStr(base?.gender) || 'Male',

      phoneNumber: phone,
      alternateNumber: alt.length === 10 ? alt : phone,

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

  // =====================
  // RESET FORM
  // =====================
  private resetPatientForm() {
    this.form.reset({
      firstName: '',
      lastName: '',
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

  // =====================
  // AUTOFILL (demo)
  // =====================
  autoFill() {
    this.form.patchValue({
      firstName: 'Test Patient',
      gender: 'Male',
      dateOfBirth: '1995-01-01',
      phoneNumber: '9999999999',
      city: 'Mumbai',
      state: 'MH',
    });
  }

  // =====================
  // UTIL
  // =====================
  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, position: 'top' });
    await t.present();
  }
}
