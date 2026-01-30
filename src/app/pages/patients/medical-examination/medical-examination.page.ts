import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';

import {
  ClinicalCaseService,
  ComplaintType,
  ClinicalCasePayload,
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

  // ✅ MAIN FORM (aligned with API schema)
  form = this.fb.group({
    complaints: this.fb.group({
      chief: this.fb.array([]),
      associated: this.fb.array([]),
      past: this.fb.array([]),
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
      height: [''],
      weight: [''],
      bmi: [''],
      weightCategory: [''],
      physicalAppearance: [''],
      digestion: [''],
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
      chestExpansion: [''],
      spO2: [''],
      percussion_RS: [''],
      rr: [''],
      airEntry: [''],
      breathSounds: [''],
      pA_SizeShapeSkin: [''],
      pA_Movement: [''],
      pA_Percussion: [''],
      hgt: [''],
      soft_Tenderness_Rigidity_Guarding: [''],
      bowelSound: [''],
      lump: [''],
      apexImpulse: [''],
      jvp: [''],
      thrill: [''],
      percussion_CVS: [''],
      heartSounds: [''],
      murmur: [''],
      rub: [''],
      higherFunction: [''],
      motorFunction: [''],
      sensoryFunction: [''],
      cranialNerves: [''],
      reflexes: [''],
      coordination: [''],
      inspection: [''],
      rom: [''],
      swelling: [''],
      warmth: [''],
      redness: [''],
      deformities: [''],
      crepitations: [''],
      muscleStrength: [''],
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
      angerSadnessTriangles_Remark: [''],
      fearAnxietyTriangles_Remark: [''],
      intellect_Value: [0],
      intellect_Perception: [''],
      intellect_Memory: [''],
      intellect_Thinking: [''],
      intellect_Decision: [''],
      intellect_Confidence: [''],
      overall_Results: [''],
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
    this.ensureDefaultComplaintRows();

    // ✅ patientId from query (?patientId=123)
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qp) => {
      const id = Number(qp?.['patientId'] ?? 0);
      this.patientId = id > 0 ? id : null;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // -----------------------------
  // Complaint rows
  // -----------------------------
  private complaintRow(): FormGroup {
    return this.fb.group({
      location: [''],
      sensation: [''],
      modality: [''],
      concomitant: [''],
    });
  }

  get chiefArr(): FormArray {
    return this.form.get('complaints.chief') as FormArray;
  }
  get associatedArr(): FormArray {
    return this.form.get('complaints.associated') as FormArray;
  }
  get pastArr(): FormArray {
    return this.form.get('complaints.past') as FormArray;
  }

  private arr(key: ComplaintKey): FormArray {
    if (key === 'chief') return this.chiefArr;
    if (key === 'associated') return this.associatedArr;
    return this.pastArr;
  }

  addComplaintRow(key: ComplaintKey) {
    this.arr(key).push(this.complaintRow());
    this.form.markAsDirty();
  }

  removeComplaintRow(key: ComplaintKey, index: number) {
    const a = this.arr(key);
    if (a.length <= 1) return;
    a.removeAt(index);
    this.form.markAsDirty();
  }

  private ensureDefaultComplaintRows() {
    if (this.chiefArr.length === 0) this.chiefArr.push(this.complaintRow());
    if (this.associatedArr.length === 0) this.associatedArr.push(this.complaintRow());
    if (this.pastArr.length === 0) this.pastArr.push(this.complaintRow());
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
  // Save to API (ONLY ON BUTTON CLICK)
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
    const v: any = this.form.value;

    const mapType = (k: ComplaintKey): ComplaintType =>
      k === 'chief' ? 'Chief' : k === 'associated' ? 'Associated' : 'PastHistory';

    const flatten = (k: ComplaintKey) =>
      (v?.complaints?.[k] || []).map((row: any) => ({
        complaintType: mapType(k),
        location: row?.location || '',
        sensation: row?.sensation || '',
        modality: row?.modality || '',
        concomitant: row?.concomitant || '',
      }));

    return {
      patientId: this.patientId!,
      complaints: [...flatten('chief'), ...flatten('associated'), ...flatten('past')],

      familyHistory: v?.familyHistory || {},
      personalStatus: v?.personalStatus || {},
      menstrualHistory: v?.menstrualHistory || {},
      maleSexualFunction: v?.maleSexualFunction || {},
      physicalReaction: v?.physicalReaction || {},
      physicalExamination: v?.physicalExamination || {},
      mentalState: v?.mentalState || {},
      behavioralEvaluation: v?.behavioralEvaluation || {},
    };
  }

  // -----------------------------
  // AutoFill (Testing) - DOES NOT SAVE
  // -----------------------------
  async autofill() {
    if (!this.patientId) {
      await this.toast('PatientId missing. Open from patient flow.');
      return;
    }

    this.ensureDefaultComplaintRows();

    (this.chiefArr.at(0) as FormGroup).patchValue({
      location: 'Head',
      sensation: 'Throbbing pain',
      modality: 'Worse in sunlight',
      concomitant: 'Nausea',
    });

    (this.associatedArr.at(0) as FormGroup).patchValue({
      location: 'Stomach',
      sensation: 'Burning',
      modality: 'Better after cold water',
      concomitant: 'Acidity',
    });

    (this.pastArr.at(0) as FormGroup).patchValue({
      location: 'Chest',
      sensation: 'Tightness',
      modality: 'Worse on exertion',
      concomitant: 'Sweating',
    });

    this.form.patchValue({
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
        height: '170 cm',
        weight: '70 kg',
        bp: '120/80',
        pulse: '78',
        spO2: '98%',
      },
      mentalState: {
        mentalStateEvaluation: 'Normal',
        overall_Results: 'Stable',
      },
      behavioralEvaluation: {
        provisionalDiagnosis: 'Migraine',
        finalDiagnosis: 'Migraine',
        firstPrescription: 'As per protocol',
        generalInstructions: 'Hydration, rest, avoid triggers',
      },
    });

    this.form.markAsDirty();
    await this.toast('Autofill applied (not saved).');
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2200,
      position: 'top',
    });
    await t.present();
  }
}
