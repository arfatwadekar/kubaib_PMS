import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, Subscription, takeUntil, firstValueFrom } from 'rxjs';

import {
  FollowUpService,
  FollowUpCriteriaDto,
} from 'src/app/services/follow-up.service';

// =====================
// Helpers
// =====================
function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function safeStr(v: any): string {
  return (v ?? '').toString().trim();
}

@Component({
  selector: 'app-followup',
  templateUrl: './followup.page.html',
  styleUrls: ['./followup.page.scss'],
  standalone: false,
})
export class FollowupPage implements OnInit, OnDestroy {
  // =====================
  // STATE
  // =====================
  patientId: number | null = null;
  fuLoading = false;
  fuCriteriaSaved = false;
  fuCriteriaEditMode = false;

  private fuCriteriaFromDb: FollowUpCriteriaDto[] = [];
  private readonly FU_INIT_ROWS = 6;
  private readonly FU_ADD_STEP = 2;
  private readonly FU_MAX_ROWS = 30;

  private destroy$ = new Subject<void>();
  private sub = new Subscription();

  // =====================
  // FORM
  // =====================
  fuCriteriaForm = this.fb.group({
    symptoms: this.fb.array([]),
  });

  get fuSymptomsArr(): FormArray {
    return this.fuCriteriaForm.get('symptoms') as FormArray;
  }

  get fuHasAtLeastOneSymptom(): boolean {
    return (
      (this.fuCriteriaForm.getRawValue().symptoms || [])
        .map((x: any) => (x ?? '').toString().trim())
        .filter(Boolean).length > 0
    );
  }

  constructor(
    private fb: FormBuilder,
    private fuApi: FollowUpService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  // =====================
  // INIT / DESTROY
  // =====================
  ngOnInit(): void {
    this.initFollowUpEmpty();

    this.sub.add(
      this.route.queryParams.subscribe((qp) => {
        const id = safeNum(qp?.['patientId']);

        if (id > 0) {
          this.patientId = id;
          void this.loadFollowUpCriteria(false);
        } else {
          this.patientId = null;
          this.resetFollowUpView();
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =====================
  // INIT ROWS
  // =====================
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
    this.fuCriteriaEditMode = false;
    this.fuCriteriaFromDb = [];

    this.fuCriteriaForm.reset();
    (this.fuCriteriaForm.get('symptoms') as FormArray).clear();
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

  // =====================
  // LOAD FROM DB
  // =====================
  async loadFollowUpCriteria(debug = false) {
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
        if (!this.fuCriteriaEditMode) {
          this.fuSymptomsArr.at(i).disable({ emitEvent: false });
        }
      }

      this.fuCriteriaEditMode = false;
    } else {
      this.fuCriteriaEditMode = false;
      for (let i = 0; i < this.fuSymptomsArr.length; i++) {
        this.fuSymptomsArr.at(i).enable({ emitEvent: false });
      }
    }

    if (debug) console.log('[FU][criteria]', res);
  }

  // =====================
  // SAVE / UPDATE CRITERIA
  // =====================
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
      if (this.fuCriteriaSaved) {
        // UPDATE MODE
        const existingCount = this.fuCriteriaFromDb.length;
        const updatePromises: Promise<any>[] = [];
        const newNames: string[] = [];

        names.forEach((name, i) => {
          if (i < existingCount) {
            const dbRow = this.fuCriteriaFromDb[i];
            const criteriaId = safeNum(
              dbRow?.patientFollowUpCriteriaId ??
                dbRow?.criteriaId ??
                dbRow?.id,
            );
            updatePromises.push(
              firstValueFrom(
                this.fuApi.updateCriteria({
                  patientFollowUpCriteriaId: criteriaId,
                  patientId: this.patientId!,
                  criteriaName: name,
                }),
              ),
            );
          } else {
            newNames.push(name);
          }
        });

        if (updatePromises.length) await Promise.all(updatePromises);

        if (newNames.length) {
          await firstValueFrom(
            this.fuApi.createCriteria({
              patientId: this.patientId!,
              criteriaNames: newNames,
            }),
          );
        }

        await this.toast('Criteria updated');
      } else {
        // CREATE MODE
        await firstValueFrom(
          this.fuApi.createCriteria({
            patientId: this.patientId!,
            criteriaNames: names,
          }),
        );
        await this.toast('Criteria saved');
      }

      await this.loadFollowUpCriteria(false);
    } catch (e: any) {
      await this.presentSimpleAlert(
        'Save Failed',
        e?.error?.message || e?.message || 'Failed to save criteria',
      );
    } finally {
      this.fuLoading = false;
    }
  }

  // =====================
  // EDIT / CANCEL
  // =====================
  enableCriteriaEdit() {
    this.fuCriteriaEditMode = true;

    for (let i = 0; i < this.fuSymptomsArr.length; i++) {
      this.fuSymptomsArr.at(i).enable({ emitEvent: false });
    }

    const lastVal = (
      this.fuSymptomsArr.at(this.fuSymptomsArr.length - 1)?.value ?? ''
    )
      .toString()
      .trim();
    if (lastVal) this.addFuRows(this.FU_ADD_STEP);
  }

  cancelCriteriaEdit() {
    this.fuCriteriaEditMode = false;
    void this.loadFollowUpCriteria(false);
  }

  // =====================
  // NAVIGATION
  // =====================
  goPrevMedical() {
    this.router.navigate([], {
      queryParams: { tab: 'medical', patientId: this.patientId },
      queryParamsHandling: 'merge',
    });
  }

  goNextPayment() {
    this.router.navigate([], {
      queryParams: { tab: 'payment', patientId: this.patientId },
      queryParamsHandling: 'merge',
    });
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
    const a = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await a.present();
  }

  trackByIndex(index: number) {
    return index;
  }
}
