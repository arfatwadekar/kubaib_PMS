import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, Subscription, takeUntil, firstValueFrom } from 'rxjs';

import {
  MedicalExaminationService,
  ClinicalCasePayload,
} from 'src/app/services/medical-examination.service';
import { getErrorMessage } from 'src/app/shared/utils/error-message.util';

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

type ComplaintField = 'location' | 'sensation' | 'modality' | 'concomitant';
type ComplaintRow = Record<ComplaintField, string>;
type ComplaintSectionKey = 'chief' | 'associated' | 'past';

@Component({
  selector: 'app-medical',
  templateUrl: './medical.page.html',
  styleUrls: ['./medical.page.scss'],
  standalone: false,
})
export class MedicalPage implements OnInit, OnDestroy {
  // =====================
  // STATE
  // =====================
  loading = false;
  initialLoading = false;
  patientId: number | null = null;
  medicalExists = false;
  openSection: string = 's1';
private onWindowResize = () => this.autoGrowAllComplaintRows();
  // ⭐ AUTO-SAVE STATE
  private isAutoSaving = false;
  private autoSaveInProgress = false;

  private destroy$ = new Subject<void>();
  private sub = new Subscription();

  role: 'Doctor' | 'Receptionist' = 'Receptionist';
isReadonly = false;

