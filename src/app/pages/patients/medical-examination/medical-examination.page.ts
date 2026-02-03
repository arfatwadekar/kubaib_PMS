import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';

import {
  ClinicalCaseService,
  ClinicalCasePayload,
  ComplaintType,
} from 'src/app/services/clinical-case.service';

type ComplaintKey = 'chief' | 'associated' | 'past';

@Component({
  selector: 'app-medical-examination',
  templateUrl: './medical-examination.page.html',
  styleUrls: ['./medical-examination.page.scss'],
  standalone: false,
})
export class MedicalExaminationPage implements OnInit, OnDestroy {
  loading = false;

  patientId: number | null = null;
  openSection = 's1';

  private destroy$ = new Subject<void>();
  private isSaving = false;

  // ✅ MAIN FORM
  form = this.fb.group({
    complaints: this.fb.group({
      chief: this.complaintGroup(),
      associated: this.complaintGroup(),
      past: this.complaintGroup(),
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

    // ✅ SECTION 7 (screenshot keys)
    physicalExamination: this.fb.group({
      // Vitals & BMI
      heightMeters: [''],
      weightKg: [''],
      bmi: [{ value: '', disabled: true }],
      bmiCategory: [{ value: '', disabled: true }],

      // General Examination
      physicalAppearance: [''],
      dejection: [''],
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

      // Respiratory System (RS)
      rsPercussion: [''],
      rr: [''],
      airEntry: [''],
      chestExpansion: [''],
      breathSounds: [''],
      spo2: [''],

      // Per Abdomen (PA)
      paSizeShapeSkin: [''],
      paMovement: [''],
      paPercussion: [''],
      paSoftTenderRigidGuard: [''],
      bowelSound: [''],
      lump: [''],
      hst: [''],

      // Cardiovascular System (CVS)
      apexImpulse: [''],
      jvp: [''],
      thrill: [''],
      cvsPercussion: [''],
      heartSounds: [''],
      murmur: [''],
      rub: [''],

      // Central Nervous System (CNS)
      higherFunction: [''],
      motorFunction: [''],
      sensoryFunction: [''],
      cranialNerves: [''],
      reflexes: [''],
      coordination: [''],

      // Musculoskeletal System (MSK)
      mskInspection: [''],
      rom: [''],
      swelling: [''],
      warmth: [''],
      redness: [''],
      deformities: [''],
      crepitation: [''],
      muscleStrength: [''],

      // optional
      investigations: [''],
    }),

    mentalState: this.fb.group({
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

      // ✅ INTELLECTUAL STATE SECTION (Update/Add these keys)
  intellect_Value: [50], // Range slider (0-100)
  intellect_Perception: [''],
  intellect_Memory: [''],
  intellect_Thinking: [''],
  intellect_Decision: [''],
  intellect_Confidence: [''],
overall_Results: [''],

      // ✅ 0 white, 1 green, 2 red
      att_Anger_Score: [0],
      att_Sadness_Score: [0],
      att_Somatization_Score: [0],
      angerSadnessTriangles_Remark: [''],
      fearAnxietyTriangles_Remark: [''],

      att_Self: [''],
      att_Persons: [''],
      att_Family: [''],
      att_Objects: [''],
      att_Work: [''],
      att_Career: [''],
      att_Money: [''],
      att_Power: [''],

      spectrum_LoveHate: [0],
      spectrum_LaveHate_Remark: [''],

      // intellect_Value: [0],
      // intellect_Perception: [''],
      // intellect_Memory: [''],
      // intellect_Thinking: [''],
      // intellect_Decision: [''],
      // intellect_Confidence: [''],

      // overall_Results: [''],
    }),

    emotionalState: this.fb.group({
      // ✅ 0 white, 1 green, 2 red
      att_Self_Score: [0],
      att_Persons_Score: [0],
      att_Family_Score: [0],
      att_Objects_Score: [0],
      att_Work_Score: [0],
      att_Career_Score: [0],
      att_Money_Score: [0],
      att_Power_Score: [0],
      spectrum_LoveHate: [0],
      emotionalStateRemarks: [''],
    }),

    behavioralEvaluation: this.fb.group({
      childhood_Scholastic: [''],
      childhood_HomeEnvironment: [''],
      childhood_Finance: [''],
      childhood_Difficulties: [''],

      action_Speech: [''],
      action_Behaviour: [''],
      action_Description: [''],

      block_Emotional: [true],
      block_Motivational: [true],
      block_Intellectual: [true],
      block_IPR: [true],
      block_Social: [true],
      block_Domestic: [true],
      block_Work: [true],

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

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private clinicalCase: ClinicalCaseService
  ) {}

  ngOnInit(): void {
    // ✅ patientId from query params
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qp) => {
      const id = Number(qp?.['patientId'] ?? 0);
      this.patientId = id > 0 ? id : null;
    });

    // ✅ BMI auto-calc
    const pe = this.form.get('physicalExamination');
    pe?.get('heightMeters')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.updateBMI());
    pe?.get('weightKg')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.updateBMI());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // -----------------------------
  // Complaints Group
  // -----------------------------
  private complaintGroup() {
    return this.fb.group({
      location: [''],
      sensation: [''],
      modality: [''],
      concomitant: [''],
    });
  }

  // -----------------------------
  // BMI Helpers (fixed for disabled fields + string typing)
  // -----------------------------
  private toNum(v: any): number {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private updateBMI() {
    const pe = this.form.get('physicalExamination');
    if (!pe) return;

    const h = this.toNum(pe.get('heightMeters')?.value);
    const w = this.toNum(pe.get('weightKg')?.value);

    const bmiCtrl = pe.get('bmi');
    const catCtrl = pe.get('bmiCategory');

    if (!h || !w || h <= 0 || w <= 0) {
      bmiCtrl?.setValue('', { emitEvent: false });
      catCtrl?.setValue('', { emitEvent: false });
      return;
    }

    const bmi = +(w / (h * h)).toFixed(2);

    let cat = '';
    if (bmi < 18.5) cat = 'Underweight';
    else if (bmi < 25) cat = 'Normal';
    else if (bmi < 30) cat = 'Overweight';
    else cat = 'Obese';

    // ✅ setValue works even if control is disabled
    bmiCtrl?.setValue(String(bmi), { emitEvent: false });
    catCtrl?.setValue(cat, { emitEvent: false });
  }

  // -----------------------------
  // Navigation
  // -----------------------------
  goPrevIdentity() {
    this.router.navigate(['/patients/create-patient'], {
      queryParams: { patientId: this.patientId, tab: 'identity' },
    });
  }

  goNextFollowUp() {
    this.router.navigate(['/patients/create-patient'], {
      queryParams: { patientId: this.patientId, tab: 'followup' },
    });
  }

  // -----------------------------
  // Save
  // -----------------------------
  async saveRecord() {
    if (!this.patientId) {
      await this.toast('PatientId missing. Open from patient flow.');
      return;
    }
    if (this.isSaving) return;

    const payload = this.buildPayload();

    this.isSaving = true;
    this.loading = true;

    this.clinicalCase.create(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: async (res) => {
        this.isSaving = false;
        this.loading = false;
        this.form.markAsPristine();
        await this.toast(res?.message || 'Clinical case saved.');
      },
      error: async (err) => {
        this.isSaving = false;
        this.loading = false;

        const msg =
          err?.error?.message ||
          err?.error?.detail ||
          err?.message ||
          'Failed to save clinical case.';

        const a = await this.alertCtrl.create({
          header: 'Save Failed',
          message: msg,
          buttons: ['OK'],
        });
        await a.present();
      },
    });
  }

  private buildPayload(): ClinicalCasePayload {
    // ✅ includes disabled BMI fields
    const v: any = this.form.getRawValue();

    const mapType = (k: ComplaintKey): ComplaintType =>
      k === 'chief' ? 'Chief' : k === 'associated' ? 'Associated' : 'PastHistory';

    const one = (k: ComplaintKey) => {
      const row = v?.complaints?.[k] || {};
      return {
        complaintType: mapType(k),
        location: row?.location || '',
        sensation: row?.sensation || '',
        modality: row?.modality || '',
        concomitant: row?.concomitant || '',
      };
    };

    // ⚠️ NOTE:
    // If ClinicalCasePayload type DOES NOT contain emotionalState,
    // add it in service interface OR remove it from here.
    return {
      patientId: this.patientId!,
      complaints: [one('chief'), one('associated'), one('past')],
      familyHistory: v?.familyHistory || {},
      personalStatus: v?.personalStatus || {},
      menstrualHistory: v?.menstrualHistory || {},
      maleSexualFunction: v?.maleSexualFunction || {},
      physicalReaction: v?.physicalReaction || {},
      physicalExamination: v?.physicalExamination || {},
      mentalState: v?.mentalState || {},
      emotionalState: v?.emotionalState || {}, // ✅ requires payload interface support
      behavioralEvaluation: v?.behavioralEvaluation || {},
    } as any;
  }

  // -----------------------------
  // AutoFill (Testing)
  // -----------------------------
  async autofill() {
    if (!this.patientId) {
      await this.toast('PatientId missing. Open from patient flow.');
      return;
    }

    this.form.patchValue({
      complaints: {
        chief: {
          location: 'Head',
          sensation: 'Throbbing pain',
          modality: 'Worse in sunlight',
          concomitant: 'Nausea',
        },
        associated: {
          location: 'Stomach',
          sensation: 'Burning',
          modality: 'Better after cold water',
          concomitant: 'Acidity',
        },
        past: {
          location: 'Chest',
          sensation: 'Tightness',
          modality: 'Worse on exertion',
          concomitant: 'Sweating',
        },
      },
      familyHistory: {
        father: 'Diabetes',
        mother: 'Hypertension',
        remarks: 'No major hereditary issues reported',
      },
      personalStatus: {
        appetite: 'Good',
        thirst: 'Moderate',
        sleep: 'Disturbed',
        dreams: 'Anxiety dreams',
      },
      physicalExamination: {
        heightMeters: '1.7', // ✅ string (to avoid TS error)
        weightKg: '70',      // ✅ string
        bp: '120/80',
        pulse: '78',
        spo2: '98%',
      },
      mentalState: {
        mentalStateEvaluation: 'Normal',
        overall_Results: 'Stable',
      },
      emotionalState: {
        att_Self_Score: 0,
        att_Persons_Score: 0,
        att_Family_Score: 0,
        att_Objects_Score: 0,
        att_Work_Score: 0,
        att_Career_Score: 0,
        att_Money_Score: 0,
        att_Power_Score: 0,
        spectrum_LoveHate: 0,
        emotionalStateRemarks: '',
      },
      behavioralEvaluation: {
        provisionalDiagnosis: 'Migraine',
        finalDiagnosis: 'Migraine',
        firstPrescription: 'As per protocol',
        generalInstructions: 'Hydration, rest, avoid triggers',
      },
    });

    this.updateBMI();
    this.form.markAsDirty();
    await this.toast('Autofill applied (not saved).');
  }

  // -----------------------------
  // Mental State Buttons (good/danger/default)
  // -----------------------------
  getBtnClass(controlName: string): string {
    const control = this.form.get('mentalState')?.get(controlName);
    const val = control?.value;

    if (val === 'good') return 'state-good';
    if (val === 'danger') return 'state-danger';
    return 'state-default';
  }

  toggleStatus(controlName: string) {
    const control = this.form.get('mentalState')?.get(controlName);
    if (!control) return;

    const current = control.value;
    let next = '';

    if (!current || current === '') next = 'good';
    else if (current === 'good') next = 'danger';
    else next = '';

    control.setValue(next);
    this.form.markAsDirty();
  }

  // -----------------------------
  // ✅ MentalState triangle scores (HTML calls toggleEmo3)
  // 0 = white, 1 = green, 2 = red
  // -----------------------------
  toggleEmo3(ctrlName: string) {
    const ctrl = this.form.get(['mentalState', ctrlName]);
    if (!ctrl) return;

    const cur = Number(ctrl.value ?? 0);
    const next = (cur + 1) % 3;

    ctrl.setValue(next);
    ctrl.markAsDirty();
    ctrl.markAsTouched();
  }

  // -----------------------------
  // Emotional State (0=white,1=green,2=red)
  // -----------------------------
  toggleEmoScore(ctrlName: string) {
    const ctrl = this.form.get(['emotionalState', ctrlName]);
    if (!ctrl) return;

    const cur = Number(ctrl.value ?? 0);
    const next = (cur + 1) % 3;

    ctrl.setValue(next);
    ctrl.markAsDirty();
    ctrl.markAsTouched();
  }

  getEmoBtnClass(ctrlName: string) {
    // By default checking emotionalState (your existing pills)
    const v = Number(this.form.get(['emotionalState', ctrlName])?.value ?? 0);
    return {
      'is-white': v === 0,
      'is-green': v === 1,
      'is-red': v === 2,
    };
  }

  // If you have separate classes for mentalState triangle buttons, use this:
  getMentalTriangleBtnClass(ctrlName: string) {
    const v = Number(this.form.get(['mentalState', ctrlName])?.value ?? 0);
    return {
      'is-white': v === 0,
      'is-green': v === 1,
      'is-red': v === 2,
    };
  }

  // -----------------------------
  // Toast
  // -----------------------------
  private async toast(message: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2200,
      position: 'top',
    });
    await t.present();
  }
}
