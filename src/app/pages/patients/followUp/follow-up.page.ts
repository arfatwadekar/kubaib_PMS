import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import {
  FollowUpService,
  FollowUpCriteriaDto,
} from 'src/app/services/follow-up.service';

type FollowUpVisitUI = {
  date: string; // YYYY-MM-DD
  interpretation: string;
  temporaryProblems: string;
  consultationCharges: number;
  scores: string[];
};

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toIsoFromYmd(ymd: string): string {
  // "YYYY-MM-DD" => ISO in UTC
  return new Date(`${ymd}T00:00:00.000Z`).toISOString();
}

@Component({
  selector: 'app-follow-up',
  templateUrl: './follow-up.page.html',
  styleUrls: ['./follow-up.page.scss'],
  standalone: false,
})
export class FollowUpPage implements OnInit, OnDestroy {
  loading = false;
  patientId: number | null = null;

  // UI state
  showVisitForm = false;
  isCriteriaSaved = false; // first time false, returning true
  visits: FollowUpVisitUI[] = []; // UI-only (until GET followup list exists)

  private destroy$ = new Subject<void>();

  // backend criteria cache (IDs mapping)
  criteriaFromDb: FollowUpCriteriaDto[] = [];

  // -----------------------------
  // Forms
  // -----------------------------
  referenceForm = this.fb.group({
    symptoms: this.fb.array([]), // 10 rows (criteriaNames)
  });