  // Complaints & History table — one row per complaint point, shared
  // across all 4 columns (L/S/M/C) so they stay vertically in sync:
  // whichever column's text wraps tallest sets the row height, and the
  // shorter columns just get blank space before the next point.
  complaintFields: ComplaintField[] = ['location', 'sensation', 'modality', 'concomitant'];
  // Keyed loosely by string (not ComplaintSectionKey) so the template's
  // inline `section.key` — which Angular widens to `string` — can index it.
  complaintRows: Record<string, ComplaintRow[]> = {
    chief: [this.emptyComplaintRow()],
    associated: [this.emptyComplaintRow()],
    past: [this.emptyComplaintRow()],
  };

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
  ) {
    // ⭐ Handle browser back button and route changes
    this.setupAutoSaveOnNavigation();
  }

  // =====================
  // INIT / DESTROY
  // =====================
  ngOnInit(): void {
    this.loadRole();
    this.initMedicalBmiAutoCalc();

    this.sub.add(
      this.route.queryParams.subscribe((qp) => {
        const id = safeNum(qp?.['patientId']);

        if (id > 0) {
          this.patientId = id;
          this.medicalExists = false;
          this.initialLoading = true;
          void this.loadClinicalCaseIfExists();
        } else {
          this.patientId = null;
          this.resetMedicalForm();
        }
      })
    );

    if (this.isReadonly) {
    this.medicalForm.disable({ emitEvent: false });
  }

   // 👇 NEW — width change hone par bhi heights recalc ho
  window.addEventListener('resize', this.onWindowResize);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('resize', this.onWindowResize);
  }

  // ============================================================
  // ⭐ AUTO-SAVE ON NAVIGATION
  // ============================================================
  /**
   * Setup listeners to auto-save form when user navigates away
   */
  private setupAutoSaveOnNavigation(): void {
    // Listen to route changes (tab/page navigation)
    this.router.events
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Check if form has unsaved changes and auto-save
        if (this.medicalForm?.dirty && !this.isAutoSaving && this.patientId) {
          void this.autoSaveBeforeNavigation();
        }
      });

    // Listen to window beforeunload (browser back/close)
    window.addEventListener('beforeunload', (event) => {
      if (this.medicalForm?.dirty && !this.isAutoSaving && this.patientId) {
        event.preventDefault();
        // Modern browsers require returnValue to be set
        event.returnValue = '';
      }
    });
  }

  /**
   * Auto-save before navigation with silent success
   */
  private async autoSaveBeforeNavigation(): Promise<void> {
    if (
      !this.patientId ||
      this.autoSaveInProgress ||
      !this.medicalForm?.dirty ||
      this.initialLoading
    ) {
      return;
    }

    this.isAutoSaving = true;
    this.autoSaveInProgress = true;

    try {
      const payload = this.buildClinicalCasePayload();

      if (this.medicalExists) {
        await firstValueFrom(this.medicalExamApi.update(payload));
      } else {
        await firstValueFrom(this.medicalExamApi.create(payload));
        this.medicalExists = true;
      }

      // Mark form as pristine after successful save
      this.medicalForm.markAsPristine();

      console.log('✅ Auto-saved medical record');
    } catch (error: any) {
      console.error('❌ Auto-save failed:', error);
      // Show error toast but don't block navigation
      await this.toast(
        'Warning: Changes could not be auto-saved. Please check your connection.',
        'warning'
      );
    } finally {
      this.isAutoSaving = false;
      this.autoSaveInProgress = false;
    }
  }

  // ============================================================
  // COMPLAINTS & HISTORY — POINT-ROW TABLE
  // Each complaint point is one row shared across all 4 columns
  // (L/S/M/C). Using a real DOM row per point (instead of 4 independent
  // free-text blobs) lets the browser sync each row's height to its
  // tallest cell for free, so point 2 always starts at the same Y in
  // every column even if only one column's point 1 wrapped. The row
  // number is just the row's position (never stored inline); the flat
  // "1. .../2. ..." strings the API expects are derived from the rows
  // on every edit, and parsed back into rows on load.
  // ============================================================
  private emptyComplaintRow(): ComplaintRow {
    return { location: '', sensation: '', modality: '', concomitant: '' };
  }

  private parseNumberedField(value: string): Map<number, string> {
    const map = new Map<number, string>();
    (value || '').split('\n').forEach((line) => {
      const m = line.match(/^(\d+)\.\s?(.*)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > 0) map.set(n - 1, m[2]);
      }
    });
    return map;
  }

  private syncComplaintFormFromRows(sectionKey: string): void {
    const rows = this.complaintRows[sectionKey];
    const group = this.medicalForm.get(['complaints', sectionKey]) as FormGroup;

    this.complaintFields.forEach((field) => {
      let text = rows
        .map((row, i) => ({ i, text: (row[field] || '').trim() }))
        .filter((x) => x.text)
        .map((x) => `${x.i + 1}. ${x.text}`)
        .join('\n');

      if (text.length > 1000) text = text.slice(0, 1000);
      group.get(field)?.setValue(text, { emitEvent: false });
    });

    group.markAsDirty();
  }

  private buildComplaintRowsFromForm(sectionKey: string): void {
    const group = this.medicalForm.get(['complaints', sectionKey]) as FormGroup;
    const parsed = this.complaintFields.map((field) =>
      this.parseNumberedField(group.get(field)?.value || ''),
    );

    let rowCount = 0;
    parsed.forEach((map) => map.forEach((_v, i) => (rowCount = Math.max(rowCount, i + 1))));
    if (rowCount === 0) rowCount = 1;

    const rows: ComplaintRow[] = [];
    for (let i = 0; i < rowCount; i++) {
      const row = this.emptyComplaintRow();
      this.complaintFields.forEach((field, fIdx) => (row[field] = parsed[fIdx].get(i) || ''));
      rows.push(row);
    }
    this.complaintRows[sectionKey] = rows;
  }

  private buildAllComplaintRowsFromForm(): void {
    (['chief', 'associated', 'past'] as ComplaintSectionKey[]).forEach((k) =>
      this.buildComplaintRowsFromForm(k),
    );
  }

