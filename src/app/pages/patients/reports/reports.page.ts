import { Component, OnDestroy, OnInit, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';
import { CanComponentDeactivate } from 'src/app/guards/can-deactivate.guard';

import {
  PatientReportService,
  PatientReportPayload,
} from 'src/app/services/patient-report.service';

// =====================
// HELPER FUNCTIONS
// =====================
function safeStr(v: any): string {
  return (v ?? '').toString().trim();
}

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function todayYmd(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function toUiDate(isoOrDate: string): string {
  const s = (isoOrDate || '').toString().trim();
  if (!s) return '';
  const iso = s.includes('T') ? s : `${s}T00:00:00.000Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function toKeyYmd(isoOrDate: string): string {
  const s = (isoOrDate || '').toString().trim();
  if (!s) return '';
  if (s.includes('T')) return s.slice(0, 10);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

// =====================
// TYPE DEFINITIONS
// =====================
type ReportMode = 'entry' | 'compare';
type UiRow = { label: string; apiKey: keyof PatientReportPayload };
type ReportDetail = PatientReportPayload & { patientReportId: number };
type ReportRow = { label: string; apiKey: keyof PatientReportPayload; value: string };
type ReportSummary = {
  patientReportId: number;
  reportName: string;
  reportDateYmd: string;
  uiDate: string;
};
type MatrixRow = {
  label: string;
  apiKey: keyof PatientReportPayload;
  values: Record<string, string>;
};

// =====================
// COMPONENT
// =====================
@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: false,
})
export class ReportsPage implements OnInit, OnDestroy, CanComponentDeactivate {
  // =====================
  // STATE - CORE
  // =====================
  patientId: number | null = null;
  reportLoading = false;

  // =====================
  // STATE - MODE & DATES
  // =====================
  repMode: ReportMode = 'entry';
  repReportDate: string = todayYmd();
  repSelectedPrevReportId: number | null = null;

  // =====================
  // STATE - ENTRY ROWS
  // =====================
  repRows: ReportRow[] = [];

  // =====================
  // STATE - ADDITIONAL FIELDS
  // =====================
  repReportName: string = '';
  repLabName: string = '';
  repReferredBy: string = '';
  repSummary: string = '';

  // =====================
  // STATE - REPORT SUMMARIES
  // =====================
  repSummaryList: ReportSummary[] = [];

  // =====================
  // STATE - COMPARISON DATES
  // =====================
  repAllUiDates: string[] = [];
  repSelectedUiDates: string[] = [];
  repDisplayUiDates: string[] = [];
  repSelectedHeaderDate: string = '';

  // =====================
  // STATE - MATRIX
  // =====================
  repMatrix: MatrixRow[] = [];

  // =====================
  // PRIVATE STATE - CACHES
  // =====================
  private repDetailsMap: Record<number, ReportDetail> = {};
  private repUiDateToReportId: Record<string, number> = {};
  private sub = new Subscription();
  private isFormDirty = false;

  // ── Browser tab close / refresh warning ──────────────────────────────
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.isFormDirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // ── Guard check ──────────────────────────────────────────────────────
  canDeactivate(): boolean {
    return !this.isFormDirty;
  }

  // ── Called from HTML when user types in any field ────────────────────
  markDirty() {
    this.isFormDirty = true;
  }

  // =====================
  // LAB TEST METADATA
  // =====================
  readonly rowsMeta: UiRow[] = [
    // Lipid Panel
    { label: 'Cholesterol Total', apiKey: 'cholesterolTotal' },
    { label: 'HDL', apiKey: 'hdl' },
    { label: 'LDL', apiKey: 'ldl' },
    { label: 'Triglycerides', apiKey: 'triglycerides' },
    { label: 'Lipoprotein (a)', apiKey: 'lipoprotein_a' },

    // Glucose
    { label: 'PPBS (Post-Prandial)', apiKey: 'ppbs' },
    { label: 'FBS (Fasting)', apiKey: 'fbs' },
    { label: 'HbA1c', apiKey: 'hbA1C' },

    // Kidney Function
    { label: 'Creatinine', apiKey: 'creatinine' },
    { label: 'BUN / Urea', apiKey: 'buN_Urea' },
    { label: 'eGFR', apiKey: 'eGFR' },

    // Blood Count
    { label: 'Hemoglobin (Hb)', apiKey: 'hb' },
    { label: 'WBC', apiKey: 'wbc' },
    { label: 'Platelet Count', apiKey: 'plateletCount' },
    { label: 'Eosinophil Count', apiKey: 'eosinophilCount' },
    { label: 'ESR', apiKey: 'esr' },

    // Metabolic
    { label: 'Urine Routine', apiKey: 'urineRoutine' },
    { label: 'Uric Acid', apiKey: 'uricAcid' },
    { label: 'Vitamin D3', apiKey: 'vitaminD3' },

    // Iron
    { label: 'Serum Iron', apiKey: 'serumIron' },
    { label: 'TIBC', apiKey: 'tibc' },
    { label: 'Iron Saturation', apiKey: 'ironSaturation' },

    // Cardiac
    { label: 'CK-MB', apiKey: 'cK_MB' },
    { label: 'CPK', apiKey: 'cpk' },
    { label: 'Troponin', apiKey: 'troponin' },
    { label: 'NT Pro BNP', apiKey: 'ntProBNP' },

    // Coagulation
    { label: 'PT', apiKey: 'pt' },
    { label: 'INR', apiKey: 'inr' },

    // Thyroid
    { label: 'TSH', apiKey: 'tsh' },
    { label: 'T3', apiKey: 't3' },
    { label: 'T4', apiKey: 't4' },

    // Electrolytes
    { label: 'Sodium (Na)', apiKey: 'sodium' },
    { label: 'Potassium (K)', apiKey: 'potassium' },
    { label: 'Chloride (Cl)', apiKey: 'chloride' },
    { label: 'Serum Calcium', apiKey: 'serumCalcium' },

    // Liver
    { label: 'R.A Test', apiKey: 'rA_Test' },
    { label: 'Bilirubin', apiKey: 'bilirubin' },
    { label: 'SGOT', apiKey: 'sgot' },
    { label: 'SGPT', apiKey: 'sgpt' },
    { label: 'Total Protein', apiKey: 'totalProtein' },
    { label: 'Albumin', apiKey: 'albumin' },
    { label: 'Globulin', apiKey: 'globulin' },

    // Serology
    { label: 'HIV', apiKey: 'hiv' },
    { label: 'HCV', apiKey: 'hcv' },
  ];

  // =====================
  // CONSTRUCTOR
  // =====================
  constructor(
    private reportApi: PatientReportService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private route: ActivatedRoute,
  ) {}

  // =====================
  // LIFECYCLE - INIT
  // =====================
  ngOnInit(): void {
    this.initReportEntryRows();

    this.sub.add(
      this.route.queryParams.subscribe((qp) => {
        const id = safeNum(qp?.['patientId']);

        if (id > 0) {
          this.patientId = id;
          this.startNewReport();
          void this.loadReportsForPatient();
        } else {
          this.patientId = null;
          this.resetReportsAll();
        }
      })
    );
  }

  // =====================
  // LIFECYCLE - DESTROY
  // =====================
  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // =====================
  // INITIALIZATION
  // =====================
  private initReportEntryRows(): void {
    this.repRows = this.rowsMeta.map((m) => ({
      label: m.label,
      apiKey: m.apiKey,
      value: '',
    }));
  }

  private resetReportsAll(): void {
    this.repMode = 'entry';
    this.repReportDate = todayYmd();
    this.repSelectedPrevReportId = null;
    this.repReportName = '';
    this.repLabName = '';
    this.repReferredBy = '';
    this.repSummary = '';
    this.repSummaryList = [];
    this.repAllUiDates = [];
    this.repSelectedUiDates = [];
    this.repDisplayUiDates = [];
    this.repSelectedHeaderDate = '';
    this.repMatrix = [];
    this.repUiDateToReportId = {};
    this.repDetailsMap = {};
    this.initReportEntryRows();
  }

  // =====================
  // MODE MANAGEMENT
  // =====================
  setReportMode(mode: ReportMode): void {
    this.repMode = mode;
    this.refreshMatrixCssCols();
  }

  // =====================
  // REPORT ENTRY
  // =====================
  startNewReport(): void {
    this.isFormDirty = false;   
    this.repSelectedPrevReportId = null;
    this.repReportDate = todayYmd();
    this.repReportName = '';
    this.repLabName = '';
    this.repReferredBy = '';
    this.repSummary = '';
    this.repSelectedHeaderDate = '';
    this.initReportEntryRows();
  }

  onReportDateChange(): void {
    // Date changed - UI event only
  }

  // =====================
  // LOAD PREVIOUS REPORT
  // =====================
  async onLoadPrevChange(): Promise<void> {
    const rid = safeNum(this.repSelectedPrevReportId);
    if (!rid) {
      this.startNewReport();
      return;
    }

    const detail = await this.ensureReportDetail(rid);
    if (!detail) {
      await this.showToast('Failed to load previous report');
      return;
    }

    const uiDate = this.findUiDateByReportId(rid);
    this.applyDetailToEntry(detail, uiDate || '');
  }

  // =====================
  // LOAD REPORTS
  // =====================
  async loadReportsForPatient(): Promise<void> {
    if (!this.patientId) return;
    this.reportLoading = true;

    try {
      const res: any = await firstValueFrom(
        this.reportApi.getByPatient(this.patientId)
      );
      const list = this.extractArray(res);

      const summaries = list.map((x: any) => {
        const reportId = safeNum(x?.patientReportId ?? x?.reportId ?? x?.id);
        const ymd = toKeyYmd(safeStr(x?.reportDate));
        const uiDate = toUiDate(ymd);
        return {
          patientReportId: reportId,
          reportName: safeStr(x?.reportName),
          reportDateYmd: ymd,
          uiDate,
        };
      });

      this.repSummaryList = summaries.sort(
        (a, b) => b.patientReportId - a.patientReportId
      );

      // Build date-to-ID map
      this.repUiDateToReportId = {};
      for (const s of summaries) {
        if (s.uiDate) this.repUiDateToReportId[s.uiDate] = s.patientReportId;
      }

      // Collect all unique dates
      this.repAllUiDates = Array.from(
        new Set(summaries.map((s) => s.uiDate).filter(Boolean))
      );

      // Keep comparison selection valid
      this.repSelectedUiDates = this.repSelectedUiDates.filter((d) =>
        this.repAllUiDates.includes(d)
      );
      this.repDisplayUiDates = this.repSelectedUiDates.slice(0, 5);

      // Preload report details
      for (const d of this.repDisplayUiDates) {
        const id = this.repUiDateToReportId[d];
        if (id) await this.ensureReportDetail(id);
      }

      this.buildMatrixFromCache();
      this.refreshMatrixCssCols();
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Failed to load reports';
      await this.showToast(msg);
    } finally {
      this.reportLoading = false;
    }
  }

  // =====================
  // COMPARE MODE
  // =====================
  async toggleCompareDate(d: string, ev: any): Promise<void> {
    const checked = !!ev?.detail?.checked;

    if (checked) {
      if (this.repSelectedUiDates.includes(d)) return;
      if (this.repSelectedUiDates.length >= 5) {
        await this.showToast('Max 5 reports can be compared');
        return;
      }
      this.repSelectedUiDates = [...this.repSelectedUiDates, d];
    } else {
      this.repSelectedUiDates = this.repSelectedUiDates.filter((x) => x !== d);
    }

    this.repDisplayUiDates = this.repSelectedUiDates.slice(0, 5);

    // Load details for displayed reports
    for (const uiDate of this.repDisplayUiDates) {
      const id = this.repUiDateToReportId[uiDate];
      if (id) await this.ensureReportDetail(id);
    }

    this.buildMatrixFromCache();
    this.refreshMatrixCssCols();

    // Auto-select single report
    if (this.repDisplayUiDates.length === 1) {
      await this.onDateHeaderClick(this.repDisplayUiDates[0]);
    } else {
      if (
        this.repSelectedHeaderDate &&
        !this.repDisplayUiDates.includes(this.repSelectedHeaderDate)
      ) {
        this.repSelectedHeaderDate = '';
      }
    }
  }

  // =====================
  // DATE HEADER CLICK
  // =====================
  async onDateHeaderClick(uiDate: string): Promise<void> {
    if (!uiDate) return;

    const rid = this.repUiDateToReportId[uiDate];
    if (!rid) return;

    const detail = await this.ensureReportDetail(rid);
    if (!detail) {
      await this.showToast('Report detail not found');
      return;
    }

    this.repSelectedHeaderDate = uiDate;
    this.applyDetailToEntry(detail, uiDate);
  }

  // =====================
  // SAVE REPORT
  // =====================
  saveReport(): void {
    void this.saveReportInternal();
  }

  private async saveReportInternal(): Promise<void> {
    if (!this.patientId) {
      await this.showToast('Patient ID missing');
      return;
    }
    if (this.reportLoading) return;

    const payload = this.createEmptyPayload();
    payload.patientId = this.patientId;
    payload.reportDate = new Date(`${this.repReportDate}T00:00:00.000Z`).toISOString();
    
    // Add metadata fields
    payload.reportName = safeStr(this.repReportName);
    payload.labName = safeStr(this.repLabName);
    payload.referredBy = safeStr(this.repReferredBy);
    payload.summary = safeStr(this.repSummary);

    // Populate with current row values (all as strings)
    for (const r of this.repRows) {
      (payload as any)[r.apiKey] = safeStr(r.value);
    }

    this.reportLoading = true;

    this.reportApi.create(payload).subscribe({
      next: async () => {
        this.reportLoading = false;
        await this.showToast('✓ Report saved successfully');
        await this.loadReportsForPatient();
        this.startNewReport();
      },
      error: async (err) => {
        this.reportLoading = false;
        const msg = err?.error?.message || err?.message || 'Failed to save report';
        await this.showAlert('Save Failed', msg);
      },
    });
  }

  // =====================
  // APPLY DETAIL TO ENTRY
  // =====================
  private applyDetailToEntry(detail: ReportDetail, uiDate: string): void {
    this.repReportDate =
      toKeyYmd(safeStr((detail as any).reportDate)) || todayYmd();
    
    // Apply metadata fields
    this.repReportName = safeStr((detail as any).reportName);
    this.repLabName = safeStr((detail as any).labName);
    this.repReferredBy = safeStr((detail as any).referredBy);
    this.repSummary = safeStr((detail as any).summary);

    // Apply test results
    for (const r of this.repRows) {
      r.value = safeStr((detail as any)[r.apiKey]);
    }

    if (uiDate) this.repSelectedHeaderDate = uiDate;
  }

  // =====================
  // BUILD MATRIX
  // =====================
  private buildMatrixFromCache(): void {
    const dates = [...this.repDisplayUiDates];

    this.repMatrix = this.rowsMeta.map((m) => {
      const values: Record<string, string> = {};
      for (const uiDate of dates) {
        const id = this.repUiDateToReportId[uiDate];
        const detail = id ? this.repDetailsMap[id] : null;
        values[uiDate] = detail ? safeStr((detail as any)[m.apiKey]) : '';
      }
      return { label: m.label, apiKey: m.apiKey, values };
    });
  }

  private refreshMatrixCssCols(): void {
    const cols = Math.max(1, this.repDisplayUiDates?.length || 0);
    document.documentElement.style.setProperty('--rep-cols', String(cols));
  }

  // =====================
  // CACHE MANAGEMENT
  // =====================
  private async ensureReportDetail(reportId: number): Promise<ReportDetail | null> {
    if (!reportId || reportId <= 0) return null;
    if (this.repDetailsMap[reportId]) return this.repDetailsMap[reportId];

    try {
      const res: any = await firstValueFrom(this.reportApi.getById(reportId));
      const data = res?.data ?? res ?? null;
      if (!data) return null;

      const detail: ReportDetail = {
        ...(data as any),
        patientReportId: safeNum(
          data?.patientReportId ?? data?.reportId ?? data?.id ?? reportId
        ),
      };

      this.repDetailsMap[reportId] = detail;
      return detail;
    } catch {
      return null;
    }
  }

  private findUiDateByReportId(reportId: number): string {
    return (
      this.repSummaryList.find((x) => x.patientReportId === reportId)?.uiDate ||
      ''
    );
  }

  // =====================
  // PAYLOAD CREATION
  // =====================
  private createEmptyPayload(): PatientReportPayload {
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

  // =====================
  // UTILITIES
  // =====================
  private extractArray(res: any): any[] {
    const list =
      res?.data ?? res?.list ?? res?.result ?? res?.items ?? res ?? [];
    return Array.isArray(list) ? list : [];
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
      color: 'dark',
    });
    await toast.present();
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  trackByIndex(index: number): number {
    return index;
  }

  
}