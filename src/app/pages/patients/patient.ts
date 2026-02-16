import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, Subscription, takeUntil, firstValueFrom } from 'rxjs';

import { PatientService } from 'src/app/services/patient.service';
import {
  PatientReportPayload,
  PatientReportService,
} from 'src/app/services/patient-report.service';
import {
  FollowUpService,
  FollowUpCriteriaDto,
  AppointmentStatus,
} from 'src/app/services/follow-up.service';

// ✅ NEW: Clinical Case
// import { ClinicalCaseService, ClinicalCasePayload } from 'src/app/services/clinical-case.service';
import {
  MedicalExaminationService,
  ClinicalCasePayload,
} from 'src/app/services/medical-examination.service';

type TabKey = 'prelim' | 'medical' | 'followup' | 'payment' | 'reports';
type UserRole = 'Doctor' | 'Receptionist';

type Complaint = {
  complaintType: string;
  location: string;
  sensation: string;
  modality: string;
  concomitant: string;
};

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

/** UI date label: DD/MM/YYYY */
function toUiDate(isoOrDate: string): string {
  const s = (isoOrDate || '').toString().trim();
  if (!s) return '';
  const iso = s.includes('T') ? s : `${s}T00:00:00.000Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** yyyy-mm-dd key */
function toKeyYmd(isoOrDate: string): string {
  const s = (isoOrDate || '').toString().trim();
  if (!s) return '';
  if (s.includes('T')) return s.slice(0, 10);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

type UiRow = { label: string; apiKey: keyof PatientReportPayload };

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
  showSuccessModal = false;
  successMode: 'create' | 'update' = 'create';
  successPatient: any = null;
  today = new Date().toLocaleDateString('en-GB');

  // =====================
  // ROLE + TABS
  // =====================
  role: UserRole = 'Receptionist';
  activeTab: TabKey = 'prelim';

  // ✅ Medical record state
  medicalExists = false; // DB me record hai?
  medicalSaving = false; // saving indicator alag rakho (optional)

  // =====================
  // PATIENT PAGE STATE
  // =====================
  loading = false;
  isEditMode = false;
  patientId: number | null = null;
  currentAppointmentId: number | null = null;

  private currentPatient: any = null;
  private sub = new Subscription();
  private destroy$ = new Subject<void>();

  // =====================
  // PRELIM FORM
  // =====================
  form = this.fb.group({
     firstName: ['', [Validators.required, Validators.minLength(2)]],
  lastName: ['', [Validators.required, Validators.minLength(2)]],

  gender: ['Male', [Validators.required]],
  dateOfBirth: ['', [Validators.required]],
  age: [{ value: '', disabled: true }],   // ✅ Auto calculated

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
  // ✅ MEDICAL (CLINICAL CASE) FORM
  // ============================================================
  openSection: string = 's1';

  medicalForm = this.fb.group({
    complaints: this.fb.group({
      chief: this.fb.group({
        location: [''],
        sensation: [''],
        modality: [''],
        concomitant: [''],
      }),
      associated: this.fb.group({
        location: [''],
        sensation: [''],
        modality: [''],
        concomitant: [''],
      }),
      past: this.fb.group({
        location: [''],
        sensation: [''],
        modality: [''],
        concomitant: [''],
      }),
    }),

    familyHistory: this.fb.group({
      father: [''],
      mother: [''],
      paternalUncle: [''],
      maternalUncle: [''],
      paternalGrandParents: [''],
      maternalGrandParents: [''],
      brothers: [''],
      sisters: [''],
      remarks: [''],
    }),

    personalStatus: this.fb.group({
      skin: [''],
      woundHealing: [''],
      hairs: [''],
      nails: [''],
      perspiration: [''],
      thirst: [''],
      appetite: [''],
      cravings: [''],
      aversions: [''],
      addictions: [''],
      food: [''],
      fasting: [''],
      stool: [''],
      urine: [''],
      sleep: [''],
      dreams: [''],
    }),

    menstrualHistory: this.fb.group({
      menses: [''],
      beforeMenses: [''],
      betweenMenses: [''],
      afterMenses: [''],
      staining: [''],
      clots: [''],
      pads: [''],
      leucorrhoea: [''],
      pregnancy: [''],
    }),

    maleSexualFunction: this.fb.group({
      masturbation: [''],
      erection: [''],
      nocturnalEmission: [''],
    }),

    physicalReaction: this.fb.group({
      summer_Fan: [''],
      summer_AC: [''],
      summer_Coverings: [''],
      summer_Woolens: [''],
      summer_Bath: [''],
      monsoon_Fan: [''],
      monsoon_AC: [''],
      monsoon_Coverings: [''],
      monsoon_Woolens: [''],
      monsoon_Bath: [''],
      winter_Fan: [''],
      winter_AC: [''],
      winter_Coverings: [''],
      winter_Woolens: [''],
      winter_Bath: [''],
      bus: [''],
      sun: [''],
      coldAir: [''],
      draft: [''],
      wetGetting: [''],
      thermalState: [''],
    }),

    physicalExamination: this.fb.group({
      // UI keys (from your html)
      heightMeters: [''],
      weightKg: [''],
      bmi: [''],
      bmiCategory: [''],

      physicalAppearance: [''],
      dejection: [''], // map -> digestion
      temperature: [''],
      pulse: [''],
      bp: [''],
      tongue: [''],
      lips: [''],
      teeth: [''],
      gums: [''],
      nails: [''],
      skin: [''],
      glands: [''],
      nose: [''],
      throat: [''],
      trachea: [''],

      rsPercussion: [''], // map -> percussion_RS
      rr: [''],
      airEntry: [''],
      chestExpansion: [''],
      breathSounds: [''],
      spo2: [''], // map -> spO2

      paSizeShapeSkin: [''], // map -> pA_SizeShapeSkin
      paMovement: [''], // map -> pA_Movement
      paPercussion: [''], // map -> pA_Percussion
      paSoftTenderRigidGuard: [''], // map -> soft_Tenderness_Rigidity_Guarding
      bowelSound: [''],
      lump: [''],
      hst: [''], // map -> hgt (swagger)

      apexImpulse: [''],
      jvp: [''],
      thrill: [''],
      cvsPercussion: [''], // map -> percussion_CVS
      heartSounds: [''],
      murmur: [''],
      rub: [''],

      higherFunction: [''],
      motorFunction: [''],
      sensoryFunction: [''],
      cranialNerves: [''],
      reflexes: [''],
      coordination: [''],

      mskInspection: [''], // map -> inspection
      rom: [''],
      swelling: [''],
      warmth: [''],
      redness: [''],
      deformities: [''],
      crepitation: [''], // map -> crepitations
      muscleStrength: [''],

      investigations: [''],
    }),

    mentalState: this.fb.group({
      // relationship buttons
      rel_Father_Status: [''],
      rel_Mother_Status: [''],
      rel_Brother_Status: [''],
      rel_Sister_Status: [''],
      rel_Husband_Status: [''],
      rel_Wife_Status: [''],
      rel_Son_Status: [''],
      rel_Daughter_Status: [''],
      rel_PaternalGrandfather_Status: [''],
      rel_PaternalGrandmother_Status: [''],
      rel_MaternalGrandfather_Status: [''],
      rel_MaternalGrandmother_Status: [''],
      rel_FatherInLaw_Status: [''],
      rel_MotherInLaw_Status: [''],
      rel_BrotherInLaw_Status: [''],
      rel_SisterInLaw_Status: [''],
      rel_Family_Status: [''],
      rel_Work_Status: [''],
      rel_Friends_Status: [''],
      rel_Finance_Status: [''],
      rel_Social_Status: [''],
      rel_Authority_Status: [''],

      mentalStateEvaluation: [''],
      angerSadnessTriangles_Remark: [''],
      fearAnxietyTriangles_Remark: [''],

      // emotional grid remarks (your UI)
      remarkAngerSadness: [''],
      remarkAttachments: [''],
      remarkLoveHate: [''],
      remarkFearAnxiety: [''],
    }),

    intellectualState: this.fb.group({
      capacityPerformanceRatio: [0],
      perception: [''],
      memory: [''],
      thinking: [''],
      decision: [''],
      confidence: [''],
    }),

    behavioralEvaluation: this.fb.group({
      childhood_Scholastic: [''],
      childhood_HomeEnvironment: [''],
      childhood_Finance: [''],
      childhood_Difficulties: [''],

      action_Speech: [''],
      action_Behaviour: [''],
      action_Description: [''],

      block_Emotional: [false],
      block_Motivational: [false],
      block_Intellectual: [false],
      block_IPR: [false],
      block_Social: [false],
      block_Domestic: [false],
      block_Work: [false],
      block_Notes: [''],

      sensory_Noise: [''],
      sensory_Odour: [''],
      sensory_Colour: [''],
      sensory_Light: [''],
      sensory_Music: [''],
      sensory_Touch: [''],
      sensory_Rubbing: [''],
      sensory_Climate: [''],

      miasmatic_Fundamental: [''],
      miasmatic_Dominant: [''],

      rubrics: [''],
      provisionalDiagnosis: [''],
      finalDiagnosis: [''],
      firstPrescription: [''],
      generalInstructions: [''],
    }),
  });

  // ============================================================
  // ✅ FOLLOWUP STEP-1 + NEXT FLOW
  // ============================================================
  fuLoading = false;
  fuCriteriaSaved = false;
  private fuCriteriaFromDb: FollowUpCriteriaDto[] = [];

  private readonly FU_INIT_ROWS = 6;
  private readonly FU_ADD_STEP = 2;
  private readonly FU_MAX_ROWS = 30;

  private readonly APPT_STATUS_AWAIT_PAYMENT =
    AppointmentStatus.AwaitingPayment;

  // ===== Waive-Off UI state =====
  waiveOffVerified = false;
  waiveOffVerifyErr = '';
  showWaveOffAmount = false;

  private waiveOffPasswordCache: string | null = null;
  fuNextPaymentError = '';

  fuCriteriaForm = this.fb.group({
    symptoms: this.fb.array([]),
  });

  fuNextApptForm = this.fb.group({
    followUpDate: [''],
    followUpTime: ['14:30:00'],
  });

  fuPaymentForm = this.fb.group({
    consultationCharges: [0, [Validators.required, Validators.min(1)]],
    waveOffAmount: [0],
    amountPaid: [0, [Validators.required, Validators.min(0)]],
    paymentMode: ['Cash', Validators.required],
    waveOffPassword: [''],
  });

  get fuSymptomsArr(): FormArray {
    return this.fuCriteriaForm.get('symptoms') as FormArray;
  }

  get fuHasAtLeastOneSymptom(): boolean {
    const names = (this.fuCriteriaForm.getRawValue().symptoms || [])
      .map((x: any) => (x ?? '').toString().trim())
      .filter(Boolean);
    return names.length > 0;
  }

  get fuCanProceedNextPayment(): boolean {
    if (!this.patientId) return false;
    if (!this.fuCriteriaSaved) return false;

    const charges = safeNum(
      this.fuPaymentForm.controls.consultationCharges.value ?? 0,
    );
    const paid = safeNum(this.fuPaymentForm.controls.amountPaid.value ?? 0);
    const wave = safeNum(this.fuPaymentForm.controls.waveOffAmount.value ?? 0);
    const mode = (this.fuPaymentForm.controls.paymentMode.value ?? '')
      .toString()
      .trim();

    if (charges <= 0) return false;
    if (!mode) return false;
    if (paid < 0 || wave < 0) return false;
    return true;
  }

  // =====================
  // REPORTS (IMAGE-LIKE ENTRY + COMPARE)
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

  reportForm: FormGroup = this.fb.group({
    reportName: [''],
    reportDate: [todayYmd()],
    labName: [''],
    referredBy: [''],
    summary: [''],
  });

  // entry UI rows
  repMode: 'entry' | 'compare' = 'entry';
  repReportDate: string = todayYmd();
  repSelectedPrevReportId: number | null = null;
  repRows: Array<{
    label: string;
    apiKey: keyof PatientReportPayload;
    value: string;
  }> = [];

  // summary lists
  repSummaryList: Array<{
    patientReportId: number;
    reportName: string;
    reportDateYmd: string;
    uiDate: string;
  }> = [];
  repAllUiDates: string[] = [];
  repSelectedUiDates: string[] = [];
  repDisplayUiDates: string[] = [];
  repSelectedHeaderDate: string = '';

  // matrix
  repMatrix: Array<{
    label: string;
    apiKey: keyof PatientReportPayload;
    values: Record<string, string>;
  }> = [];

  reportLoading = false;

  private repDetailsMap: Record<number, ReportDetail> = {};
  private repUiDateToReportId: Record<string, number> = {};

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
    private medicalExamApi: MedicalExaminationService, // ✅ only this
    private alertCtrl: AlertController,
    private route: ActivatedRoute,
    private toastCtrl: ToastController, // ✅ MUST be here with same name
    private router: Router,
  ) {}

 // =====================
// INIT / DESTROY
// =====================
ngOnInit(): void {
  // 🔹 Load role + permissions
  this.loadRoleFromStorage();
  this.ensureAllowedTab();

  // 🔹 Initialize UI logic
  this.initReportEntryRows();
  this.initFollowUpEmpty();
  this.initMedicalBmiAutoCalc();

  // 🔹 Auto-calculate Age when DOB changes
  this.initAgeAutoCalculation();

  // 🔹 Listen to route params
  this.sub.add(
    this.route.queryParams.subscribe((qp) => {
      this.loadRoleFromStorage();

      const id = safeNum(qp?.['patientId']);
      const requestedTab = safeStr(qp?.['tab']) as TabKey;
      const apptId = safeNum(qp?.['appointmentId']);

      this.currentAppointmentId = apptId > 0 ? apptId : null;

      // Set active tab
      this.activeTab =
        requestedTab && this.isTabAllowed(requestedTab)
          ? requestedTab
          : 'prelim';

      // =========================
      // EDIT MODE
      // =========================
      if (id > 0) {
        this.isEditMode = true;
        this.patientId = id;

        this.loadPatient(id);

        if (this.activeTab === 'reports') {
          this.startNewReport();
          void this.loadReportsForPatient(false);
        }

        if (this.activeTab === 'followup') {
          void this.loadFollowUpCriteria(false);
        }

        if (this.activeTab === 'medical') {
          void this.loadClinicalCaseIfExists();
        }

        return;
      }

      // =========================
      // CREATE MODE
      // =========================
      this.isEditMode = false;
      this.patientId = null;
      this.currentAppointmentId = null;
      this.currentPatient = null;

      this.resetPatientForm();
      this.resetReportsAll();
      this.resetFollowUpView();
      this.resetMedicalForm();
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
    return (
      tab === 'prelim' ||
      tab === 'payment' ||
      tab === 'reports' ||
      tab === 'followup' ||
      tab === 'medical'
    );
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
      void this.loadReportsForPatient(false);
    }

    if (this.activeTab === 'followup') {
      void this.loadFollowUpCriteria(false);
    }

    if (this.activeTab === 'medical') {
      void this.loadClinicalCaseIfExists();
    }

    // medical: nothing mandatory on switch
  }

  // =====================
  // PRELIM INPUT HELPERS
  // =====================
  onPhoneInput() {
    const cleaned = onlyDigits(this.form.value.phoneNumber || '').slice(0, 10);
    this.form.patchValue({ phoneNumber: cleaned }, { emitEvent: false });
  }

  onAltPhoneInput() {
    const cleaned = onlyDigits(this.form.value.alternateNumber || '').slice(
      0,
      10,
    );
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

        const fullName =
          `${safeStr(p?.firstName)} ${safeStr(p?.lastName)}`.trim() ||
          safeStr(p?.fullName);

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

        // default referredBy to reports form too
        this.reportForm.patchValue(
          { referredBy: safeStr(p?.referredBy) },
          { emitEvent: false },
        );
      },
      error: (err) => {
        void this.toast(
          err?.error?.message || err?.message || 'Failed to load patient',
        );
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
    void this.toast(
      'Full Name, DOB and Phone Number (10 digits) are required.'
    );
    return;
  }

  const phone = onlyDigits(this.form.value.phoneNumber || '').slice(0, 10);
  if (phone.length !== 10) {
    void this.toast('Phone Number must be exactly 10 digits.');
    return;
  }

  this.loading = true;

  // =========================
  // ✅ UPDATE PATIENT
  // =========================
  if (this.isEditMode && this.patientId) {
    const payload = this.buildUpdatePayload();

    this.patient.updatePatient(this.patientId, payload).subscribe({
      next: async () => {
        this.loading = false;

        // 🔹 show update modal
        this.successMode = 'update';
        this.successPatient = this.currentPatient;
        this.showSuccessModal = true;

        // 🔹 reload latest data
        if (this.patientId) {
          this.loadPatient(this.patientId);
        }
      },
      error: (err) => {
        this.loading = false;
        void this.toast(
          err?.error?.message || err?.message || 'Update Patient failed'
        );
      },
    });

    return;
  }

  // =========================
  // ✅ CREATE PATIENT
  // =========================
  const payload = this.buildCreatePayload();

  this.patient.createPatient(payload).subscribe({
    next: async (res: any) => {
      this.loading = false;

      const created = res?.data ?? res;

      // 🔹 set success modal
      this.successMode = 'create';
      this.successPatient = created;
      this.showSuccessModal = true;

      // 🔹 set new patient state
      this.patientId = created?.patientsId || created?.patientId;
      this.isEditMode = true;
    },
    error: (err) => {
      this.loading = false;
      void this.toast(
        err?.error?.message || err?.message || 'Create Patient failed'
      );
    },
  });
}

closeSuccessModal() {
  this.showSuccessModal = false;

  // ✅ Redirect only if it was CREATE
  if (this.successMode === 'create') {
    this.router.navigate(['/patients/list']);
  }
}


  private buildCreatePayload() {
    const v = this.form.value;
    const firstName = safeStr(v.firstName);
const lastName = safeStr(v.lastName);


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

    const firstName = safeStr(v.firstName);
const lastName = safeStr(v.lastName);

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

      maritalStatus:
        nullIfBlank(v.maritalStatus) ?? base?.maritalStatus ?? 'Single',
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

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    this.form.patchValue({ age: age.toString() }, { emitEvent: false });

  });
}


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

  // ============================================================
  // ✅ MEDICAL: BMI AUTO CALC
  // ============================================================
  private initMedicalBmiAutoCalc() {
    const pe = this.medicalForm.get('physicalExamination') as FormGroup;

    const recalc = () => {
      const h = Number(pe.controls['heightMeters']?.value || 0);
      const w = Number(pe.controls['weightKg']?.value || 0);

      if (!h || !w) {
        pe.patchValue({ bmi: '', bmiCategory: '' }, { emitEvent: false });
        return;
      }

      const bmi = w / (h * h);
      const bmiStr = Number.isFinite(bmi) ? bmi.toFixed(2) : '';

      let cat = '';
      if (bmi < 18.5) cat = 'Underweight';
      else if (bmi < 25) cat = 'Normal';
      else if (bmi < 30) cat = 'Overweight';
      else cat = 'Obese';

      pe.patchValue({ bmi: bmiStr, bmiCategory: cat }, { emitEvent: false });
    };

    pe.controls['heightMeters'].valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(recalc);
    pe.controls['weightKg'].valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(recalc);
  }

  private resetMedicalForm() {
    this.medicalForm.reset();
    this.openSection = 's1';
  }

  // ============================================================
  // ✅ MEDICAL: RELATIONSHIP BUTTONS (from your html)
  // ============================================================
  toggleStatus(key: string) {
    const g = this.medicalForm.get('mentalState') as FormGroup;
    const cur = (g?.get(key)?.value ?? '').toString().trim();

    // cycle: '' -> 'P' -> 'N' -> ''
    const next = cur === '' ? 'P' : cur === 'P' ? 'N' : '';
    g?.patchValue({ [key]: next }, { emitEvent: false });
    g?.markAsDirty();
  }

  getBtnClass(key: string): string {
    const g = this.medicalForm.get('mentalState') as FormGroup;
    const v = (g?.get(key)?.value ?? '').toString().trim();
    if (v === 'P') return 'status-positive';
    if (v === 'N') return 'status-negative';
    return 'status-neutral';
  }

  // ============================================================
  // ✅ MEDICAL: autofill() (your header button uses autofill())
  // ============================================================
  autofill() {
    if (!this.patientId) return;

    this.medicalForm.patchValue({
      complaints: {
        chief: {
          location: 'Head',
          sensation: 'Pain',
          modality: 'Worse at night',
          concomitant: 'Nausea',
        },
        associated: {
          location: 'Stomach',
          sensation: 'Burning',
          modality: 'After spicy',
          concomitant: '',
        },
        past: { location: '', sensation: '', modality: '', concomitant: '' },
      },
      physicalExamination: {
        heightMeters: '1.70',
        weightKg: '75',
        temperature: '98.6',
        pulse: '78',
        bp: '120/80',
        spo2: '99',
      },
      behavioralEvaluation: {
        childhood_Scholastic: 'Average',
        action_Speech: 'Normal',
      },
    });
  }

  // ============================================================
  // ✅ MEDICAL: SAVE RECORD -> POST /api/ClinicalCase
  // ============================================================
  private s(v: any): string {
    return (v ?? '').toString().trim();
  }
  private complaintFrom(group: any, complaintType: string) {
    return {
      complaintType,
      location: this.s(group?.location),
      sensation: this.s(group?.sensation),
      modality: this.s(group?.modality),
      concomitant: this.s(group?.concomitant),
    };
  }

  private buildClinicalCasePayload(): ClinicalCasePayload {
    const v = this.medicalForm.getRawValue();

    // ✅ Backend valid ComplaintType values (case-sensitive)
    const chief = this.complaintFrom(v?.complaints?.chief, 'Chief');
    const associated = this.complaintFrom(
      v?.complaints?.associated,
      'Associated',
    );
    const pastHistory = this.complaintFrom(v?.complaints?.past, 'PastHistory');

    const pe: any = v?.physicalExamination || {};
    const ms: any = v?.mentalState || {};
    const intel: any = v?.intellectualState || {};

    const payload: ClinicalCasePayload = {
      patientId: this.patientId || 0,

      complaints: [chief, associated, pastHistory],

      familyHistory: { ...(v?.familyHistory || {}) },
      personalStatus: { ...(v?.personalStatus || {}) },
      menstrualHistory: { ...(v?.menstrualHistory || {}) },
      maleSexualFunction: { ...(v?.maleSexualFunction || {}) },
      physicalReaction: { ...(v?.physicalReaction || {}) },

      // ✅ UI -> API keys mapping (swagger)
      physicalExamination: {
        height: this.s(pe?.heightMeters),
        weight: this.s(pe?.weightKg),
        bmi: this.s(pe?.bmi),
        weightCategory: this.s(pe?.bmiCategory),

        physicalAppearance: this.s(pe?.physicalAppearance),
        digestion: this.s(pe?.dejection), // UI "dejection" => API "digestion"
        temperature: this.s(pe?.temperature),
        pulse: this.s(pe?.pulse),
        bp: this.s(pe?.bp),
        tongue: this.s(pe?.tongue),
        lips: this.s(pe?.lips),
        teeth: this.s(pe?.teeth),
        gums: this.s(pe?.gums),
        nails: this.s(pe?.nails),
        skin: this.s(pe?.skin),
        glands: this.s(pe?.glands),
        nose: this.s(pe?.nose),
        throat: this.s(pe?.throat),
        trachea: this.s(pe?.trachea),

        chestExpansion: this.s(pe?.chestExpansion),
        spO2: this.s(pe?.spo2), // UI spo2 => API spO2
        percussion_RS: this.s(pe?.rsPercussion), // UI rsPercussion => API percussion_RS
        rr: this.s(pe?.rr),
        airEntry: this.s(pe?.airEntry),
        breathSounds: this.s(pe?.breathSounds),

        pA_SizeShapeSkin: this.s(pe?.paSizeShapeSkin),
        pA_Movement: this.s(pe?.paMovement),
        pA_Percussion: this.s(pe?.paPercussion),
        hgt: this.s(pe?.hst), // UI hst => API hgt
        soft_Tenderness_Rigidity_Guarding: this.s(pe?.paSoftTenderRigidGuard),

        bowelSound: this.s(pe?.bowelSound),
        lump: this.s(pe?.lump),

        apexImpulse: this.s(pe?.apexImpulse),
        jvp: this.s(pe?.jvp),
        thrill: this.s(pe?.thrill),
        percussion_CVS: this.s(pe?.cvsPercussion),
        heartSounds: this.s(pe?.heartSounds),
        murmur: this.s(pe?.murmur),
        rub: this.s(pe?.rub),

        higherFunction: this.s(pe?.higherFunction),
        motorFunction: this.s(pe?.motorFunction),
        sensoryFunction: this.s(pe?.sensoryFunction),
        cranialNerves: this.s(pe?.cranialNerves),
        reflexes: this.s(pe?.reflexes),
        coordination: this.s(pe?.coordination),

        inspection: this.s(pe?.mskInspection),
        rom: this.s(pe?.rom),
        swelling: this.s(pe?.swelling),
        warmth: this.s(pe?.warmth),
        redness: this.s(pe?.redness),
        deformities: this.s(pe?.deformities),
        crepitations: this.s(pe?.crepitation),
        muscleStrength: this.s(pe?.muscleStrength),

        investigations: this.s(pe?.investigations),
      },

      mentalState: {
        // keep API fields if already present
        ...(ms || {}),

        // ✅ ensure remarks go to swagger keys
        angerSadnessTriangles_Remark: this.s(
          ms?.remarkAngerSadness || ms?.angerSadnessTriangles_Remark,
        ),
        fearAnxietyTriangles_Remark: this.s(
          ms?.remarkFearAnxiety || ms?.fearAnxietyTriangles_Remark,
        ),

        // swagger required-ish fields
        spectrum_LoveHate: safeNum(ms?.spectrum_LoveHate ?? 0),
        spectrum_LaveHate_Remark: this.s(
          ms?.remarkLoveHate || ms?.spectrum_LaveHate_Remark,
        ),

        // intellect values come from intellectualState group
        intellect_Value: safeNum(intel?.capacityPerformanceRatio),
        intellect_Perception: this.s(intel?.perception),
        intellect_Memory: this.s(intel?.memory),
        intellect_Thinking: this.s(intel?.thinking),
        intellect_Decision: this.s(intel?.decision),
        intellect_Confidence: this.s(intel?.confidence),
      },

      behavioralEvaluation: { ...(v?.behavioralEvaluation || {}) },
    };

    return payload;
  }

  async saveRecord() {
    if (!this.patientId) {
      await this.toast('PatientId missing. Open patient in edit mode.');
      return;
    }
    if (this.loading) return;

    const payload = this.buildClinicalCasePayload();
    this.loading = true;

    try {
      if (this.medicalExists) {
        // ✅ UPDATE (PUT)
        await firstValueFrom(this.medicalExamApi.update(payload));
        this.medicalForm.markAsPristine();
        await this.toast('Clinical case updated');
      } else {
        // ✅ CREATE (POST)
        await firstValueFrom(this.medicalExamApi.create(payload));
        this.medicalForm.markAsPristine();
        this.medicalExists = true; // ✅ now it exists
        await this.toast('Clinical case saved');
      }
    } catch (e: any) {
      await this.presentSimpleAlert(
        'Save Failed',
        e?.error?.message || e?.message || 'Failed to save clinical case',
      );
    } finally {
      this.loading = false;
    }
  }

  // ============================================================
  // ✅ FOLLOWUP (unchanged logic)
  // ============================================================
  private initFollowUpEmpty() {
    if (this.fuSymptomsArr.length === 0) this.addFuRows(this.FU_INIT_ROWS);

    this.sub.add(
      this.fuSymptomsArr.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          if (this.fuCriteriaSaved) return;
          this.autoGrowFuCriteriaRows();
        }),
    );
  }

  private resetFollowUpView() {
    this.fuLoading = false;
    this.fuCriteriaSaved = false;
    this.fuCriteriaFromDb = [];

    this.fuCriteriaForm.reset();
    (this.fuCriteriaForm.get('symptoms') as FormArray).clear();

    this.fuNextApptForm.reset({
      followUpDate: todayYmd(),
      followUpTime: '14:30:00',
    });
    this.fuPaymentForm.reset({
      consultationCharges: 0,
      waveOffAmount: 0,
      amountPaid: 0,
      paymentMode: 'Cash',
      waveOffPassword: '',
    });

    this.addFuRows(this.FU_INIT_ROWS);
  }

  private addFuRows(count: number) {
    for (let i = 0; i < count; i++) {
      if (this.fuSymptomsArr.length >= this.FU_MAX_ROWS) break;
      this.fuSymptomsArr.push(this.fb.control(''));
    }
  }

  onCriteriaInput(i: number) {
    if (this.fuCriteriaSaved) return;

    const isLast = i === this.fuSymptomsArr.length - 1;
    if (!isLast) return;

    const v = (this.fuSymptomsArr.at(i).value ?? '').toString().trim();
    if (!v) return;

    this.addFuRows(this.FU_ADD_STEP);
  }

  private autoGrowFuCriteriaRows() {
    const len = this.fuSymptomsArr.length;
    if (!len) return;
    const last = (this.fuSymptomsArr.at(len - 1).value ?? '').toString().trim();
    if (!last) return;
    this.addFuRows(this.FU_ADD_STEP);
  }

  private async loadFollowUpCriteria(debug = false) {
    if (!this.patientId) return;

    const res: any = await firstValueFrom(
      this.fuApi.getCriteriaByPatient(this.patientId),
    );
    const list = this.extractArray(res);

    this.fuCriteriaFromDb = (Array.isArray(list) ? list : []) as any[];
    this.fuCriteriaSaved = this.fuCriteriaFromDb.length > 0;

    if (this.fuCriteriaSaved) {
      const names = this.fuCriteriaFromDb
        .map((x: any) => (x?.criteriaName ?? '').toString().trim())
        .filter(Boolean);

      while (this.fuSymptomsArr.length < names.length)
        this.addFuRows(this.FU_ADD_STEP);

      for (let i = 0; i < this.fuSymptomsArr.length; i++) {
        this.fuSymptomsArr.at(i).setValue(names[i] || '', { emitEvent: false });
        this.fuSymptomsArr.at(i).disable({ emitEvent: false });
      }
    } else {
      for (let i = 0; i < this.fuSymptomsArr.length; i++) {
        this.fuSymptomsArr.at(i).enable({ emitEvent: false });
      }
    }

    if (debug) console.log('[FU][criteria]', res);
  }

  async saveFollowUpCriteria() {
    if (!this.patientId) {
      await this.toast('PatientId missing. Open patient in edit mode.');
      return;
    }

    const names = (this.fuCriteriaForm.getRawValue().symptoms || [])
      .map((x: any) => (x ?? '').toString().trim())
      .filter(Boolean);

    if (!names.length) {
      await this.toast('Enter at least 1 symptom');
      return;
    }

    if (this.fuLoading) return;

    this.fuLoading = true;
    try {
      await firstValueFrom(
        this.fuApi.createCriteria({
          patientId: this.patientId,
          criteriaNames: names,
        }),
      );

      await this.loadFollowUpCriteria(false);
      await this.toast('Criteria saved');
    } catch (e: any) {
      await this.presentSimpleAlert(
        'Save Failed',
        e?.error?.message || e?.message || 'Failed to save criteria',
      );
    } finally {
      this.fuLoading = false;
    }
  }

  // ============================================================
  // ✅ REPORTS (your existing code - unchanged)
  // ============================================================
  private initReportEntryRows() {
    this.repRows = this.rowsMeta.map((m) => ({
      label: m.label,
      apiKey: m.apiKey,
      value: '',
    }));
  }

  private resetReportsAll() {
    this.repMode = 'entry';
    this.repReportDate = todayYmd();
    this.repSelectedPrevReportId = null;

    this.repSummaryList = [];
    this.repAllUiDates = [];
    this.repSelectedUiDates = [];
    this.repDisplayUiDates = [];
    this.repSelectedHeaderDate = '';

    this.repMatrix = [];
    this.repUiDateToReportId = {};
    this.repDetailsMap = {};

    this.reportForm.reset({
      reportName: '',
      reportDate: todayYmd(),
      labName: '',
      referredBy: '',
      summary: '',
    });

    this.initReportEntryRows();
  }

  setReportMode(mode: 'entry' | 'compare') {
    this.repMode = mode;
    this.refreshMatrixCssCols();
  }

  startNewReport() {
    if (!this.patientId) {
      void this.toast('Open patient in edit mode to create report');
      return;
    }

    this.repSelectedPrevReportId = null;
    this.repReportDate = todayYmd();
    this.repSelectedHeaderDate = '';

    this.reportForm.patchValue(
      {
        reportName: '',
        reportDate: this.repReportDate,
        labName: '',
        referredBy: safeStr(this.form.value.referredBy),
        summary: '',
      },
      { emitEvent: false },
    );

    this.initReportEntryRows();
  }

  onReportDateChange() {
    // ui-only (entry date)
  }

  async onLoadPrevChange() {
    const rid = safeNum(this.repSelectedPrevReportId);
    if (!rid) {
      this.startNewReport();
      return;
    }

    const detail = await this.ensureReportDetail(rid);
    if (!detail) {
      await this.toast('Failed to load previous report');
      return;
    }

    const uiDate = this.findUiDateByReportId(rid);
    this.applyDetailToEntry(detail, uiDate || '');
  }

  async loadReportsForPatient(debug = false) {
    if (!this.patientId) return;

    this.reportLoading = true;
    try {
      const res: any = await firstValueFrom(
        this.reportApi.getByPatient(this.patientId),
      );
      const list = this.extractArray(res);

      const summaries = (Array.isArray(list) ? list : []).map((x: any) => {
        const reportId = safeNum(x?.patientReportId ?? x?.reportId ?? x?.id);
        const ymd = toKeyYmd(safeStr(x?.reportDate));
        const uiDate = toUiDate(ymd);

        return {
          patientReportId: reportId,
          reportName: safeStr(x?.reportName),
          reportDateYmd: ymd,
          uiDate,
        };
      });

      this.repSummaryList = summaries.sort(
        (a, b) => b.patientReportId - a.patientReportId,
      );

      // ui date -> reportId
      this.repUiDateToReportId = {};
      for (const s of summaries) {
        if (s.uiDate) this.repUiDateToReportId[s.uiDate] = s.patientReportId;
      }

      this.repAllUiDates = Array.from(
        new Set(summaries.map((s) => s.uiDate).filter(Boolean)),
      );

      // keep compare selection valid
      this.repSelectedUiDates = (this.repSelectedUiDates || []).filter((d) =>
        this.repAllUiDates.includes(d),
      );
      this.repDisplayUiDates = this.repSelectedUiDates.slice(0, 5);

      // prefetch details for displayed
      for (const d of this.repDisplayUiDates) {
        const id = this.repUiDateToReportId[d];
        if (id) await this.ensureReportDetail(id);
      }

      this.buildMatrixFromCache();
      this.refreshMatrixCssCols();

      if (debug)
        console.log('[REPORTS]', {
          summaries: this.repSummaryList,
          dates: this.repAllUiDates,
        });
    } catch (e: any) {
      await this.toast(
        e?.error?.message || e?.message || 'Failed to load reports',
      );
    } finally {
      this.reportLoading = false;
    }
  }

  async toggleCompareDate(d: string, ev: any) {
    const checked = !!ev?.detail?.checked;

    if (checked) {
      if (this.repSelectedUiDates.includes(d)) return;

      if (this.repSelectedUiDates.length >= 5) {
        await this.toast('Max 5 reports compare allowed');
        return;
      }
      this.repSelectedUiDates = [...this.repSelectedUiDates, d];
    } else {
      this.repSelectedUiDates = this.repSelectedUiDates.filter((x) => x !== d);
    }

    this.repDisplayUiDates = this.repSelectedUiDates.slice(0, 5);

    for (const uiDate of this.repDisplayUiDates) {
      const id = this.repUiDateToReportId[uiDate];
      if (id) await this.ensureReportDetail(id);
    }

    this.buildMatrixFromCache();
    this.refreshMatrixCssCols();

    // UX: if only one date selected -> autofill
    if (this.repDisplayUiDates.length === 1) {
      await this.onDateHeaderClick(this.repDisplayUiDates[0]);
    } else {
      if (
        this.repSelectedHeaderDate &&
        !this.repDisplayUiDates.includes(this.repSelectedHeaderDate)
      ) {
        this.repSelectedHeaderDate = '';
      }
    }
  }

  async onDateHeaderClick(uiDate: string) {
    if (!uiDate) return;

    const rid = this.repUiDateToReportId[uiDate];
    if (!rid) return;

    const detail = await this.ensureReportDetail(rid);
    if (!detail) {
      await this.toast('Report detail not found');
      return;
    }

    this.repSelectedHeaderDate = uiDate;
    this.applyDetailToEntry(detail, uiDate);
  }

  saveReport() {
    void this.saveReportInternal();
  }

  private async saveReportInternal() {
    if (!this.patientId) {
      await this.toast('PatientId missing');
      return;
    }
    if (this.reportLoading) return;

    const payload = this.emptyReportPayload();
    payload.patientId = this.patientId;

    const raw = this.reportForm.getRawValue();
    payload.reportName = safeStr(raw.reportName);
    payload.labName = safeStr(raw.labName);
    payload.referredBy = safeStr(raw.referredBy);
    payload.summary = safeStr(raw.summary);

    const ymd = this.repReportDate || safeStr(raw.reportDate) || todayYmd();
    payload.reportDate = new Date(`${ymd}T00:00:00.000Z`).toISOString();

    for (const r of this.repRows) {
      (payload as any)[r.apiKey] = safeStr(r.value);
    }

    this.reportLoading = true;
    this.reportApi.create(payload).subscribe({
      next: async () => {
        this.reportLoading = false;
        await this.toast('Report saved');

        await this.loadReportsForPatient(false);
        this.startNewReport();
      },
      error: async (err) => {
        this.reportLoading = false;
        await this.presentSimpleAlert(
          'Save Failed',
          err?.error?.message || err?.message || 'Failed to save report',
        );
      },
    });
  }

  private applyDetailToEntry(detail: ReportDetail, uiDate: string) {
    this.repReportDate =
      toKeyYmd(safeStr((detail as any).reportDate)) || todayYmd();

    this.reportForm.patchValue(
      {
        reportName: safeStr((detail as any).reportName),
        reportDate: this.repReportDate,
        labName: safeStr((detail as any).labName),
        referredBy:
          safeStr((detail as any).referredBy) ||
          safeStr(this.form.value.referredBy),
        summary: safeStr((detail as any).summary),
      },
      { emitEvent: false },
    );

    for (const r of this.repRows) {
      r.value = safeStr((detail as any)[r.apiKey]);
    }

    if (uiDate) this.repSelectedHeaderDate = uiDate;
  }

  private buildMatrixFromCache() {
    const dates = [...(this.repDisplayUiDates || [])];

    this.repMatrix = this.rowsMeta.map((m) => {
      const values: Record<string, string> = {};
      for (const uiDate of dates) {
        const id = this.repUiDateToReportId[uiDate];
        const detail = id ? this.repDetailsMap[id] : null;
        values[uiDate] = detail ? safeStr((detail as any)[m.apiKey]) : '';
      }
      return { label: m.label, apiKey: m.apiKey, values };
    });
  }

  private refreshMatrixCssCols() {
    const cols = Math.max(1, this.repDisplayUiDates?.length || 0);
    document.documentElement.style.setProperty('--rep-cols', String(cols));
  }

  private findUiDateByReportId(reportId: number): string {
    const s = this.repSummaryList.find((x) => x.patientReportId === reportId);
    return s?.uiDate || '';
  }

  private async ensureReportDetail(
    reportId: number,
  ): Promise<ReportDetail | null> {
    if (!reportId || reportId <= 0) return null;
    if (this.repDetailsMap[reportId]) return this.repDetailsMap[reportId];

    try {
      const res: any = await firstValueFrom(this.reportApi.getById(reportId));
      const data = res?.data ?? res ?? null;
      if (!data) return null;

      const detail: ReportDetail = {
        ...(data as any),
        patientReportId: safeNum(
          data?.patientReportId ?? data?.reportId ?? data?.id ?? reportId,
        ),
      };

      this.repDetailsMap[reportId] = detail;
      return detail;
    } catch {
      return null;
    }
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

  // ============================================================
  // TEMPLATE MISSING (keep)
  // ============================================================
  autoFill() {
    // prelim autofill
    this.form.patchValue({
      firstName
      : 'Test Patient',
      gender: 'Male',
      dateOfBirth: '1995-01-01',
      phoneNumber: '9999999999',
      city: 'Mumbai',
      state: 'MH',
    });
  }

  openAddPayment() {
    void this.toast('Add Payment clicked (UI only)');
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

  // =====================
  // UTIL
  // =====================
  private extractArray(res: any): any[] {
    const list =
      res?.data ?? res?.list ?? res?.result ?? res?.items ?? res ?? [];
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

  trackByIndex(index: number) {
    return index;
  }

  // ============================================================
  // Waive-off modal + nextPaymentFirstVisit (unchanged)
  // ============================================================
  async openWaiveOffModal() {
    this.waiveOffVerifyErr = '';

    const alert = await this.alertCtrl.create({
      header: 'Admin Password',
      message: this.waiveOffVerifyErr
        ? `<span style="color:#d00">${this.waiveOffVerifyErr}</span>`
        : 'Enter admin password to enable waive-off.',
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'Enter admin password',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Verify',
          handler: async (data) => {
            const password = (data?.password ?? '').toString().trim();
            if (!password) {
              this.waiveOffVerifyErr = 'Password is required';
              setTimeout(() => this.openWaiveOffModal(), 0);
              return false;
            }

            try {
              const res: any = await firstValueFrom(
                this.fuApi.verifyWaveOffPassword({ password }),
              );

              const ok =
                res?.ok === true ||
                res?.isValid === true ||
                res?.valid === true ||
                res?.data === true ||
                res?.data?.valid === true;

              if (!ok) {
                this.waiveOffVerifyErr = res?.message || 'Invalid password';
                setTimeout(() => this.openWaiveOffModal(), 0);
                return false;
              }

              this.waiveOffVerified = true;
              this.showWaveOffAmount = true;
              this.waiveOffPasswordCache = password;
              this.waiveOffVerifyErr = '';
              return true;
            } catch (e: any) {
              this.waiveOffVerifyErr =
                e?.error?.message || e?.message || 'Verify failed';
              setTimeout(() => this.openWaiveOffModal(), 0);
              return false;
            }
          },
        },
      ],
      backdropDismiss: false,
    });

    await alert.present();
  }

  async nextPaymentFirstVisit() {
    this.fuNextPaymentError = '';

    if (!this.patientId) {
      await this.toast('PatientId missing');
      return;
    }

    if (!this.fuCanProceedNextPayment) {
      this.fuNextPaymentError = 'Fill required payment fields first.';
      await this.toast(this.fuNextPaymentError);
      return;
    }

    if (this.fuLoading) return;

    this.fuLoading = true;

    try {
      // 1) find current appointment
      const apptRes: any = await firstValueFrom(
        this.fuApi.getCurrentAppointments(this.patientId),
      );
      const apptList = this.extractArray(apptRes);

      const current = apptList?.[0];
      const apptId = safeNum(
        current?.appointmentId ?? current?.id ?? current?.appointmentsId,
      );

      if (!apptId || apptId <= 0) {
        this.fuNextPaymentError = 'Current appointment not found';
        await this.toast(this.fuNextPaymentError);
        return;
      }

      this.currentAppointmentId = apptId;

      // 2) update status
      await firstValueFrom(
        this.fuApi.updateAppointmentStatus(apptId, {
          status: this.APPT_STATUS_AWAIT_PAYMENT,
        }),
      );

      // 3) optional: create next appointment
      const nextDate = (this.fuNextApptForm.controls.followUpDate.value ?? '')
        .toString()
        .trim();
      const nextTime =
        (this.fuNextApptForm.controls.followUpTime.value ?? '14:30:00')
          .toString()
          .trim() || '14:30:00';

      if (nextDate) {
        await firstValueFrom(
          this.fuApi.createAppointment({
            patientId: this.patientId,
            appointmentDate: nextDate,
            appointmentTime: nextTime,
            remark: 'Next follow-up booked from Follow Up',
          }),
        );
      }

      // 4) payment
      const consultationCharges = safeNum(
        this.fuPaymentForm.controls.consultationCharges.value ?? 0,
      );
      const waveOffAmount = safeNum(
        this.fuPaymentForm.controls.waveOffAmount.value ?? 0,
      );
      const amountPaid = safeNum(
        this.fuPaymentForm.controls.amountPaid.value ?? 0,
      );
      const paymentMode = (this.fuPaymentForm.controls.paymentMode.value ?? '')
        .toString()
        .trim();

      const waveOffPasswordRaw = (
        this.fuPaymentForm.controls.waveOffPassword.value ?? ''
      )
        .toString()
        .trim();
      const waveOffPassword = this.waiveOffVerified
        ? waveOffPasswordRaw || this.waiveOffPasswordCache || undefined
        : undefined;

      await firstValueFrom(
        this.fuApi.createPayment({
          patientId: this.patientId,
          appointmentId: apptId,
          consultationCharges,
          waveOffAmount,
          amountPaid,
          paymentMode,
          paymentDate: new Date().toISOString(),
          waveOffPassword,
        }),
      );

      await this.toast('Payment saved');
      this.activeTab = 'payment';
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Something went wrong';
      await this.presentSimpleAlert('Failed', msg);
    } finally {
      this.fuLoading = false;
    }
  }

  goPrevIdentity() {
    const prev: TabKey = 'prelim'; // Identity tab tumhare flow me prelim hai
    if (!this.isTabAllowed(prev)) {
      void this.toast('Access denied');
      return;
    }
    this.activeTab = prev;
  }

  goNextFollowUp() {
    const next: TabKey = 'followup';
    if (!this.isTabAllowed(next)) {
      void this.toast('Access denied');
      return;
    }
    this.activeTab = next;

    // optional: load criteria when entering
    if (this.patientId) void this.loadFollowUpCriteria(false);
  }

  async loadClinicalCaseIfExists() {
    if (!this.patientId) return;

    try {
      const res: any = await firstValueFrom(
        this.medicalExamApi.getByPatientId(this.patientId),
      );
      const data = res?.data ?? res; // ✅ agar backend wrap kare

      if (!data) {
        this.medicalExists = false;
        return;
      }

      this.patchMedicalFormFromApi(data);
      this.medicalForm.markAsPristine();
      this.medicalExists = true; // ✅ record exists
    } catch (e: any) {
      if (e?.status === 404) {
        this.medicalExists = false; // ✅ not found => create mode
        return;
      }
      console.error(e);
      await this.toast(
        e?.error?.message || e?.message || 'Failed to load clinical case',
      );
    }
  }

  private patchMedicalFormFromApi(api: ClinicalCasePayload) {
    const complaints: Complaint[] = Array.isArray(api?.complaints)
      ? (api.complaints as Complaint[])
      : [];

    const emptyComplaint: Complaint = {
      complaintType: '',
      location: '',
      sensation: '',
      modality: '',
      concomitant: '',
    };

    // ✅ IMPORTANT: backend valid values
    const chief: Complaint =
      complaints.find((c) => (c?.complaintType || '').toString() === 'Chief') ||
      emptyComplaint;

    const associated: Complaint =
      complaints.find(
        (c) => (c?.complaintType || '').toString() === 'Associated',
      ) || emptyComplaint;

    const pastHistory: Complaint =
      complaints.find(
        (c) => (c?.complaintType || '').toString() === 'PastHistory',
      ) || emptyComplaint;

    const pe: any = api?.physicalExamination || {};
    const ms: any = api?.mentalState || {};

    this.medicalForm.patchValue(
      {
        complaints: {
          chief: {
            location: chief.location || '',
            sensation: chief.sensation || '',
            modality: chief.modality || '',
            concomitant: chief.concomitant || '',
          },
          associated: {
            location: associated.location || '',
            sensation: associated.sensation || '',
            modality: associated.modality || '',
            concomitant: associated.concomitant || '',
          },
          past: {
            location: pastHistory.location || '',
            sensation: pastHistory.sensation || '',
            modality: pastHistory.modality || '',
            concomitant: pastHistory.concomitant || '',
          },
        },

        familyHistory: api?.familyHistory || {},
        personalStatus: api?.personalStatus || {},
        menstrualHistory: api?.menstrualHistory || {},
        maleSexualFunction: api?.maleSexualFunction || {},
        physicalReaction: api?.physicalReaction || {},

        physicalExamination: {
          heightMeters: pe.height || '',
          weightKg: pe.weight || '',
          bmi: pe.bmi || '',
          bmiCategory: pe.weightCategory || '',

          physicalAppearance: pe.physicalAppearance || '',
          dejection: pe.digestion || '',
          temperature: pe.temperature || '',
          pulse: pe.pulse || '',
          bp: pe.bp || '',
          tongue: pe.tongue || '',
          lips: pe.lips || '',
          teeth: pe.teeth || '',
          gums: pe.gums || '',
          nails: pe.nails || '',
          skin: pe.skin || '',
          glands: pe.glands || '',
          nose: pe.nose || '',
          throat: pe.throat || '',
          trachea: pe.trachea || '',

          chestExpansion: pe.chestExpansion || '',
          spo2: pe.spO2 || '',
          rsPercussion: pe.percussion_RS || '',
          rr: pe.rr || '',
          airEntry: pe.airEntry || '',
          breathSounds: pe.breathSounds || '',

          paSizeShapeSkin: pe.pA_SizeShapeSkin || '',
          paMovement: pe.pA_Movement || '',
          paPercussion: pe.pA_Percussion || '',
          hst: pe.hgt || '',
          paSoftTenderRigidGuard: pe.soft_Tenderness_Rigidity_Guarding || '',

          bowelSound: pe.bowelSound || '',
          lump: pe.lump || '',

          apexImpulse: pe.apexImpulse || '',
          jvp: pe.jvp || '',
          thrill: pe.thrill || '',
          cvsPercussion: pe.percussion_CVS || '',
          heartSounds: pe.heartSounds || '',
          murmur: pe.murmur || '',
          rub: pe.rub || '',

          higherFunction: pe.higherFunction || '',
          motorFunction: pe.motorFunction || '',
          sensoryFunction: pe.sensoryFunction || '',
          cranialNerves: pe.cranialNerves || '',
          reflexes: pe.reflexes || '',
          coordination: pe.coordination || '',

          mskInspection: pe.inspection || '',
          rom: pe.rom || '',
          swelling: pe.swelling || '',
          warmth: pe.warmth || '',
          redness: pe.redness || '',
          deformities: pe.deformities || '',
          crepitation: pe.crepitations || '',
          muscleStrength: pe.muscleStrength || '',

          investigations: pe.investigations || '',
        },

        mentalState: {
          ...ms,
          // ✅ UI remarks fields
          remarkLoveHate: ms?.spectrum_LaveHate_Remark || '',
          remarkAngerSadness: ms?.angerSadnessTriangles_Remark || '',
          remarkFearAnxiety: ms?.fearAnxietyTriangles_Remark || '',
        },

        behavioralEvaluation: api?.behavioralEvaluation || {},
      },
      { emitEvent: false },
    );
  }
}