private autoGrowRow(rowEl: Element): void {
  const textareas = Array.from(rowEl.querySelectorAll('textarea')) as HTMLTextAreaElement[];
  if (!textareas.length) return;

  textareas.forEach((t) => (t.style.height = 'auto'));
  const maxHeight = Math.max(40, ...textareas.map((t) => t.scrollHeight)) + 8;
  textareas.forEach((t) => (t.style.height = `${maxHeight}px`));
}
  autoGrowAllComplaintRows(): void {
    setTimeout(() => {
      document.querySelectorAll('.table-row').forEach((row) => this.autoGrowRow(row));
    });
  }

  // <textarea> elements have their own native scroll handling and don't
  // reliably chain mouse-wheel scrolls up to a scrollable ancestor even when
  // they have no overflow of their own — so scrolling the mouse wheel while
  // hovering over the text would otherwise do nothing. Forward it manually.
  // onComplaintWheel(event: WheelEvent): void {
  //   const textarea = event.target as HTMLTextAreaElement;
  //   const wrapper = textarea.closest('.table-row-scroll') as HTMLElement | null;
  //   if (!wrapper) return;

  //   event.preventDefault();
  //   wrapper.scrollTop += event.deltaY;
  // }
  
  // Remove this — no longer needed once .table-row-scroll isn't scrollable
