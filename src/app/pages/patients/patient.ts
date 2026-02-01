import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { PatientService } from 'src/app/services/patient.service';

type TabKey = 'prelim' | 'medical' | 'followup' | 'payment' | 'identity';
type UserRole = 'Doctor' | 'Receptionist';

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
  if (/^\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return toIso(s);
  return s;
}

@Component({
  selector: 'app-patient',
  templateUrl: './patient.html',
  styleUrls: ['./patient.scss'],
  standalone: false,
})
export class PatientPage implements OnInit, OnDestroy {
  // =====================
  // ROLE + TABS
  // =====================
  role: UserRole = 'Receptionist';
  activeTab: TabKey = 'prelim';

  // =====================
  // PRELIM FORM STATE
  // =====================
  loading = false;
  isEditMode = false;
  patientId: number | null = null;

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
    // ✅ ROLE must come from localStorage
    this.loadRoleFromStorage();
    this.ensureAllowedTab();

    // if opened with patientId => edit mode
 this.sub.add(
  this.route.queryParams.subscribe((qp) => {
    // ✅ always refresh role (in case login changed)
    this.loadRoleFromStorage();

    const id = Number(qp?.['patientId'] ?? 0) || 0;

    // ✅ requested tab from dashboard
    const requestedTab = String(qp?.['tab'] || '').trim() as TabKey;

    // if tab is valid and allowed, open it; else fallback
    if (requestedTab && this.isTabAllowed(requestedTab)) {
      this.activeTab = requestedTab;
    } else {
      this.activeTab = 'prelim';
    }

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

  // =====================
  // ROLE LOAD
  // =====================
  private loadRoleFromStorage() {
    const raw = (localStorage.getItem('mhc_role') || '').trim().toLowerCase();
    this.role = raw === 'doctor' ? 'Doctor' : 'Receptionist';
  }

  // =====================
  // TAB PERMISSIONS
  // =====================
  isTabAllowed(tab: TabKey): boolean {
    if (this.role === 'Doctor') return true; // ✅ doctor all access
    return tab === 'prelim' || tab === 'payment' || tab === 'identity'; // ✅ receptionist limited
  }

  isTabDisabled(tab: TabKey): boolean {
    return !this.isTabAllowed(tab);
  }

  private ensureAllowedTab() {
    if (!this.isTabAllowed(this.activeTab)) this.activeTab = 'prelim';
  }

  // =====================
  // TAB ACTIONS
  // =====================
  onSegmentChange(ev: any): void {
    const nextTab = (ev?.detail?.value || 'prelim') as TabKey;

    if (!this.isTabAllowed(nextTab)) {
      this.toast('Access denied');
      // revert visual selection
      setTimeout(() => (this.activeTab = this.activeTab), 0);
      return;
    }

    this.activeTab = nextTab;
  }

  goTab(tab: TabKey): void {
    if (!this.isTabAllowed(tab)) {
      this.toast('Access denied');
      return;
    }
    this.activeTab = tab;
  }

  navigateToTab(tab: TabKey): void {
    this.goTab(tab);
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
      error: (err) =>
        this.toast(err?.error?.message || err?.message || 'Failed to load patient'),
      complete: () => (this.loading = false),
    });
  }

  // =====================
  // SUBMIT
  // =====================
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

    // update
    if (this.isEditMode && this.patientId) {
      const payload = this.buildUpdatePayload();
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

    // create
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

  private buildUpdatePayload() {
    const base = this.currentPatient || {};
    const v = this.form.value;

    const { firstName, lastName } = splitFullName(v.fullName || '');
    const phone = onlyDigits(v.phoneNumber || '').slice(0, 10);
    const alt = onlyDigits(v.alternateNumber || '').slice(0, 10);

    return {
      patientsId: base?.patientsId ?? this.patientId,
      pid: base?.pid ?? null,

      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: toIso(v.dateOfBirth || ''),
      gender: (v.gender || base?.gender || 'Male').toString(),

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
      duration: 2000,
      position: 'top',
    });
    await t.present();
  }

  // =====================
  // AUTO FILL (demo)
  // =====================
  autoFill() {
    this.form.patchValue({
      fullName: 'Test Patient',
      gender: 'Male',
      dateOfBirth: '1995-01-01',
      phoneNumber: '9999999999',
      city: 'Mumbai',
      state: 'MH',
    });
  }
}
