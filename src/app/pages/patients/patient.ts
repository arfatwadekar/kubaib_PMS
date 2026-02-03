import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, Subscription, takeUntil } from 'rxjs';

import { PatientService } from 'src/app/services/patient.service';
import {
  PatientReportPayload,
  PatientReportService,
} from 'src/app/services/patient-report.service';

type TabKey = 'prelim' | 'medical' | 'followup' | 'payment' | 'reports';
type UserRole = 'Doctor' | 'Receptionist';
type UiRow = { label: string; apiKey: keyof PatientReportPayload };

// =====================
// Helpers
// =====================
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
  // PATIENT FORM
  // =====================
  loading = false;
  isEditMode = false;
  patientId: number | null = null;

  private currentPatient: any = null;
  private sub = new Subscription();
  private destroy$ = new Subject<void>();

  get canEditReport(): boolean {
    return this.role === 'Doctor';
  }

  // =====================
  // PRELIM FORM
  // =====================
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

  // =====================
  // REPORTS (CREATE ONLY)
  // =====================
  reportLoading = false;

  rowsMeta: UiRow[] = [
    { label: 'Cholesterol Total', apiKey: 'cholesterolTotal' },
    { label: 'HDL', apiKey: 'hdl' },
    { label: 'LDL', apiKey: 'ldl' },
    { label: 'Triglycerides', apiKey: 'triglycerides' },
    { label: 'Lipoprotein (a)', apiKey: 'lipoprotein_a' },
    { label: 'PPBS', apiKey: 'ppbs' },
    { label: 'FBS', apiKey: 'fbs' },
    { label: 'HbA1c', apiKey: 'hbA1C' },
    { label: 'Creatinine', apiKey: 'creatinine' },
    { label: 'BUN / Urea', apiKey: 'buN_Urea' },
    { label: 'eGFR', apiKey: 'eGFR' },
    { label: 'Hb', apiKey: 'hb' },
    { label: 'WBC', apiKey: 'wbc' },
    { label: 'Platelet Count', apiKey: 'plateletCount' },
    { label: 'Eosinophil Count', apiKey: 'eosinophilCount' },
    { label: 'ESR', apiKey: 'esr' },
    { label: 'Urine Routine', apiKey: 'urineRoutine' },
    { label: 'Uric Acid', apiKey: 'uricAcid' },
    { label: 'Vitamin D3', apiKey: 'vitaminD3' },
    { label: 'Serum Iron', apiKey: 'serumIron' },
    { label: 'TIBC', apiKey: 'tibc' },
    { label: 'Iron Saturation', apiKey: 'ironSaturation' },
    { label: 'CK-MB', apiKey: 'cK_MB' },
    { label: 'CPK', apiKey: 'cpk' },
    { label: 'Troponin', apiKey: 'troponin' },
    { label: 'NT Pro BNP', apiKey: 'ntProBNP' },
    { label: 'PT', apiKey: 'pt' },
    { label: 'INR', apiKey: 'inr' },
    { label: 'TSH', apiKey: 'tsh' },
    { label: 'T3', apiKey: 't3' },
    { label: 'T4', apiKey: 't4' },
    { label: 'Sodium (Na)', apiKey: 'sodium' },
    { label: 'Potassium (K)', apiKey: 'potassium' },
    { label: 'Chloride (Cl)', apiKey: 'chloride' },
    { label: 'Serum Calcium', apiKey: 'serumCalcium' },
    { label: 'R. A. Test', apiKey: 'rA_Test' },
    { label: 'Bilirubin', apiKey: 'bilirubin' },
    { label: 'SGOT', apiKey: 'sgot' },
    { label: 'SGPT', apiKey: 'sgpt' },
    { label: 'Total Protein', apiKey: 'totalProtein' },
    { label: 'Albumin', apiKey: 'albumin' },
    { label: 'Globulin', apiKey: 'globulin' },
    { label: 'HIV', apiKey: 'hiv' },
    { label: 'HCV', apiKey: 'hcv' },
  ];

  reportForm: FormGroup = this.fb.group({
    reportName: [''],
    reportDate: [''], // YYYY-MM-DD
    labName: [''],
    referredBy: [''],
    summary: [''],
    items: this.fb.array([]),
  });

  get reportItems(): FormArray {
    return this.reportForm.get('items') as FormArray;
  }

  constructor(
    private fb: FormBuilder,
    private patient: PatientService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private route: ActivatedRoute,
    private reportApi: PatientReportService
  ) {}

  // =====================
  // INIT / DESTROY
  // =====================
  ngOnInit(): void {
    this.loadRoleFromStorage();
    this.ensureAllowedTab();

    // ✅ report rows init
    this.buildReportRows();

    this.sub.add(
      this.route.queryParams.subscribe((qp) => {
        this.loadRoleFromStorage();

        const id = Number(qp?.['patientId'] ?? 0) || 0;
        const requestedTab = String(qp?.['tab'] || '').trim() as TabKey;

        this.activeTab =
          requestedTab && this.isTabAllowed(requestedTab) ? requestedTab : 'prelim';

        if (id > 0) {
          this.isEditMode = true;
          this.patientId = id;
          this.loadPatient(id);
        } else {
          this.isEditMode = false;
          this.patientId = null;
          this.currentPatient = null;
          this.resetForm();
          this.resetReportFormOnly();
        }

        // ✅ if user opens reports tab, prepare form
        if (this.activeTab === 'reports') {
          this.startNewReport();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =====================
  // ROLE + TAB PERMISSIONS
  // =====================
  private loadRoleFromStorage() {
    const raw = (localStorage.getItem('mhc_role') || '').trim().toLowerCase();
    this.role = raw === 'doctor' ? 'Doctor' : 'Receptionist';
  }

  isTabAllowed(tab: TabKey): boolean {
    if (this.role === 'Doctor') return true;
    return tab === 'prelim' || tab === 'payment' || tab === 'reports';
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
      void this.toast('Access denied');
      return;
    }

    this.activeTab = nextTab;

    // ✅ open reports => start create form
    if (this.activeTab === 'reports') {
      this.startNewReport();
    }
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

        // ✅ report form default
        this.reportForm.patchValue({
          referredBy: String(p?.referredBy ?? '').trim(),
        });
      },
      error: (err) =>
        void this.toast(err?.error?.message || err?.message || 'Failed to load patient'),
      complete: () => (this.loading = false),
    });
  }

  // =====================
  // SUBMIT PATIENT (CREATE/UPDATE)
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

    if (this.isEditMode && this.patientId) {
      const payload = this.buildUpdatePayload();
      this.patient.updatePatient(this.patientId, payload).subscribe({
        next: async () => {
          this.loading = false;
          await this.openSuccessModalAndReload();
        },
        error: (err) => {
          this.loading = false;
          void this.toast(err?.error?.message || err?.message || 'Update Patient failed');
        },
      });
      return;
    }

    const payload = this.buildCreatePayload();
    this.patient.createPatient(payload).subscribe({
      next: async () => {
        this.loading = false;
        await this.toast('Patient created successfully.');
        this.resetForm();
      },
      error: (err) => {
        this.loading = false;
        void this.toast(err?.error?.message || err?.message || 'Create Patient failed');
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

  // =====================
  // REPORTS: CREATE ONLY
  // =====================
  private buildReportRows() {
    this.reportItems.clear();
    this.rowsMeta.forEach((r) => {
      this.reportItems.push(
        this.fb.group({
          label: [r.label],
          apiKey: [r.apiKey],
          value: [''],
        })
      );
    });
  }

  startNewReport() {
    if (!this.patientId) {
      void this.toast('Open patient in edit mode to create report');
      return;
    }

    this.resetReportFormOnly();

    // default today's date
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    this.reportForm.patchValue({ reportDate: `${yyyy}-${mm}-${dd}` });
  }

  resetReportFormOnly() {
    const keepRef = this.reportForm.value.referredBy || this.form.value.referredBy || '';

    this.reportForm.reset({
      reportName: '',
      reportDate: '',
      labName: '',
      referredBy: keepRef,
      summary: '',
    });

    this.buildReportRows();
  }

  private emptyReportPayload(): PatientReportPayload {
    return {
      patientId: this.patientId || 0,
      reportName: '',
      reportDate: new Date().toISOString(),
      labName: '',
      referredBy: '',
      summary: '',

      cholesterolTotal: '',
      hdl: '',
      ldl: '',
      triglycerides: '',
      lipoprotein_a: '',

      ppbs: '',
      fbs: '',
      hbA1C: '',

      creatinine: '',
      buN_Urea: '',
      eGFR: '',

      hb: '',
      wbc: '',
      plateletCount: '',
      eosinophilCount: '',
      esr: '',

      urineRoutine: '',
      uricAcid: '',
      vitaminD3: '',

      serumIron: '',
      tibc: '',
      ironSaturation: '',

      cK_MB: '',
      cpk: '',
      troponin: '',
      ntProBNP: '',

      pt: '',
      inr: '',

      tsh: '',
      t3: '',
      t4: '',

      sodium: '',
      potassium: '',
      chloride: '',
      serumCalcium: '',

      rA_Test: '',
      bilirubin: '',
      sgot: '',
      sgpt: '',
      totalProtein: '',
      albumin: '',
      globulin: '',

      hiv: '',
      hcv: '',
    };
  }

  private buildReportPayload(): PatientReportPayload {
    const raw = this.reportForm.getRawValue();
    const payload = this.emptyReportPayload();

    payload.reportName = (raw.reportName || '').trim();
    payload.labName = (raw.labName || '').trim();
    payload.referredBy = (raw.referredBy || '').trim();
    payload.summary = (raw.summary || '').trim();

    payload.reportDate = raw.reportDate
      ? new Date(raw.reportDate).toISOString()
      : new Date().toISOString();

    (raw.items || []).forEach((r: any) => {
      const key = r?.apiKey as keyof PatientReportPayload;
      if (key) (payload as any)[key] = String(r?.value ?? '');
    });

    return payload;
  }

  async saveReport() {
    if (!this.patientId) {
      await this.toast('PatientId missing. Open patient in edit mode.');
      return;
    }
    if (this.reportLoading) return;

    const payload = this.buildReportPayload();

    this.reportLoading = true;
    this.reportApi
      .create(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (res: any) => {
          this.reportLoading = false;
          await this.toast(res?.message || 'Report created successfully.');

          // ✅ reset after create
          this.resetReportFormOnly();
        },
        error: async (err) => {
          this.reportLoading = false;

          const msg =
            err?.error?.message ||
            err?.error?.detail ||
            err?.message ||
            'Failed to create report.';

          const a = await this.alertCtrl.create({
            header: 'Save Failed',
            message: msg,
            buttons: ['OK'],
          });
          await a.present();
        },
      });
  }

  // =====================
  // Toast
  // =====================
  private async toast(message: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
    });
    await t.present();
  }

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