onComplaintWheel(event: WheelEvent): void {
  const textarea = event.target as HTMLTextAreaElement;
  const wrapper = textarea.closest('.table-row-scroll') as HTMLElement | null;
  if (!wrapper) return;

  event.preventDefault();
  wrapper.scrollTop += event.deltaY;
}

  // onComplaintRowInput(
  //   event: Event,
  //   sectionKey: string,
  //   rowIndex: number,
  //   field: ComplaintField,
  // ): void {
  //   const textarea = event.target as HTMLTextAreaElement;
  //   this.complaintRows[sectionKey][rowIndex][field] = textarea.value;
  //   this.syncComplaintFormFromRows(sectionKey);

  //   const row = textarea.closest('.table-row');
  //   if (row) this.autoGrowRow(row);
  // }

  onComplaintRowInput(
  event: Event,
  sectionKey: string,
  rowIndex: number,
  field: ComplaintField,
): void {
  const textarea = event.target as HTMLTextAreaElement;
  this.complaintRows[sectionKey][rowIndex][field] = textarea.value;

  // 👇 Agar user LAST row me type kar raha hai aur usme kuch text aa gaya
  // hai, to ek naya blank row automatically end me add kar do — user ko
  // Enter dabane ki zaroorat nahi, agli row apne aap ready mil jaati hai.
  const rows = this.complaintRows[sectionKey];
  const isLastRow = rowIndex === rows.length - 1;
  const rowHasContent = this.complaintFields.some((f) => (rows[rowIndex][f] || '').trim());

  if (isLastRow && rowHasContent) {
    rows.push(this.emptyComplaintRow());
  }

  this.syncComplaintFormFromRows(sectionKey);

  const row = textarea.closest('.table-row');
  if (row) this.autoGrowRow(row);
}

  private focusComplaintCell(
    sectionKey: string,
    rowIndex: number,
    field: ComplaintField,
    atEnd = false,
  ): void {
    setTimeout(() => {
      const el = document.querySelector(
        `.table-wrap[data-section="${sectionKey}"] .table-row[data-row-index="${rowIndex}"] textarea[data-field="${field}"]`,
      ) as HTMLTextAreaElement | null;
      if (!el) return;

      el.focus();
      if (atEnd) el.setSelectionRange(el.value.length, el.value.length);

      const row = el.closest('.table-row');
      if (row) this.autoGrowRow(row);
    });
  }

  onComplaintRowKeydown(
    event: KeyboardEvent,
    sectionKey: string,
    rowIndex: number,
    field: ComplaintField,
  ): void {
    if (this.isReadonly) return;
    const textarea = event.target as HTMLTextAreaElement;

    // if (event.key === 'Enter' && !event.shiftKey) {
    //   event.preventDefault();
    //   const rows = this.complaintRows[sectionKey];
    //   rows.splice(rowIndex + 1, 0, this.emptyComplaintRow());
    //   this.syncComplaintFormFromRows(sectionKey);
    //   this.focusComplaintCell(sectionKey, rowIndex + 1, field);
    //   return;
    // }

    if (event.key === 'Enter' && !event.shiftKey) {
  event.preventDefault();
  const rows = this.complaintRows[sectionKey];

  // 👇 Agar agli row already khaali hai (auto-add ne bana di thi jab is
  // row me type kiya tha), to dobara nayi row mat banao — sirf usi
  // khaali row pe focus kar do. Warna duplicate blank row ban jaati thi.
  const nextRow = rows[rowIndex + 1];
  const nextRowIsEmpty =
    !!nextRow && this.complaintFields.every((f) => !nextRow[f]);

  if (!nextRowIsEmpty) {
    rows.splice(rowIndex + 1, 0, this.emptyComplaintRow());
    this.syncComplaintFormFromRows(sectionKey);
  }

  this.focusComplaintCell(sectionKey, rowIndex + 1, field);
  return;
}

    if (event.key === 'Backspace') {
      const rows = this.complaintRows[sectionKey];
      const row = rows[rowIndex];
      const rowIsEmpty = this.complaintFields.every((f) => !row[f]);
      const atStart = (textarea.selectionStart ?? 0) === 0 && (textarea.selectionEnd ?? 0) === 0;

      if (rowIsEmpty && atStart && rows.length > 1) {
        event.preventDefault();
        rows.splice(rowIndex, 1);
        this.syncComplaintFormFromRows(sectionKey);
        this.focusComplaintCell(sectionKey, Math.max(0, rowIndex - 1), field, true);
      }
    }
  }

  // Pasted text (already numbered, or one point per line) becomes new rows,
  // starting in the pasted-into field of the current row.
  onComplaintPaste(
    event: ClipboardEvent,
    sectionKey: string,
    rowIndex: number,
    field: ComplaintField,
  ): void {
    if (this.isReadonly) return;

    const pasted = event.clipboardData?.getData('text/plain');
    if (!pasted || !pasted.trim()) return;

    const items = this.splitIntoListItems(pasted);
    if (items.length <= 1) return; // let the default single-line paste happen

    event.preventDefault();

    const rows = this.complaintRows[sectionKey];
    rows[rowIndex][field] = items[0];
    for (let k = 1; k < items.length; k++) {
      const insertAt = rowIndex + k;
      if (!rows[insertAt]) rows.splice(insertAt, 0, this.emptyComplaintRow());
      rows[insertAt][field] = items[k];
    }

    this.syncComplaintFormFromRows(sectionKey);
    this.autoGrowAllComplaintRows();
  }

  // Splits pasted clipboard text into individual list items: prefers existing
  // "1. " / "1) " numbering, falls back to one item per non-empty line.
  private splitIntoListItems(text: string): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const numberedSplit = normalized
      .split(/\s*\d+[.)]\s+/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (numberedSplit.length > 1) {
      return numberedSplit;
    }

    const lineSplit = normalized
      .split('\n')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    return lineSplit.length ? lineSplit : [normalized.replace(/\s+/g, ' ').trim()];
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
    this.complaintRows = {
      chief: [this.emptyComplaintRow()],
      associated: [this.emptyComplaintRow()],
      past: [this.emptyComplaintRow()],
    };
  }

  // ============================================================
  // RELATIONSHIP BUTTONS
  // ============================================================
  // toggleStatus(key: string) {
  //   const g = this.medicalForm.get('mentalState') as FormGroup;
  //   const cur = (g?.get(key)?.value ?? '').toString().trim();
  //   const next = cur === '' ? 'P' : cur === 'P' ? 'N' : '';
  //   g?.patchValue({ [key]: next }, { emitEvent: false });
  //   g?.markAsDirty();
  // }

  toggleStatus(key: string) {
    if (this.isReadonly) return;

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

    const fillControls = (group: any) => {
      Object.keys(group.controls).forEach(key => {
        const control = group.get(key);

        if (control instanceof FormGroup) {
          fillControls(control);
        } else {
          const value = control.value;

          if (value === null || value === '' || value === undefined) {
            if (typeof value === 'boolean') {
              control.setValue(false);
            } else if (typeof value === 'number') {
              control.setValue(50);
            } else {
              control.setValue('Normal');
            }
          }
        }
      });
    };

    fillControls(this.medicalForm);
    this.medicalForm.markAsDirty();
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
    if (this.loading || this.initialLoading) return;

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
      // ⭐ redirect after save/update
      this.goNextFollowUp();
    } catch (e: any) {
      await this.presentSimpleAlert(
        'Save Failed',
        getErrorMessage(e, 'Failed to save clinical case'),
      );
    } finally {
      this.loading = false;
    }
  }

  // ============================================================
  // LOAD FROM API
  // ============================================================
  async loadClinicalCaseIfExists() {
    if (!this.patientId) {
      this.initialLoading = false;
      return;
    }

    try {
      const res: any = await firstValueFrom(
        this.medicalExamApi.getByPatientId(this.patientId)
      );

      const data = res?.data ?? res;

      // ⭐ check if medical record actually exists
      if (
        !data ||
        (
          (!data.complaints || data.complaints.length === 0) &&
          !data.familyHistory &&
          !data.personalStatus &&
          !data.menstrualHistory &&
          !data.maleSexualFunction &&
          !data.physicalReaction &&
          !data.physicalExamination &&
          !data.mentalState &&
          !data.behavioralEvaluation
        )
      ) {
        this.medicalExists = false;
        return;
      }

      this.patchMedicalFormFromApi(data);
      this.buildAllComplaintRowsFromForm();
      this.medicalForm.markAsPristine();
      this.medicalExists = true;
      this.autoGrowAllComplaintRows();

if (this.isReadonly) {
  this.medicalForm.disable({ emitEvent: false });
}
    } catch (e: any) {
      if (e?.status === 404) {
        this.medicalExists = false;
        return;
      }

      this.medicalExists = false;
    } finally {
      this.initialLoading = false;
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
          // ✅ Added intellectualState restoration
    intellectualState: {
      capacityPerformanceRatio: safeNum(ms?.intellect_Value ?? 0),
      perception: this.s(ms?.intellect_Perception),
      memory: this.s(ms?.intellect_Memory),
      thinking: this.s(ms?.intellect_Thinking),
      decision: this.s(ms?.intellect_Decision),
      confidence: this.s(ms?.intellect_Confidence),
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
  this.router.navigate(['../prelim'], {
    relativeTo: this.route,
    queryParams: {
      patientId: this.patientId,
      appointmentId: this.route.snapshot.queryParamMap.get('appointmentId'),
      tab: 'prelim'
    },
    queryParamsHandling: 'merge'
  });
}
  goNextFollowUp() {
    this.router.navigate(['../followup'], {
      relativeTo: this.route,
      queryParams: {
        patientId: this.patientId,
        appointmentId: this.route.snapshot.queryParamMap.get('appointmentId'),
        tab: 'followup'
      },
      queryParamsHandling: 'merge'
    });
  }

  // ============================================================
  // UTIL
  // ============================================================
  private async toast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    const t = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
      color: type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'success',
    });
    await t.present();
  }

  private async presentSimpleAlert(header: string, message: string) {
    const a = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await a.present();
  }

onAccordionChange(event: any) {
  event.preventDefault();
  // Section open hote hi heights dobara calculate karo — collapsed
  // accordion ke andar textarea ka scrollHeight galat/0 aata hai
  this.autoGrowAllComplaintRows();
}

private loadRole() {
  const raw = (localStorage.getItem('mhc_role') || '').toLowerCase();
  this.role = raw === 'doctor' ? 'Doctor' : 'Receptionist';

  // ⭐ MAIN LOGIC
  this.isReadonly = this.role === 'Receptionist';
}
}
