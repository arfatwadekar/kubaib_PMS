import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, Subscription, takeUntil, firstValueFrom } from 'rxjs';

import { PatientService } from 'src/app/services/patient.service';
import { PatientReportPayload, PatientReportService } from 'src/app/services/patient-report.service';
import { FollowUpService, FollowUpCriteriaDto } from 'src/app/services/follow-up.service';

type TabKey = 'prelim' | 'medical' | 'followup' | 'payment' | 'reports';
type UserRole = 'Doctor' | 'Receptionist';

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
function safeStr(v: any): string {
  return (v ?? '').toString().trim();
}
function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function todayYmd(): string {
  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, '0');
  const dd = String(t.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function toIsoFromYmd(ymd: string): string {
  return new Date(`${ymd}T00:00:00.000Z`).toISOString();
}

type UiRow = { label: string; apiKey: keyof PatientReportPayload };

// =====================
// FOLLOWUP UI TYPES
// =====================
type FuVisitListItem = {
  entryId: number;
  followUpDate: string; // YYYY-MM-DD
  charge: number;
  interpretation?: string;
  temporaryProblems?: string;
  raw: any;
};

// =====================
// REPORTS TYPES
// =====================
type ReportSummary = {
  patientReportId: number;
  patientId: number;
  reportName: string;
  reportDate: string; // ISO
  labName: string;
  attachmentCount?: number;
  createdOn?: string;
};

type ReportDetail = PatientReportPayload & {
  patientReportId: number;
  attachments?: any[];
};

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
  // PATIENT PAGE STATE
  // =====================
  loading = false;
  isEditMode = false;
  patientId: number | null = null;

  private currentPatient: any = null;
  private sub = new Subscription();
  private destroy$ = new Subject<void>();

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

  // ============================================================
  // ✅ FOLLOWUP (MATCH HTML NAMES)
  // ============================================================
  fuLoading = false;
  fuCriteriaSaved = false;
  fuShowVisitForm = false;

  fuScoreCols: number[] = [];
  fuVisits: FuVisitListItem[] = [];

  private fuCriteriaFromDb: FollowUpCriteriaDto[] = [];

  private readonly FU_INIT_ROWS = 6;
  private readonly FU_ADD_STEP = 2;
  private readonly FU_MAX_ROWS = 30;

  fuCriteriaForm = this.fb.group({
    symptoms: this.fb.array([]),
  });

  fuScheduleForm = this.fb.group({
    followUpDate: [todayYmd(), Validators.required],
    charge: [0],
  });

  fuVisitForm = this.fb.group({
    followUpDate: [todayYmd(), Validators.required],
    charge: [0],
    interpretation: [''],
    temporaryProblems: [''],
    remarks: this.fb.array([]),
  });

  get fuSymptomsArr(): FormArray {
    return this.fuCriteriaForm.get('symptoms') as FormArray;
  }
  get fuRemarksArr(): FormArray {
    return this.fuVisitForm.get('remarks') as FormArray;
  }

  // =====================
  // REPORTS (CREATE + MATRIX + DROPDOWNS)
  // =====================
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

  reportLoading = false;

  reportForm: FormGroup = this.fb.group({
    reportName: [''],
    reportDate: [todayYmd()],
    labName: [''],
    referredBy: [''],
    summary: [''],
    items: this.fb.array([]),
  });

  get reportItems(): FormArray {
    return this.reportForm.get('items') as FormArray;
  }

  // ✅ dropdown data for HTML
  reportList: ReportSummary[] = []; // distinct report numbers
  reportDates: string[] = []; // all available dates (YYYY-MM-DD)

  selectedMatrixReportId: number | null = null;
  selectedCompareDates: string[] = []; // multi-select (max 5)

  // matrix state for render
  displayDates: string[] = [];
  selectedReportDate = '';
  selectedReportId: number | null = null;

  reportMatrix: Array<{
    label: string;
    apiKey: keyof PatientReportPayload;
    values: Record<string, string>;
  }> = [];

  // internal caches
  private reportSummaries: ReportSummary[] = [];
  private reportDetailsMap: Record<number, ReportDetail> = {}; // id -> detail
  private dateToReportId: Record<string, number> = {}; // date -> chosen reportId

  // =====================
  // PAYMENT (UI ONLY)
  // =====================
  payPendingAmount = 0;
  payTotalCharges = 0;
  payTotalPaid = 0;

  payHistory: Array<{ date: string; amount: number; remark?: string }> = [];

  constructor(
    private fb: FormBuilder,
    private patient: PatientService,
    private reportApi: PatientReportService,
    private fuApi: FollowUpService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private route: ActivatedRoute
  ) {}

  // =====================
  // INIT / DESTROY
  // =====================
  ngOnInit(): void {
    this.loadRoleFromStorage();
    this.ensureAllowedTab();
    this.initReportRows();
    this.initFollowUpEmpty();

    this.sub.add(
      this.route.queryParams.subscribe((qp) => {
        this.loadRoleFromStorage();

        const id = safeNum(qp?.['patientId']);
        const requestedTab = safeStr(qp?.['tab']) as TabKey;

        this.activeTab = requestedTab && this.isTabAllowed(requestedTab) ? requestedTab : 'prelim';

        if (id > 0) {
          this.isEditMode = true;
          this.patientId = id;

          this.loadPatient(id);

          if (this.activeTab === 'reports') {
            this.startNewReport();
            void this.loadReportMatrix(true);
          }

          if (this.activeTab === 'followup') {
            void this.loadFollowUpTab(false);
          }
        } else {
          this.isEditMode = false;
          this.patientId = null;
          this.currentPatient = null;

          this.resetPatientForm();
          this.resetReportForm();
          this.resetReportView();
          this.resetFollowUpView();
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
    return tab === 'prelim' || tab === 'payment' || tab === 'reports' || tab === 'followup';
  }

  isTabDisabled(tab: TabKey): boolean {
    return !this.isTabAllowed(tab);
  }

  private ensureAllowedTab() {
    if (!this.isTabAllowed(this.activeTab)) this.activeTab = 'prelim';
  }

  // =====================
  // TAB CHANGE
  // =====================
  onSegmentChange(ev: any): void {
    const nextTab = (ev?.detail?.value || 'prelim') as TabKey;

    if (!this.isTabAllowed(nextTab)) {
      void this.toast('Access denied');
      return;
    }

    this.activeTab = nextTab;

    if (this.activeTab === 'reports') {
      this.startNewReport();
      void this.loadReportMatrix(false);
    }

    if (this.activeTab === 'followup') {
      void this.loadFollowUpTab(false);
    }
  }

  // =====================
  // PRELIM INPUT HELPERS
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

        const fullName = `${safeStr(p?.firstName)} ${safeStr(p?.lastName)}`.trim() || safeStr(p?.fullName);

        this.form.patchValue({
          fullName: fullName || '',
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

        this.reportForm.patchValue({ referredBy: safeStr(p?.referredBy) }, { emitEvent: false });
      },
      error: (err) => {
        void this.toast(err?.error?.message || err?.message || 'Failed to load patient');
      },
      complete: () => (this.loading = false),
    });
  }

  // =====================
  // SUBMIT PATIENT
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
        this.resetPatientForm();
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

    const { firstName, lastName } = splitFullName(v.fullName || '');
    const phone = onlyDigits(v.phoneNumber || '').slice(0, 10);
    const alt = onlyDigits(v.alternateNumber || '').slice(0, 10);

    return {
      patientsId: base?.patientsId ?? this.patientId,
      pid: base?.pid ?? null,

      firstName: firstName.trim(),
      lastName: lastName.trim(),
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

  private resetPatientForm() {
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

  // ============================================================
  // ✅ FOLLOWUP TAB LOGIC
  // ============================================================
  private initFollowUpEmpty() {
    if (this.fuSymptomsArr.length === 0) this.addFuRows(this.FU_INIT_ROWS);
    if (this.fuRemarksArr.length === 0) this.addFuRemarkRows(this.FU_INIT_ROWS);

    this.sub.add(
      this.fuSymptomsArr.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
        if (this.fuCriteriaSaved) return;
        this.autoGrowFuCriteriaRows();
      })
    );

    this.refreshFuScoreCols();
  }

  private resetFollowUpView() {
    this.fuLoading = false;
    this.fuCriteriaSaved = false;
    this.fuShowVisitForm = false;
    this.fuVisits = [];
    this.fuCriteriaFromDb = [];

    this.fuCriteriaForm.reset();
    (this.fuCriteriaForm.get('symptoms') as FormArray).clear();

    this.fuScheduleForm.reset({ followUpDate: todayYmd(), charge: 0 });

    this.fuVisitForm.reset({
      followUpDate: todayYmd(),
      charge: 0,
      interpretation: '',
      temporaryProblems: '',
    });
    (this.fuVisitForm.get('remarks') as FormArray).clear();

    this.addFuRows(this.FU_INIT_ROWS);
    this.addFuRemarkRows(this.FU_INIT_ROWS);
    this.refreshFuScoreCols();
  }

  private addFuRows(count: number) {
    for (let i = 0; i < count; i++) {
      if (this.fuSymptomsArr.length >= this.FU_MAX_ROWS) break;
      this.fuSymptomsArr.push(this.fb.control(''));
    }
  }

  private addFuRemarkRows(count: number) {
    for (let i = 0; i < count; i++) {
      if (this.fuRemarksArr.length >= this.FU_MAX_ROWS) break;
      this.fuRemarksArr.push(this.fb.control(''));
    }
    this.refreshFuScoreCols();
  }

  private refreshFuScoreCols() {
    this.fuScoreCols = Array.from({ length: this.fuRemarksArr.length }, (_, i) => i + 1);
  }

  onCriteriaInput(i: number) {
    if (this.fuCriteriaSaved) return;

    const isLast = i === this.fuSymptomsArr.length - 1;
    if (!isLast) return;

    const v = (this.fuSymptomsArr.at(i).value ?? '').toString().trim();
    if (!v) return;

    this.addFuRows(this.FU_ADD_STEP);
    this.addFuRemarkRows(this.FU_ADD_STEP);
  }

  private autoGrowFuCriteriaRows() {
    const len = this.fuSymptomsArr.length;
    if (!len) return;
    const last = (this.fuSymptomsArr.at(len - 1).value ?? '').toString().trim();
    if (!last) return;
    this.addFuRows(this.FU_ADD_STEP);
    this.addFuRemarkRows(this.FU_ADD_STEP);
  }

  private async loadFollowUpTab(debug = false) {
    if (!this.patientId) return;

    this.fuLoading = true;
    try {
      await this.loadFollowUpCriteria(debug);
      await this.loadFollowUpVisits(debug);
      this.fuShowVisitForm = false;
    } catch (e: any) {
      await this.toast(e?.error?.message || e?.message || 'Failed to load follow up');
    } finally {
      this.fuLoading = false;
    }
  }

  private async loadFollowUpCriteria(debug = false) {
    if (!this.patientId) return;

    const res: any = await firstValueFrom(this.fuApi.getCriteriaByPatient(this.patientId));
    const list = this.extractArray(res);

    this.fuCriteriaFromDb = (Array.isArray(list) ? list : []) as FollowUpCriteriaDto[];
    this.fuCriteriaSaved = this.fuCriteriaFromDb.length > 0;

    if (this.fuCriteriaSaved) {
      const names = this.fuCriteriaFromDb
        .map((x: any) => (x?.criteriaName ?? '').toString().trim())
        .filter(Boolean);

      while (this.fuSymptomsArr.length < names.length) this.addFuRows(this.FU_ADD_STEP);
      while (this.fuRemarksArr.length < names.length) this.addFuRemarkRows(this.FU_ADD_STEP);

      for (let i = 0; i < this.fuSymptomsArr.length; i++) {
        this.fuSymptomsArr.at(i).setValue(names[i] || '', { emitEvent: false });
        this.fuSymptomsArr.at(i).disable({ emitEvent: false });
      }
    } else {
      for (let i = 0; i < this.fuSymptomsArr.length; i++) {
        this.fuSymptomsArr.at(i).enable({ emitEvent: false });
      }
    }

    if (debug) {
      console.group('[FOLLOWUP][CRITERIA]');
      console.log(res);
      console.table(
        this.fuCriteriaFromDb.map((x: any) => ({
          id: safeNum(x?.patientFollowUpCriteriaId),
          name: x?.criteriaName,
        }))
      );
      console.groupEnd();
    }
  }

  private async loadFollowUpVisits(debug = false) {
    if (!this.patientId) return;

    const res: any = await firstValueFrom(this.fuApi.getFollowUpsByPatient(this.patientId));
    const list = this.extractArray(res);

    const rows: FuVisitListItem[] = (Array.isArray(list) ? list : []).map((x: any) => ({
      entryId: safeNum(x?.patientFollowUpEntryId ?? x?.entryId ?? x?.id),
      followUpDate: this.toYmdSafe(x?.followUpDate ?? x?.date),
      charge: safeNum(x?.charge ?? x?.consultationCharges ?? x?.amount),
      interpretation: safeStr(x?.interpretation),
      temporaryProblems: safeStr(x?.temporaryProblems),
      raw: x,
    }));

    rows.sort((a, b) => (b.followUpDate || '').localeCompare(a.followUpDate || ''));
    this.fuVisits = rows;

    if (debug) {
      console.group('[FOLLOWUP][VISITS]');
      console.log(res);
      console.table(this.fuVisits.map((v) => ({ id: v.entryId, date: v.followUpDate, charge: v.charge })));
      console.groupEnd();
    }
  }

  async saveFirstVisitFollowUp() {
    if (!this.patientId) {
      await this.toast('PatientId missing. Open patient in edit mode.');
      return;
    }

    if (this.fuScheduleForm.invalid) {
      this.fuScheduleForm.markAllAsTouched();
      await this.toast('Follow up date required');
      return;
    }

    const names = (this.fuCriteriaForm.getRawValue().symptoms || [])
      .map((x: any) => (x ?? '').toString().trim())
      .filter(Boolean);

    if (names.length === 0) {
      await this.toast('Enter at least 1 symptom');
      return;
    }

    this.fuLoading = true;
    try {
      await firstValueFrom(
        this.fuApi.createCriteria({
          patientId: this.patientId,
          criteriaNames: names,
        })
      );

      await this.loadFollowUpCriteria(false);

      const followUpDate = (this.fuScheduleForm.value.followUpDate || todayYmd()).toString();
      const charge = safeNum(this.fuScheduleForm.value.charge || 0);

      await this.createFollowUpEntrySimple(followUpDate, charge);
      await this.createAppointment(followUpDate);
      await this.loadFollowUpVisits(false);

      await this.toast('Saved');
    } catch (e: any) {
      await this.presentSimpleAlert('Save Failed', e?.error?.message || e?.message || 'Failed to save');
    } finally {
      this.fuLoading = false;
    }
  }

  openFollowUpVisit() {
    if (!this.patientId) return;
    this.fuShowVisitForm = true;

    this.fuVisitForm.patchValue(
      {
        followUpDate: todayYmd(),
        charge: 0,
        interpretation: '',
        temporaryProblems: '',
      },
      { emitEvent: false }
    );

    this.fuRemarksArr.controls.forEach((c) => c.setValue('', { emitEvent: false }));
    this.refreshFuScoreCols();
  }

  closeVisitForm() {
    this.fuShowVisitForm = false;
  }

  async saveFollowUpVisit() {
    if (!this.patientId) return;

    if (this.fuVisitForm.invalid) {
      this.fuVisitForm.markAllAsTouched();
      await this.toast('Please select Follow Up date.');
      return;
    }

    if (!this.fuCriteriaSaved) {
      await this.toast('Please save criteria first.');
      return;
    }

    this.fuLoading = true;
    try {
      await this.createFollowUpEntryFromVisitForm();
      await this.createAppointment((this.fuVisitForm.value.followUpDate || todayYmd()).toString());
      await this.loadFollowUpVisits(false);

      this.fuShowVisitForm = false;
      await this.toast('Saved');
    } catch (e: any) {
      await this.presentSimpleAlert('Save Failed', e?.error?.message || e?.message || 'Failed to save');
    } finally {
      this.fuLoading = false;
    }
  }

  private async createFollowUpEntrySimple(dateYmd: string, charge: number) {
    const criteria = this.fuCriteriaFromDb.map((c: any) => ({
      id: safeNum(c?.patientFollowUpCriteriaId),
      name: safeStr(c?.criteriaName),
    }));

    const statusRecords = criteria.map((c, idx) => ({
      patientFollowUpStatusId: 0,
      patientFollowUpCriteriaId: c.id,
      criteriaName: c.name || `Criteria ${idx + 1}`,
      remarks: '',
    }));

    const payload: any = {
      patientFollowUpEntryId: 0,
      patientId: this.patientId!,
      followUpDate: toIsoFromYmd(dateYmd),
      interpretation: '',
      temporaryProblems: '',
      charge: charge || 0,
      statusRecords,
    };

    await firstValueFrom(this.fuApi.createFollowUp(payload));
  }

  private async createFollowUpEntryFromVisitForm() {
    const v = this.fuVisitForm.getRawValue();

    const criteria = this.fuCriteriaFromDb.map((c: any) => ({
      id: safeNum(c?.patientFollowUpCriteriaId),
      name: safeStr(c?.criteriaName),
    }));

    const remarks = (v.remarks || []).map((x: any) => (x ?? '').toString());
    while (remarks.length < criteria.length) remarks.push('');

    const statusRecords = criteria.map((c, idx) => ({
      patientFollowUpStatusId: 0,
      patientFollowUpCriteriaId: c.id,
      criteriaName: c.name || `Criteria ${idx + 1}`,
      remarks: remarks[idx] || '',
    }));

    const payload: any = {
      patientFollowUpEntryId: 0,
      patientId: this.patientId!,
      followUpDate: toIsoFromYmd((v.followUpDate || todayYmd()).toString()),
      interpretation: safeStr(v.interpretation),
      temporaryProblems: safeStr(v.temporaryProblems),
      charge: safeNum(v.charge || 0),
      statusRecords,
    };

    await firstValueFrom(this.fuApi.createFollowUp(payload));
  }

  private async createAppointment(dateYmd: string) {
    const payload: any = {
      patientId: this.patientId!,
      appointmentDate: dateYmd,
      appointmentTime: '00:00:00',
      remark: 'Auto-created from Follow Up',
    };
    await firstValueFrom(this.fuApi.createAppointment(payload));
  }

  private toYmdSafe(v: any): string {
    const s = (v ?? '').toString().trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.includes('T')) return s.slice(0, 10);

    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // =====================
  // REPORTS: CREATE FORM
  // =====================
  private initReportRows() {
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

  private resetReportForm() {
    this.reportForm.reset({
      reportName: '',
      reportDate: todayYmd(),
      labName: '',
      referredBy: '',
      summary: '',
    });
    this.initReportRows();
  }

  startNewReport() {
    if (!this.patientId) {
      void this.toast('Open patient in edit mode to create report');
      return;
    }

    this.selectedReportDate = '';
    this.selectedReportId = null;

    this.reportForm.patchValue(
      {
        reportName: '',
        reportDate: todayYmd(),
        labName: '',
        referredBy: safeStr(this.form.value.referredBy),
        summary: '',
      },
      { emitEvent: false }
    );

    this.initReportRows();
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

    payload.reportName = safeStr(raw.reportName);
    payload.labName = safeStr(raw.labName);
    payload.referredBy = safeStr(raw.referredBy);
    payload.summary = safeStr(raw.summary);

    payload.reportDate = raw.reportDate ? new Date(raw.reportDate).toISOString() : new Date().toISOString();

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
          await this.toast(res?.message || 'Report saved successfully.');
          await this.loadReportMatrix(false);
          this.startNewReport();
        },
        error: async (err) => {
          this.reportLoading = false;
          await this.presentSimpleAlert('Save Failed', err?.error?.message || err?.message || 'Failed to save report.');
        },
      });
  }

  // =====================
  // REPORTS: MATRIX (dropdown-driven, From/To removed)
  // =====================
  async loadReportMatrix(debug = false) {
    if (!this.patientId) return;

    this.reportLoading = true;
    try {
      const res: any = await firstValueFrom(this.reportApi.getByPatient(this.patientId));
      const list = this.extractArray(res);

      this.reportSummaries = (Array.isArray(list) ? list : [])
        .map((x: any) => ({
          patientReportId: safeNum(x?.patientReportId ?? x?.reportId ?? x?.id),
          patientId: safeNum(x?.patientId),
          reportName: safeStr(x?.reportName),
          reportDate: safeStr(x?.reportDate),
          labName: safeStr(x?.labName),
          attachmentCount: safeNum(x?.attachmentCount),
          createdOn: safeStr(x?.createdOn),
        }))
        .filter((x) => x.patientReportId > 0 && !!x.reportDate);

      // for dropdown 1
      this.reportList = [...this.reportSummaries].sort((a, b) => b.patientReportId - a.patientReportId);

      // for dropdown 2 (dates)
      this.reportDates = Array.from(
        new Set(this.reportSummaries.map((r) => this.toYmdReport(r.reportDate)).filter(Boolean))
      ).sort();

      // default: latest 1 report selected, latest 1 date selected
      if (!this.selectedMatrixReportId && this.reportList.length) {
        this.selectedMatrixReportId = this.reportList[0].patientReportId;
      }

      if (!this.selectedCompareDates?.length && this.reportDates.length) {
        this.selectedCompareDates = this.reportDates.slice(Math.max(0, this.reportDates.length - 1));
      }

      // build matrix based on current selections
      await this.applyMatrixSelections();

      if (debug) {
        console.log('[REPORTS] reportList:', this.reportList.length);
        console.log('[REPORTS] reportDates:', this.reportDates);
        console.log('[REPORTS] selectedMatrixReportId:', this.selectedMatrixReportId);
        console.log('[REPORTS] selectedCompareDates:', this.selectedCompareDates);
      }
    } catch (err: any) {
      await this.toast(err?.error?.message || err?.message || 'Failed to load reports');
    } finally {
      this.reportLoading = false;
    }
  }

  onMatrixReportChange() {
    void this.applyMatrixSelections();
  }

  onCompareDatesChange(ev: any) {
    // max 5 dates
    const v = (ev?.detail?.value || []) as string[];
    if (v.length > 5) {
      // keep last 5
      const fixed = v.slice(v.length - 5);
      this.selectedCompareDates = fixed;
      void this.toast('Max 5 dates allowed');
    } else {
      this.selectedCompareDates = v;
    }
    void this.applyMatrixSelections();
  }

  clearCompareSelection() {
    this.selectedMatrixReportId = null;
    this.selectedCompareDates = [];
    this.displayDates = [];
    this.reportMatrix = [];
    this.selectedReportDate = '';
    this.selectedReportId = null;
    this.dateToReportId = {};
  }

  private async applyMatrixSelections() {
    // decide displayDates
    const dates = (this.selectedCompareDates || [])
      .map((d) => (d || '').toString().trim())
      .filter(Boolean)
      .slice(0, 5)
      .sort();

    this.displayDates = dates;

    // if no dates => clear table
    if (this.displayDates.length === 0) {
      this.reportMatrix = [];
      this.dateToReportId = {};
      this.selectedReportDate = '';
      this.selectedReportId = null;
      return;
    }

    // choose report id for each date:
    // ✅ if reportNo selected, use it for all selected dates (but only if that report is on that date)
    // ✅ else use latest report of that date
    this.dateToReportId = {};
    for (const d of this.displayDates) {
      const candidates = this.reportSummaries.filter((r) => this.toYmdReport(r.reportDate) === d);

      let chosenId = 0;
      if (this.selectedMatrixReportId) {
        const exact = candidates.find((c) => c.patientReportId === this.selectedMatrixReportId);
        if (exact) chosenId = exact.patientReportId;
      }
      if (!chosenId) {
        // pick latest by ISO
        const best = candidates.sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''))[0];
        chosenId = best?.patientReportId || 0;
      }

      if (chosenId) this.dateToReportId[d] = chosenId;
    }

    // prefetch details
    await this.prefetchDetails(Object.values(this.dateToReportId));

    // build matrix
    this.reportMatrix = this.rowsMeta.map((meta) => {
      const values: Record<string, string> = {};
      for (const d of this.displayDates) {
        const id = this.dateToReportId[d];
        const det = this.reportDetailsMap[id];
        const raw = det ? String((det as any)?.[meta.apiKey] ?? '') : '';
        values[d] = raw.trim() ? raw.trim() : '-';
      }
      return { label: meta.label, apiKey: meta.apiKey, values };
    });

    // keep selection valid
    if (this.selectedReportDate && !this.displayDates.includes(this.selectedReportDate)) {
      this.selectedReportDate = '';
      this.selectedReportId = null;
    }
  }

  private async prefetchDetails(ids: number[]) {
    const uniq = Array.from(new Set((ids || []).filter((x) => !!x)));
    const missing = uniq.filter((id) => !this.reportDetailsMap[id]);

    if (missing.length === 0) return;

    await Promise.all(
      missing.map(async (id) => {
        const res: any = await firstValueFrom(this.reportApi.getById(id));
        const det = (res?.data ?? res) as ReportDetail;
        this.reportDetailsMap[id] = det;
      })
    );
  }

  onDateHeaderClick(dateYmd: string) {
    const id = this.dateToReportId[dateYmd];
    if (!id) return;

    const det = this.reportDetailsMap[id];
    if (!det) return;

    this.selectedReportDate = dateYmd;
    this.selectedReportId = id;

    this.fillCreateFormFromDetail(det);
  }

  private fillCreateFormFromDetail(r: any) {
    this.reportForm.patchValue(
      {
        reportName: safeStr(r?.reportName),
        reportDate: this.toYmdReport(r?.reportDate),
        labName: safeStr(r?.labName),
        referredBy: safeStr(r?.referredBy),
        summary: safeStr(r?.summary),
      },
      { emitEvent: false }
    );

    this.reportItems.controls.forEach((ctrl) => {
      const key = ctrl.get('apiKey')?.value as keyof PatientReportPayload;
      const val = String(r?.[key] ?? '');
      ctrl.patchValue({ value: val }, { emitEvent: false });
    });
  }

  private toYmdReport(iso: any): string {
    const s = (iso ?? '').toString().trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.includes('T')) return s.slice(0, 10);
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return '';
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private resetReportView() {
    this.reportList = [];
    this.reportDates = [];
    this.selectedMatrixReportId = null;
    this.selectedCompareDates = [];
    this.displayDates = [];
    this.reportMatrix = [];
    this.reportSummaries = [];
    this.reportDetailsMap = {};
    this.dateToReportId = {};
    this.selectedReportDate = '';
    this.selectedReportId = null;
  }

  // =====================
  // PAYMENT
  // =====================
  openAddPayment() {
    void this.toast('Add Payment (UI only)');
  }

  goPrevFollowUp() {
    const prev: TabKey = 'followup';
    if (!this.isTabAllowed(prev)) {
      void this.toast('Access denied');
      return;
    }
    this.activeTab = prev;
  }

  finalizePatient() {
    this.submit();
  }

  // =====================
  // UTIL
  // =====================
  private extractArray(res: any): any[] {
    const list = res?.data ?? res?.list ?? res?.result ?? res?.items ?? res ?? [];
    return Array.isArray(list) ? list : [];
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
    });
    await t.present();
  }

  private async presentSimpleAlert(header: string, message: string) {
    const a = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await a.present();
  }

  // ========= template helpers (REQUIRED by HTML) =========
  trackByIndex(index: number) {
    return index;
  }

  // Demo helper (if HTML calls autoFill())
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

  // Reports demo helper (if HTML calls autoFillReport())
  autoFillReport() {
    if (!this.patientId) return;

    this.reportForm.patchValue({
      reportName: '',
      reportDate: todayYmd(),
      labName: '',
      referredBy: safeStr(this.form.value.referredBy),
      summary: '',
    });

    const map: Record<string, string> = {
      cholesterolTotal: '130',
      hdl: '30',
      ldl: '135',
      triglycerides: '264',
      ppbs: '81',
      creatinine: '0.7',
      hb: '13.7',
      wbc: '6100',
      plateletCount: '306',
      urineRoutine: '5-10',
      uricAcid: '9.85',
      cpk: '17.9',
      cK_MB: '9.20',
    };

    this.reportItems.controls.forEach((ctrl) => {
      const key = String(ctrl.get('apiKey')?.value || '');
      if (map[key] !== undefined) {
        ctrl.patchValue({ value: map[key] }, { emitEvent: false });
      }
    });
  }

  // Buttons in HTML expect these names
  goPrevPhysicalExam() {
    const prev: TabKey = 'medical';
    if (!this.isTabAllowed(prev)) {
      void this.toast('Access denied');
      return;
    }
    this.activeTab = prev;
  }

  goNextPayment() {
    const next: TabKey = 'payment';
    if (!this.isTabAllowed(next)) {
      void this.toast('Access denied');
      return;
    }
    this.activeTab = next;
  }
}
