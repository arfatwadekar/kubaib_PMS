import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormArray, FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import {
  FollowUpService,
  FollowUpCriteriaDto
} from 'src/app/services/follow-up.service';

const FU_INIT_ROWS = 10;
const FU_MAX_ROWS = 30;

@Component({
  selector: 'app-followup',
  templateUrl: './followup.page.html',
  styleUrls: ['./followup.page.scss'],
  standalone:false,
})
export class FollowupPage implements OnInit, OnDestroy {

  // ─────────────────────────────
  // STATE
  // ─────────────────────────────
  today: Date = new Date();
  patientId!: number;

  isFirstVisit = true;
  isSaved = false;
  isEditMode = false;
  loading = false;

  private destroy$ = new Subject<void>();
  private criteriaFromDb: FollowUpCriteriaDto[] = [];

  // ─────────────────────────────
  // FORM
  // ─────────────────────────────
  fuCriteriaForm = this.fb.group({
    symptoms: this.fb.array<FormControl<string>>([])
  });

  get fuSymptomsArr(): FormArray<FormControl<string>> {
    return this.fuCriteriaForm.get('symptoms') as FormArray<FormControl<string>>;
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private fuApi: FollowUpService
  ) {}

  // ─────────────────────────────
  // INIT
  // ─────────────────────────────
  async ngOnInit(): Promise<void> {

    this.patientId = Number(
      this.route.snapshot.queryParamMap.get('patientId')
    );

    this.initializeRows();
    this.listenRowExpansion();
    await this.loadCriteria();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────────────────────────
  // INITIALIZE 10 ROWS
  // ─────────────────────────────
  private initializeRows(): void {
    this.fuSymptomsArr.clear();

    for (let i = 0; i < FU_INIT_ROWS; i++) {
      this.fuSymptomsArr.push(
        this.fb.control('', { nonNullable: true })
      );
    }
  }

  // ─────────────────────────────
  // AUTO +2 ROW EXPANSION
  // ─────────────────────────────
  private listenRowExpansion(): void {

    this.fuSymptomsArr.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(values => {

        // In view mode ignore
        if (this.isSaved && !this.isEditMode) return;

        const lastIndex = this.fuSymptomsArr.length - 1;
        const lastValue = (values[lastIndex] || '').trim();

        if (lastValue && this.fuSymptomsArr.length < FU_MAX_ROWS) {
          this.addRows(2);
        }
      });
  }

  private addRows(count: number): void {
    for (let i = 0; i < count; i++) {

      if (this.fuSymptomsArr.length >= FU_MAX_ROWS) break;

      this.fuSymptomsArr.push(
        this.fb.control('', { nonNullable: true })
      );
    }
  }

  // ─────────────────────────────
  // LOAD CRITERIA
  // ─────────────────────────────
  async loadCriteria(): Promise<void> {

    if (!this.patientId) return;

    try {

      const res: any = await firstValueFrom(
        this.fuApi.getCriteriaByPatient(this.patientId)
      );

      const list: FollowUpCriteriaDto[] =
        res?.data ?? res?.list ?? res ?? [];

      // Reset form
      this.fuSymptomsArr.clear();
      this.criteriaFromDb = [];

      // ───────── FIRST VISIT ─────────
      if (!list || list.length === 0) {

        this.isFirstVisit = true;
        this.isSaved = false;
        this.isEditMode = false;

        this.initializeRows();
        return;
      }

      // ───────── FOLLOW-UP VISIT ─────────
      this.isFirstVisit = false;
      this.isSaved = true;
      this.isEditMode = false;
      this.criteriaFromDb = list;

      list.forEach(item => {
        this.fuSymptomsArr.push(
          this.fb.control({
            value: item.criteriaName || '',
            disabled: true
          }, { nonNullable: true })
        );
      });

      // Ensure minimum 10 rows
      if (this.fuSymptomsArr.length < FU_INIT_ROWS) {
        const remaining = FU_INIT_ROWS - this.fuSymptomsArr.length;

        for (let i = 0; i < remaining; i++) {
          this.fuSymptomsArr.push(
            this.fb.control({
              value: '',
              disabled: true
            }, { nonNullable: true })
          );
        }
      }

    } catch (error) {
      console.error('Load failed:', error);
    }
  }

  // ─────────────────────────────
  // ENABLE EDIT
  // ─────────────────────────────
  enableEdit(): void {

    this.isEditMode = true;

    this.fuSymptomsArr.controls.forEach(ctrl => {
      ctrl.enable({ emitEvent: false });
    });
  }

  // ─────────────────────────────
  // SAVE (POST + PUT LOGIC)
  // ─────────────────────────────
  async saveCriteria(): Promise<void> {

    if (!this.patientId) return;

    const values = this.fuSymptomsArr.value
      .map(v => (v || '').trim())
      .filter(v => v.length > 0);

    if (!values.length) return;

    this.loading = true;

    try {

      // ───────── FIRST TIME SAVE ─────────
      if (!this.isSaved) {

        await firstValueFrom(
          this.fuApi.createCriteria({
            patientId: this.patientId,
            criteriaNames: values
          })
        );
      }
      // ───────── UPDATE MODE ─────────
      else {

        const updates: Promise<any>[] = [];
        const newNames: string[] = [];

        values.forEach((name: string, i: number) => {

          if (i < this.criteriaFromDb.length) {

            const existing = this.criteriaFromDb[i];
            const oldName = (existing.criteriaName || '').trim();

            if (name !== oldName) {
              updates.push(
                firstValueFrom(
                  this.fuApi.updateCriteria({
                    patientFollowUpCriteriaId:
                      existing.patientFollowUpCriteriaId || existing.id!,
                    patientId: this.patientId,
                    criteriaName: name
                  })
                )
              );
            }
          }
          else {
            newNames.push(name);
          }
        });

        if (updates.length) {
          await Promise.all(updates);
        }

        if (newNames.length) {
          await firstValueFrom(
            this.fuApi.createCriteria({
              patientId: this.patientId,
              criteriaNames: newNames
            })
          );
        }
      }

      // Reload fresh state
      this.isSaved = true;
      this.isEditMode = false;
      await this.loadCriteria();

    } catch (error) {
      console.error('Save failed:', error);
    }

    this.loading = false;
  }

  trackByIndex(index: number): number {
    return index;
  }
}