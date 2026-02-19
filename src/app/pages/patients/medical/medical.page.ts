import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, Subscription, takeUntil, firstValueFrom } from 'rxjs';

import {
  MedicalExaminationService,
  ClinicalCasePayload,
} from 'src/app/services/medical-examination.service';

// =====================
// Helpers
// =====================
function safeStr(v: any): string {
  return (v ?? '').toString().trim();
}
function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type Complaint = {
  complaintType: string;
  location: string;
  sensation: string;
  modality: string;
  concomitant: string;
};
@Component({
  selector: 'app-medical',
  templateUrl: './medical.page.html',
  styleUrls: ['./medical.page.scss'],
  standalone: false,
})
export class MedicalPage implements OnInit, OnDestroy{
     // =====================
  // STATE
  // =====================
  loading = false;
  patientId: number | null = null;
  medicalExists = false;
  openSection: string = 's1';

  private destroy$ = new Subject<void>();
  private sub = new Subscription();

  // ============================================================
  // MEDICAL FORM
  // ============================================================
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
      summer_Fan: [''], summer_AC: [''], summer_Coverings: [''],
      summer_Woolens: [''], summer_Bath: [''],
      monsoon_Fan: [''], monsoon_AC: [''], monsoon_Coverings: [''],
      monsoon_Woolens: [''], monsoon_Bath: [''],
      winter_Fan: [''], winter_AC: [''], winter_Coverings: [''],
      winter_Woolens: [''], winter_Bath: [''],
      bus: [''], sun: [''], coldAir: [''], draft: [''],
      wetGetting: [''], thermalState: [''],
    }),

    physicalExamination: this.fb.group({
      heightMeters: [''], weightKg: [''], bmi: [''], bmiCategory: [''],
      physicalAppearance: [''], dejection: [''], temperature: [''],
      pulse: [''], bp: [''], tongue: [''], lips: [''], teeth: [''],
      gums: [''], nails: [''], skin: [''], glands: [''],
      nose: [''], throat: [''], trachea: [''],
      rsPercussion: [''], rr: [''], airEntry: [''],
      chestExpansion: [''], breathSounds: [''], spo2: [''],
      paSizeShapeSkin: [''], paMovement: [''], paPercussion: [''],
      paSoftTenderRigidGuard: [''], bowelSound: [''], lump: [''], hst: [''],
      apexImpulse: [''], jvp: [''], thrill: [''], cvsPercussion: [''],
      heartSounds: [''], murmur: [''], rub: [''],
      higherFunction: [''], motorFunction: [''], sensoryFunction: [''],
      cranialNerves: [''], reflexes: [''], coordination: [''],
      mskInspection: [''], rom: [''], swelling: [''], warmth: [''],
      redness: [''], deformities: [''], crepitation: [''], muscleStrength: [''],
      investigations: [''],
    }),

    mentalState: this.fb.group({
      rel_Father_Status: [''], rel_Mother_Status: [''],
      rel_Brother_Status: [''], rel_Sister_Status: [''],
      rel_Husband_Status: [''], rel_Wife_Status: [''],
      rel_Son_Status: [''], rel_Daughter_Status: [''],
      rel_PaternalGrandfather_Status: [''], rel_PaternalGrandmother_Status: [''],
      rel_MaternalGrandfather_Status: [''], rel_MaternalGrandmother_Status: [''],
      rel_FatherInLaw_Status: [''], rel_MotherInLaw_Status: [''],
      rel_BrotherInLaw_Status: [''], rel_SisterInLaw_Status: [''],
      rel_Family_Status: [''], rel_Work_Status: [''],
      rel_Friends_Status: [''], rel_Finance_Status: [''],
      rel_Social_Status: [''], rel_Authority_Status: [''],
      mentalStateEvaluation: [''],
      angerSadnessTriangles_Remark: [''],
      fearAnxietyTriangles_Remark: [''],
      remarkAngerSadness: [''],
      remarkAttachments: [''],
      remarkLoveHate: [''],
      remarkFearAnxiety: [''],
    }),

    intellectualState: this.fb.group({
      capacityPerformanceRatio: [0],
      perception: [''], memory: [''], thinking: [''],
      decision: [''], confidence: [''],
    }),

    behavioralEvaluation: this.fb.group({
      childhood_Scholastic: [''], childhood_HomeEnvironment: [''],
      childhood_Finance: [''], childhood_Difficulties: [''],
      action_Speech: [''], action_Behaviour: [''], action_Description: [''],
      block_Emotional: [false], block_Motivational: [false],
      block_Intellectual: [false], block_IPR: [false],
      block_Social: [false], block_Domestic: [false], block_Work: [false],
      block_Notes: [''],
      sensory_Noise: [''], sensory_Odour: [''],
      sensory_Colour: [''], sensory_Light: [''],
      sensory_Music: [''], sensory_Touch: [''],
      sensory_Rubbing: [''], sensory_Climate: [''],
      miasmatic_Fundamental: [''], miasmatic_Dominant: [''],
      rubrics: [''], provisionalDiagnosis: [''],
      finalDiagnosis: [''], firstPrescription: [''],
      generalInstructions: [''],
    }),
  });

  constructor(
    private fb: FormBuilder,
    private medicalExamApi: MedicalExaminationService,
    private alertCtrl: AlertController,
    private route: ActivatedRoute,
    private toastCtrl: ToastController,
    private router: Router,
  ) {}

  // =====================
  // INIT / DESTROY
  // =====================
  ngOnInit(): void {
    this.initMedicalBmiAutoCalc();

    this.sub.add(
      this.route.queryParams.subscribe((qp) => {
        const id = safeNum(qp?.['patientId']);

        if (id > 0) {
          this.patientId = id;
          void this.loadClinicalCaseIfExists();
        } else {
          this.patientId = null;
          this.resetMedicalForm();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // BMI AUTO CALC
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
    this.medicalExists = false;
  }

  // ============================================================
  // RELATIONSHIP BUTTONS
  // ============================================================
  toggleStatus(key: string) {
    const g = this.medicalForm.get('mentalState') as FormGroup;
    const cur = (g?.get(key)?.value ?? '').toString().trim();
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
  // AUTOFILL (demo data)
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
  // SAVE RECORD
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

    const chief = this.complaintFrom(v?.complaints?.chief, 'Chief');
    const associated = this.complaintFrom(v?.complaints?.associated, 'Associated');
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

      physicalExamination: {
        height: this.s(pe?.heightMeters),
        weight: this.s(pe?.weightKg),
        bmi: this.s(pe?.bmi),
        weightCategory: this.s(pe?.bmiCategory),
        physicalAppearance: this.s(pe?.physicalAppearance),
        digestion: this.s(pe?.dejection),
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
        spO2: this.s(pe?.spo2),
        percussion_RS: this.s(pe?.rsPercussion),
        rr: this.s(pe?.rr),
        airEntry: this.s(pe?.airEntry),
        breathSounds: this.s(pe?.breathSounds),
        pA_SizeShapeSkin: this.s(pe?.paSizeShapeSkin),
        pA_Movement: this.s(pe?.paMovement),
        pA_Percussion: this.s(pe?.paPercussion),
        hgt: this.s(pe?.hst),
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
        ...ms,
        angerSadnessTriangles_Remark: this.s(
          ms?.remarkAngerSadness || ms?.angerSadnessTriangles_Remark,
        ),
        fearAnxietyTriangles_Remark: this.s(
          ms?.remarkFearAnxiety || ms?.fearAnxietyTriangles_Remark,
        ),
        spectrum_LoveHate: safeNum(ms?.spectrum_LoveHate ?? 0),
        spectrum_LaveHate_Remark: this.s(
          ms?.remarkLoveHate || ms?.spectrum_LaveHate_Remark,
        ),
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
        await firstValueFrom(this.medicalExamApi.update(payload));
        this.medicalForm.markAsPristine();
        await this.toast('Clinical case updated');
      } else {
        await firstValueFrom(this.medicalExamApi.create(payload));
        this.medicalForm.markAsPristine();
        this.medicalExists = true;
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
  // LOAD FROM API
  // ============================================================
  async loadClinicalCaseIfExists() {
    if (!this.patientId) return;

    try {
      const res: any = await firstValueFrom(
        this.medicalExamApi.getByPatientId(this.patientId),
      );
      const data = res?.data ?? res;

      if (!data) {
        this.medicalExists = false;
        return;
      }

      this.patchMedicalFormFromApi(data);
      this.medicalForm.markAsPristine();
      this.medicalExists = true;
    } catch (e: any) {
      if (e?.status === 404) {
        this.medicalExists = false;
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
      complaintType: '', location: '', sensation: '', modality: '', concomitant: '',
    };

    const chief = complaints.find((c) => c?.complaintType === 'Chief') || emptyComplaint;
    const associated = complaints.find((c) => c?.complaintType === 'Associated') || emptyComplaint;
    const pastHistory = complaints.find((c) => c?.complaintType === 'PastHistory') || emptyComplaint;

    const pe: any = api?.physicalExamination || {};
    const ms: any = api?.mentalState || {};

    this.medicalForm.patchValue(
      {
        complaints: {
          chief: { location: chief.location || '', sensation: chief.sensation || '', modality: chief.modality || '', concomitant: chief.concomitant || '' },
          associated: { location: associated.location || '', sensation: associated.sensation || '', modality: associated.modality || '', concomitant: associated.concomitant || '' },
          past: { location: pastHistory.location || '', sensation: pastHistory.sensation || '', modality: pastHistory.modality || '', concomitant: pastHistory.concomitant || '' },
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
          remarkLoveHate: ms?.spectrum_LaveHate_Remark || '',
          remarkAngerSadness: ms?.angerSadnessTriangles_Remark || '',
          remarkFearAnxiety: ms?.fearAnxietyTriangles_Remark || '',
        },
        behavioralEvaluation: api?.behavioralEvaluation || {},
      },
      { emitEvent: false },
    );
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  goPrevIdentity() {
    this.router.navigate([], {
      queryParams: { tab: 'prelim', patientId: this.patientId },
      queryParamsHandling: 'merge',
    });
  }

  goNextFollowUp() {
    this.router.navigate([], {
      queryParams: { tab: 'followup', patientId: this.patientId },
      queryParamsHandling: 'merge',
    });
  }

  // ============================================================
  // UTIL
  // ============================================================
  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, position: 'top' });
    await t.present();
  }

  private async presentSimpleAlert(header: string, message: string) {
    const a = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await a.present();
  }
}