import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';

import {
  PatientReportPayload,
  PatientReportService,
} from 'src/app/services/patient-report.service';
import { NotificationService } from 'src/app/services/notification.service';

type UiRow = { label: string; apiKey: keyof PatientReportPayload };

@Component({
  selector: 'page-report',
  templateUrl: 'report.html',
  styleUrls: ['report.scss'],
  standalone: false,
})
export class ReportPage implements OnInit, OnDestroy {
  loading = false;
  patientId: number | null = null;

  private destroy$ = new Subject<void>();

  // ✅ One row = one input (symptoms style UI)
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

  // ✅ Main form
  form: FormGroup = this.fb.group({
    reportName: [''],
    reportDate: [''], // <ion-input type="date"> => YYYY-MM-DD
    labName: [''],
    referredBy: [''],
    summary: [''],
    items: this.fb.array([]), // label/apiKey/value
  });

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private api: PatientReportService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
      private notificationService: NotificationService,
         private router:    Router,
  ) {}

  ngOnInit(): void {
    // ✅ patientId from query param OR route param
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qp) => {
      const qid = Number(qp?.['patientId'] ?? 0);
      const pid = Number(this.route.snapshot.paramMap.get('patientId') ?? 0);

      const id = qid > 0 ? qid : pid;
      this.patientId = id > 0 ? id : null;

      // debug (remove later)
      console.log('[ReportPage] patientId:', this.patientId);
    });

    // ✅ Build rows once
    this.buildRows();

    // ✅ Clear fields when date changes
    this.form.get('reportDate')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((newDate) => {
      if (newDate && this.patientId) {
        this.loadReportForDate(newDate);
      } else {
        this.clearReportFields();
      }
    });

     this.loadNotifications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // -----------------------------
  // Load Report for Date
  // -----------------------------
  private loadReportForDate(date: string) {
    if (!this.patientId) return;

    this.loading = true;
    this.api.getByPatient(this.patientId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        const reports = res?.data || res || [];
        const report = reports.find((r: any) => r.reportDate?.startsWith(date));

        if (report) {
          this.populateFormFromReport(report);
        } else {
          this.clearReportFields();
        }
        this.loading = false;
      },
      error: () => {
        this.clearReportFields();
        this.loading = false;
      }
    });
  }

  private populateFormFromReport(report: any) {
    this.form.patchValue({
      reportName: report.reportName || '',
      labName: report.labName || '',
      referredBy: report.referredBy || '',
      summary: report.summary || '',
    });

    // Populate items from report data
    this.rowsMeta.forEach((meta, index) => {
      const value = report[meta.apiKey] || '';
      this.items.at(index).get('value')?.setValue(value);
    });
  }

  // -----------------------------
  // Clear Fields on Date Change
  // -----------------------------
  private clearReportFields() {
    // Clear all item values
    this.items.controls.forEach(control => {
      control.get('value')?.setValue('');
    });

    // Clear other fields except date
    this.form.patchValue({
      reportName: '',
      labName: '',
      referredBy: '',
      summary: '',
    });
  }

  // -----------------------------
  // FormArray Helpers
  // -----------------------------
  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  private buildRows() {
    this.items.clear();
    this.rowsMeta.forEach((r) => {
      this.items.push(
        this.fb.group({
          label: [r.label],
          apiKey: [r.apiKey],
          value: [''],
        })
      );
    });
  }

  // -----------------------------
  // Payload Builder
  // -----------------------------
  private emptyPayload(): PatientReportPayload {
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

  private buildPayload(): PatientReportPayload {
    const raw = this.form.getRawValue();
    const payload = this.emptyPayload();

    payload.reportName = raw.reportName || '';
    payload.labName = raw.labName || '';
    payload.referredBy = raw.referredBy || '';
    payload.summary = raw.summary || '';

    // date input -> ISO
    payload.reportDate = raw.reportDate
      ? new Date(raw.reportDate).toISOString()
      : new Date().toISOString();

    // rows -> api keys
    (raw.items || []).forEach((r: any) => {
      const key = r?.apiKey as keyof PatientReportPayload;
      const val = String(r?.value ?? '');
      if (key) {
        (payload as any)[key] = val;
      }
    });

    return payload;
  }

  // -----------------------------
  // Save
  // -----------------------------
  async save() {
    if (!this.patientId) {
      await this.toast('patientId missing. Open page with ?patientId=123');
      return;
    }
    if (this.loading) return;

    const payload = this.buildPayload();

    this.loading = true;
    this.api.create(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: async (res) => {
        this.loading = false;
        await this.toast(res?.message || 'Report created successfully.');
        this.form.markAsPristine();
      },
      error: async (err) => {
        this.loading = false;

        const msg =
          err?.error?.message ||
          err?.error?.detail ||
          err?.message ||
          'Failed to create report.';

        const a = await this.alertCtrl.create({
          header: 'Save Failed',
          message: msg,
          buttons: ['OK'],
        });
        await a.present();
      },
    });
  }

  // -----------------------------
  // Reset
  // -----------------------------
  reset() {
    this.form.reset({
      reportName: '',
      reportDate: '',
      labName: '',
      referredBy: '',
      summary: '',
    });
    this.buildRows();
  }

  // -----------------------------
  // ✅ AUTOFILL (Testing - DOES NOT SAVE)
  // -----------------------------
  async autofill() {
    // fill meta
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    this.form.patchValue({
      reportName: 'Blood Report',
      reportDate: `${yyyy}-${mm}-${dd}`, // input date format
      labName: 'City Lab',
      referredBy: 'Dr. ABC',
      summary: 'Auto-filled test values for demo.',
    });

    // fill some test values (match apiKey)
    const demo: Partial<Record<keyof PatientReportPayload, string>> = {
      cholesterolTotal: '180',
      hdl: '45',
      ldl: '110',
      triglycerides: '140',
      fbs: '92',
      hbA1C: '5.6',
      creatinine: '0.9',
      hb: '13.5',
      wbc: '6200',
      plateletCount: '250000',
      vitaminD3: '18',
      tsh: '2.1',
      sodium: '139',
      potassium: '4.3',
      hiv: 'Negative',
      hcv: 'Negative',
    };

    // patch items by apiKey
    this.items.controls.forEach((ctrl: any) => {
      const key = ctrl.get('apiKey')?.value as keyof PatientReportPayload;
      const val = demo[key];
      if (val !== undefined) {
        ctrl.patchValue({ value: val }, { emitEvent: false });
      }
    });

    this.form.markAsDirty();
    await this.toast('Autofill applied (not saved).');
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


  
  unreadCount = 0;
notifications: any[] = [];
async loadNotifications() {
  const res: any = await this.notificationService.getNotifications().toPromise();

  this.notifications = res || [];

  this.unreadCount = this.notifications.filter(n => !n.isRead).length;
}

openNotifications() {
  this.router.navigate(['/notifications']);
}
}
