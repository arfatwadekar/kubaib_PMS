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
  currentAppointmentId: number | null = null;
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
    this.loadMedicines(); // 👈 MUST BE HERE
    //  this.loadMedicines();   // 👈 ADD THIS

   this.sub.add(
  this.route.queryParams.subscribe(async (qp) => {  // 👈 add async
    const id = safeNum(qp?.['patientId']);

    if (id > 0) {
      this.patientId = id;
      void this.loadFollowUpCriteria(false);
      this.loadMedicines();
      await this.loadCurrentAppointment(); // 👈 await karo
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
    if (this.fuSymptomsArr.length === 0) {
      this.addFuRows(this.FU_INIT_ROWS);
    }

    this.sub.add(
      this.fuSymptomsArr.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((values: string[]) => {
          if (this.fuCriteriaSaved || !this.fuCriteriaEditMode) return;

          const lastIndex = this.fuSymptomsArr.length - 1;
          const lastValue = (values[lastIndex] ?? '').toString().trim();

          if (lastValue && this.fuSymptomsArr.length < this.FU_MAX_ROWS) {
            this.addFuRows(this.FU_ADD_STEP);
          }
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
      this.fuCriteriaEditMode = true; // 👈 ADD THIS
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

  // ============================
  waiveEnabled = false;
  verifiedWaivePassword: string | null = null;

  async onWaiveSelected() {
    const confirm = this.followUpForm.value.applyWaiveOff === 'true';

    if (!confirm) {
      this.waiveEnabled = false;
      this.verifiedWaivePassword = null;
      this.followUpForm.get('waiveOffAmount')?.disable();
      return;
    }

    const password = await this.openPasswordModal();

    if (!password) {
      this.followUpForm.patchValue({ applyWaiveOff: 'false' });
      return;
    }

    try {
      const res = await firstValueFrom(
        this.fuApi.verifyAdminPassword({ password }),
      );

      console.log('VERIFY RESPONSE:', res);

      // 🔥 Important: Accept ANY truthy response
      if (res === true || res?.isValid === true || res?.message) {
        this.verifiedWaivePassword = password;
        this.waiveEnabled = true;
        this.followUpForm.get('waiveOffAmount')?.enable();
      } else {
        throw new Error('Invalid');
      }
    } catch (error) {
      await this.toast('Invalid password');
      this.followUpForm.patchValue({ applyWaiveOff: 'false' });
      this.waiveEnabled = false;
      this.verifiedWaivePassword = null;
      this.followUpForm.get('waiveOffAmount')?.disable();
    }
  }

  addMedicine() {
    this.medicines.push(
      this.fb.group({
        medicineId: [''],
        dosage: [''],
        frequency: [''],
        duration: [''],
        instructions: [''],
      }),
    );
  }

  removeMedicine(index: number) {
    this.medicines.removeAt(index);
  }

  get ratings(): FormArray {
    return this.followUpForm.get('ratings') as FormArray;
  }

  get medicines(): FormArray {
    return this.followUpForm.get('medicines') as FormArray;
  }

  followUpForm = this.fb.group({
    appointmentId: [null],

    interpretation: [''],
    temporaryProblems: [''],

    ratings: this.fb.array([]),

    medicines: this.fb.array([]),

    consultationCharges: [0],
    applyWaiveOff: ['false'],
    waiveOffAmount: [{ value: 0, disabled: true }],

    nextDate: [''],
    nextTime: [''],
  });

  async openPasswordModal(): Promise<string | null> {
    const alert = await this.alertCtrl.create({
      header: 'Admin Verification',
      message: 'Enter admin password to allow waive-off',
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'Enter password',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Verify',
          role: 'confirm',
        },
      ],
    });

    await alert.present();

    const { role, data } = await alert.onDidDismiss();

    if (role === 'confirm') {
      return data?.values?.password || null;
    }

    return null;
  }

  today: Date = new Date();

  medicineList: any[] = [];

  async loadMedicines() {
    try {
      const res: any = await firstValueFrom(
        this.fuApi.getAllMedicines(1, 100, ''),
      );

      console.log('RAW MEDICINE RESPONSE:', res);

      // 🔥 CORRECT EXTRACTION
      this.medicineList = res?.data?.items ?? [];

      console.log('FINAL MEDICINE LIST:', this.medicineList);
    } catch (error) {
      console.error('Medicine load failed:', error);
      this.medicineList = [];
    }
  }

async saveFollowUp() {
  console.log('SAVE CLICKED');

  if (!this.patientId) {
    await this.toast('Patient not found');
    return;
  }

  // await this.loadCurrentAppointment();

  if (!this.currentAppointmentId) {
    await this.toast('Appointment missing');
    return;
  }

  try {
    this.fuLoading = true;

    const formValue: any = this.followUpForm.getRawValue();
    const appointmentId = this.currentAppointmentId;

    // -------------------------
    // 1️⃣ Save Medicines
    // -------------------------
    const medicines = (formValue.medicines || []) as any[];

    for (const med of medicines) {
      if (!med.medicineId) continue;

      await firstValueFrom(
        this.fuApi.addPrescription({
          appointmentId: appointmentId,
          medicineId: med.medicineId,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          instructions: med.instructions,
        })
      );
    }

    console.log('Medicines saved');

    // -------------------------
    // 2️⃣ Save Payment
    // -------------------------
    const consultationCharges = safeNum(formValue.consultationCharges);
    const waiveOffAmount = safeNum(formValue.waiveOffAmount);

    await firstValueFrom(
      this.fuApi.createPayment({
        patientId: this.patientId,
        appointmentId: appointmentId,
        consultationCharges,
        waveOffAmount: waiveOffAmount,
        amountPaid: consultationCharges - waiveOffAmount,
        paymentMode: 'Cash',
        paymentDate: new Date().toISOString(),
        waveOffPassword:
          waiveOffAmount > 0
            ? this.verifiedWaivePassword ?? undefined
            : undefined,
      })
    );

    console.log('Payment saved');

    // -------------------------
    // 3️⃣ Update Appointment Status
    // -------------------------
    await firstValueFrom(
      this.fuApi.updateAppointmentStatus(appointmentId, {
        status: 3, // AwaitingPayment
      })
    );

    console.log('Appointment updated');

    // -------------------------
    // 4️⃣ Create Next Appointment (Optional)
    // -------------------------
    if (formValue.nextDate && formValue.nextTime) {
      await firstValueFrom(
        this.fuApi.createAppointment({
          patientId: this.patientId,
          appointmentDate: formValue.nextDate,
          appointmentTime: formValue.nextTime,
          remark: 'Follow-up scheduled',
        })
      );

      console.log('Next appointment created');
    }

    await this.toast('Follow Up Saved Successfully');

  } catch (error: any) {
    console.error('SAVE ERROR:', error);

    await this.presentSimpleAlert(
      'Save Failed',
      error?.error?.message || error?.message || 'Something went wrong'
    );

  } finally {
    this.fuLoading = false;
  }
}

async loadCurrentAppointment() {
  if (!this.patientId) return;

  console.log('LOAD CURRENT APPOINTMENT');

  const res: any = await firstValueFrom(
    this.fuApi.getAppointmentsByPatient(this.patientId)
  );

  console.log('APPOINTMENT RESPONSE:', res);

  // 🔥 Correct extraction (based on your real response)
  const list = res?.appointments ?? [];

  if (!Array.isArray(list) || list.length === 0) {
    console.log('No appointments found');
    return;
  }

  // Only InPatient
  const current = list.find((a: any) => a.status === 2);

  if (!current) {
    console.log('No InPatient appointment found');
    return;
  }

  this.currentAppointmentId = current.appointmentId;

  console.log('CURRENT APPOINTMENT ID:', this.currentAppointmentId);
}

}