  visitForm = this.fb.group({
    date: [todayYmd(), Validators.required],
    symptomsScore: this.fb.array([]), // 10 remarks
    interpretation: [''],
    temporaryProblems: [''],
    consultationCharges: [0],
  });

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private fu: FollowUpService
  ) {}

  ngOnInit(): void {
    this.initReferenceRows(10);
    this.initVisitScoreRows(10);

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(async (qp) => {
      const id = Number(qp?.['patientId'] ?? 0);
      this.patientId = id > 0 ? id : null;

      if (!this.patientId) return;

      // check existing criteria to decide first-time vs returning
      await this.loadCriteriaAndPatchUI();

      // if first time => show visit form directly (date + save)
      this.showVisitForm = !this.isCriteriaSaved;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // -----------------------------
  // Form arrays
  // -----------------------------
  get refSymptomsArr(): FormArray {
    return this.referenceForm.get('symptoms') as FormArray;
  }

  get visitScoresArr(): FormArray {
    return this.visitForm.get('symptomsScore') as FormArray;
  }

  private initReferenceRows(n: number) {
    if (this.refSymptomsArr.length) return;
    for (let i = 0; i < n; i++) this.refSymptomsArr.push(this.fb.control(''));
  }

  private initVisitScoreRows(n: number) {
    if (this.visitScoresArr.length) return;
    for (let i = 0; i < n; i++) this.visitScoresArr.push(this.fb.control(''));
  }

  // -----------------------------
  // UI actions
  // -----------------------------
  openFollowUpVisit() {
    if (!this.patientId) {
      this.toast('PatientId missing. Open from patient flow.');
      return;
    }
    // returning patient => button click shows the visit card
    this.showVisitForm = true;

    // reset visit inputs for new visit
    this.visitForm.patchValue(
      {
        date: todayYmd(),
        interpretation: '',
        temporaryProblems: '',
        consultationCharges: 0,
      },
      { emitEvent: false }
    );
    this.visitScoresArr.controls.forEach((c) => c.setValue('', { emitEvent: false }));
  }

  closeVisitForm() {
    // returning patient: close visit card
    if (this.isCriteriaSaved) this.showVisitForm = false;
  }

  goPrevPhysicalExam() {
    this.router.navigate(['/patients/medical-examination'], {
      queryParams: { patientId: this.patientId },
    });
  }

  goNextPayment() {
    this.router.navigate(['/patients/create-patient'], {
      queryParams: { patientId: this.patientId, tab: 'payment' },
    });
  }

  // -----------------------------
  // SAVE (button only)
  // -----------------------------
  async saveRecord() {
    if (!this.patientId) {
      await this.toast('PatientId missing. Open from patient flow.');
      return;
    }

    if (this.visitForm.invalid) {
      this.visitForm.markAllAsTouched();
      await this.toast('Please select Follow Up date.');
      return;
    }

    const criteriaNames = this.getCriteriaNames10();
    if (criteriaNames.filter(Boolean).length === 0) {
      await this.toast('Please enter at least 1 symptom in reference list.');
      return;
    }

    this.loading = true;
    try {
      // FIRST TIME: save criteria first
      if (!this.isCriteriaSaved) {
        await firstValueFrom(
          this.fu.createCriteria({
            patientId: this.patientId,
            criteriaNames: criteriaNames.filter(Boolean),
          })
        );
      }

      // Always load criteria IDs (needed for /api/FollowUp payload)
      await this.loadCriteriaAndPatchUI();

      // Save FollowUp entry
      await this.saveFollowUpEntry(criteriaNames);

      // Auto-create appointment on same follow up date
      await this.createAppointmentOnDate(this.visitForm.value.date || todayYmd());

      // UI handling
      this.isCriteriaSaved = true;
      this.showVisitForm = false;

      await this.toast('Saved');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Save failed';
      const a = await this.alertCtrl.create({
        header: 'Save Failed',
        message: msg,
        buttons: ['OK'],
      });
      await a.present();
    } finally {
      this.loading = false;
    }
  }

  // -----------------------------
  // Internals
  // -----------------------------
  private getCriteriaNames10(): string[] {
    const arr = (this.referenceForm.value.symptoms || []).map((x: any) =>
      (x ?? '').toString().trim()
    );
    // ensure exactly 10 slots
    while (arr.length < 10) arr.push('');
    return arr.slice(0, 10);
  }

  private async loadCriteriaAndPatchUI() {
    if (!this.patientId) return;

    try {
      const res: any = await firstValueFrom(this.fu.getCriteriaByPatient(this.patientId));
      const list = res?.data ?? res ?? [];
      this.criteriaFromDb = Array.isArray(list) ? list : [];

      this.isCriteriaSaved = this.criteriaFromDb.length > 0;

      // Patch criteria names into form if DB has them
      if (this.isCriteriaSaved) {
        const names = this.criteriaFromDb.map((x) => (x?.criteriaName ?? '').toString());
        for (let i = 0; i < 10; i++) {
          this.refSymptomsArr.at(i)?.setValue(names[i] || '', { emitEvent: false });
        }
      }
    } catch {
      // If GET fails, treat as first-time
      this.criteriaFromDb = [];
      this.isCriteriaSaved = false;
    }
  }

  private async saveFollowUpEntry(criteriaNames10: string[]) {
    const v = this.visitForm.value;
    const scores = (v.symptomsScore || []).map((x: any) => (x ?? '').toString());
    while (scores.length < 10) scores.push('');

    // Map criteriaName -> id
    const idByName = new Map<string, number>();
    this.criteriaFromDb.forEach((c) => {
      const name = (c?.criteriaName ?? '').toString().trim();
      if (name) idByName.set(name, Number(c?.patientFollowUpCriteriaId || 0));
    });

    const statusRecords = criteriaNames10.map((name, idx) => ({
      patientFollowUpStatusId: 0,
      patientFollowUpCriteriaId: idByName.get(name) || 0, // should be >0 after GET
      criteriaName: name || `Criteria ${idx + 1}`,
      remarks: scores[idx] || '',
    }));

    const payload = {
      patientFollowUpEntryId: 0,
      patientId: this.patientId!,
      followUpDate: toIsoFromYmd((v.date || todayYmd()).toString()),
      interpretation: (v.interpretation || '').toString(),
      charge: Number(v.consultationCharges || 0) || 0,
      statusRecords,
    };

    await firstValueFrom(this.fu.createFollowUp(payload));

    // UI preview add
    this.visits = [
      {
        date: (v.date || todayYmd()).toString(),
        interpretation: (v.interpretation || '').toString(),
        temporaryProblems: (v.temporaryProblems || '').toString(),
        consultationCharges: Number(v.consultationCharges || 0) || 0,
        scores: scores.slice(0, 10),
      },
      ...this.visits,
    ];
  }

  private async createAppointmentOnDate(dateYmd: string) {
    // swagger needs appointmentTime.ticks - keep 0
    const payload = {
      patientId: this.patientId!,
      appointmentDate: dateYmd, // swagger says "2026-01-30"
      appointmentTime: { ticks: 0 },
      remark: 'Auto-created from Follow Up',
    };

    await firstValueFrom(this.fu.createAppointment(payload));
  }

  trackByIndex(i: number) {
    return i;
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
    });
    await t.present();
  }
}
