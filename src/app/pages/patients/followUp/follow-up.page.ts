import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';

type FollowUpVisitUI = {
  date: string;
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
  isCriteriaSaved = false; // first visit false, returning true
  showVisitForm = false;
  visits: FollowUpVisitUI[] = [];

  private destroy$ = new Subject<void>();

  referenceForm = this.fb.group({
    symptoms: this.fb.array([]), // 10
  });

  visitForm = this.fb.group({
    date: [todayYmd(), Validators.required],
    symptomsScore: this.fb.array([]), // 10
    interpretation: [''],
    temporaryProblems: [''],
    consultationCharges: [0],
  });

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    this.initReferenceRows(10);
    this.initVisitScoreRows(10);

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qp) => {
      const id = Number(qp?.['patientId'] ?? 0);
      this.patientId = id > 0 ? id : null;

      // DEMO: yaha pe tu API se check karega criteria saved hai ya nahi
      // Abhi UI ke liye: agar patientId aaya => criteria saved maan lo
      this.isCriteriaSaved = !!this.patientId;

      // First visit -> criteria fill & save; returning -> follow up visit button enable
      this.showVisitForm = false;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- Arrays ----------
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

  // ---------- UI actions ----------
  openFollowUpVisit() {
    if (!this.isCriteriaSaved) return;
    this.showVisitForm = true;

    this.visitForm.patchValue(
      { date: todayYmd(), interpretation: '', temporaryProblems: '', consultationCharges: 0 },
      { emitEvent: false }
    );
    this.visitScoresArr.controls.forEach((c) => c.setValue('', { emitEvent: false }));
  }

  closeVisitForm() {
    this.showVisitForm = false;
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

  async saveRecord() {
    // UI-only demo save
    if (!this.patientId) {
      await this.toast('PatientId missing.');
      return;
    }
    this.loading = true;

    setTimeout(async () => {
      this.loading = false;
      await this.toast('Saved');
      this.showVisitForm = false;
    }, 600);
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
