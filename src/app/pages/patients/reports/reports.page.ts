import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';

import {
  PatientReportService,
  PatientReportPayload,
} from 'src/app/services/patient-report.service';

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
// Types
// =====================
type UiRow = { label: string; apiKey: keyof PatientReportPayload };
type ReportDetail = PatientReportPayload & { patientReportId: number };


@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: false,
})
export class ReportsPage {
     // =====================
  // STATE
  // =====================
  patientId: number | null = null;
  reportLoading = false;

  repMode: 'entry' | 'compare' = 'entry';
  repReportDate: string = todayYmd();
  repSelectedPrevReportId: number | null = null;

  repRows: Array<{ label: string; apiKey: keyof PatientReportPayload; value: string }> = [];

  repSummaryList: Array<{
    patientReportId: number;
    reportName: string;
    reportDateYmd: string;
    uiDate: string;
  }> = [];

  repAllUiDates: string[] = [];
  repSelectedUiDates: string[] = [];
  repDisplayUiDates: string[] = [];
  repSelectedHeaderDate: string = '';

  repMatrix: Array<{
    label: string;
    apiKey: keyof PatientReportPayload;
    values: Record<string, string>;
  }> = [];

  private repDetailsMap: Record<number, ReportDetail> = {};
  private repUiDateToReportId: Record<string, number> = {};

  private sub = new Subscription();

  // =====================
  // ROW META (all test names)
  // =====================
  readonly rowsMeta: UiRow[] = [
    { label: 'Cholesterol Total',  apiKey: 'cholesterolTotal' },
    { label: 'HDL',                apiKey: 'hdl' },
    { label: 'LDL',                apiKey: 'ldl' },
    { label: 'Triglycerides',      apiKey: 'triglycerides' },
    { label: 'Lipoprotein (a)',    apiKey: 'lipoprotein_a' },
    { label: 'PPBS',               apiKey: 'ppbs' },
    { label: 'FBS',                apiKey: 'fbs' },
    { label: 'HbA1c',              apiKey: 'hbA1C' },
    { label: 'Creatinine',         apiKey: 'creatinine' },
    { label: 'BUN / Urea',         apiKey: 'buN_Urea' },
    { label: 'eGFR',               apiKey: 'eGFR' },
    { label: 'Hb',                 apiKey: 'hb' },
    { label: 'WBC',                apiKey: 'wbc' },
    { label: 'Platelet Count',     apiKey: 'plateletCount' },
    { label: 'Eosinophil Count',   apiKey: 'eosinophilCount' },
    { label: 'ESR',                apiKey: 'esr' },
    { label: 'Urine Routine',      apiKey: 'urineRoutine' },
    { label: 'Uric Acid',          apiKey: 'uricAcid' },
    { label: 'Vitamin D3',         apiKey: 'vitaminD3' },
    { label: 'Serum Iron',         apiKey: 'serumIron' },
    { label: 'TIBC',               apiKey: 'tibc' },
    { label: 'Iron Saturation',    apiKey: 'ironSaturation' },
    { label: 'CK-MB',              apiKey: 'cK_MB' },
    { label: 'CPK',                apiKey: 'cpk' },
    { label: 'Troponin',           apiKey: 'troponin' },
    { label: 'NT Pro BNP',         apiKey: 'ntProBNP' },
    { label: 'PT',                 apiKey: 'pt' },
    { label: 'INR',                apiKey: 'inr' },
    { label: 'TSH',                apiKey: 'tsh' },
    { label: 'T3',                 apiKey: 't3' },
    { label: 'T4',                 apiKey: 't4' },
    { label: 'Sodium (Na)',        apiKey: 'sodium' },
    { label: 'Potassium (K)',      apiKey: 'potassium' },
    { label: 'Chloride (Cl)',      apiKey: 'chloride' },
    { label: 'Serum Calcium',      apiKey: 'serumCalcium' },
    { label: 'R. A. Test',         apiKey: 'rA_Test' },
    { label: 'Bilirubin',          apiKey: 'bilirubin' },
    { label: 'SGOT',               apiKey: 'sgot' },
    { label: 'SGPT',               apiKey: 'sgpt' },
    { label: 'Total Protein',      apiKey: 'totalProtein' },
    { label: 'Albumin',            apiKey: 'albumin' },
    { label: 'Globulin',           apiKey: 'globulin' },
    { label: 'HIV',                apiKey: 'hiv' },
    { label: 'HCV',                apiKey: 'hcv' },
  ];

  constructor(
    private reportApi: PatientReportService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  // =====================
  // INIT / DESTROY
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

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // =====================
  // INIT ROWS
  // =====================
  private initReportEntryRows() {
    this.repRows = this.rowsMeta.map((m) => ({
      label:  m.label,
      apiKey: m.apiKey,
      value:  '',
    }));
  }

  private resetReportsAll() {
    this.repMode                 = 'entry';
    this.repReportDate           = todayYmd();
    this.repSelectedPrevReportId = null;
    this.repSummaryList          = [];
    this.repAllUiDates           = [];
    this.repSelectedUiDates      = [];
    this.repDisplayUiDates       = [];
    this.repSelectedHeaderDate   = '';
    this.repMatrix               = [];
    this.repUiDateToReportId     = {};
    this.repDetailsMap           = {};
    this.initReportEntryRows();
  }

  // =====================
  // MODE SWITCH
  // =====================
  setReportMode(mode: 'entry' | 'compare') {
    this.repMode = mode;
    this.refreshMatrixCssCols();
  }

  // =====================
  // START NEW REPORT
  // =====================
  startNewReport() {
    this.repSelectedPrevReportId = null;
    this.repReportDate           = todayYmd();
    this.repSelectedHeaderDate   = '';
    this.initReportEntryRows();
  }

  onReportDateChange() {
    // date change — UI only
  }

  // =====================
  // LOAD PREVIOUS REPORT
  // =====================
  async onLoadPrevChange() {
    const rid = safeNum(this.repSelectedPrevReportId);
    if (!rid) {
      this.startNewReport();
      return;
    }

    const detail = await this.ensureReportDetail(rid);
    if (!detail) {
      await this.toast('Failed to load previous report');
      return;
    }

    const uiDate = this.findUiDateByReportId(rid);
    this.applyDetailToEntry(detail, uiDate || '');
  }

  // =====================
  // LOAD ALL REPORTS FOR PATIENT
  // =====================
  async loadReportsForPatient() {
    if (!this.patientId) return;
    this.reportLoading = true;

    try {
      const res: any = await firstValueFrom(
        this.reportApi.getByPatient(this.patientId)
      );
      const list = this.extractArray(res);

      const summaries = list.map((x: any) => {
        const reportId = safeNum(x?.patientReportId ?? x?.reportId ?? x?.id);
        const ymd      = toKeyYmd(safeStr(x?.reportDate));
        const uiDate   = toUiDate(ymd);
        return {
          patientReportId: reportId,
          reportName:      safeStr(x?.reportName),
          reportDateYmd:   ymd,
          uiDate,
        };
      });

      this.repSummaryList = summaries.sort(
        (a, b) => b.patientReportId - a.patientReportId
      );

      this.repUiDateToReportId = {};
      for (const s of summaries) {
        if (s.uiDate) this.repUiDateToReportId[s.uiDate] = s.patientReportId;
      }

      this.repAllUiDates = Array.from(
        new Set(summaries.map((s) => s.uiDate).filter(Boolean))
      );

      // keep compare selection valid
      this.repSelectedUiDates = this.repSelectedUiDates.filter((d) =>
        this.repAllUiDates.includes(d)
      );
      this.repDisplayUiDates = this.repSelectedUiDates.slice(0, 5);

      for (const d of this.repDisplayUiDates) {
        const id = this.repUiDateToReportId[d];
        if (id) await this.ensureReportDetail(id);
      }

      this.buildMatrixFromCache();
      this.refreshMatrixCssCols();
    } catch (e: any) {
      await this.toast(e?.error?.message || e?.message || 'Failed to load reports');
    } finally {
      this.reportLoading = false;
    }
  }

  // =====================
  // COMPARE DATE TOGGLE
  // =====================
  async toggleCompareDate(d: string, ev: any) {
    const checked = !!ev?.detail?.checked;

    if (checked) {
      if (this.repSelectedUiDates.includes(d)) return;
      if (this.repSelectedUiDates.length >= 5) {
        await this.toast('Max 5 reports compare allowed');
        return;
      }
      this.repSelectedUiDates = [...this.repSelectedUiDates, d];
    } else {
      this.repSelectedUiDates = this.repSelectedUiDates.filter((x) => x !== d);
    }

    this.repDisplayUiDates = this.repSelectedUiDates.slice(0, 5);

    for (const uiDate of this.repDisplayUiDates) {
      const id = this.repUiDateToReportId[uiDate];
      if (id) await this.ensureReportDetail(id);
    }

    this.buildMatrixFromCache();
    this.refreshMatrixCssCols();

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
  // DATE HEADER CLICK → auto-fill entry
  // =====================
  async onDateHeaderClick(uiDate: string) {
    if (!uiDate) return;

    const rid = this.repUiDateToReportId[uiDate];
    if (!rid) return;

    const detail = await this.ensureReportDetail(rid);
    if (!detail) {
      await this.toast('Report detail not found');
      return;
    }

    this.repSelectedHeaderDate = uiDate;
    this.applyDetailToEntry(detail, uiDate);
  }

  // =====================
  // SAVE REPORT
  // =====================
  saveReport() {
    void this.saveReportInternal();
  }

  private async saveReportInternal() {
    if (!this.patientId) {
      await this.toast('PatientId missing');
      return;
    }
    if (this.reportLoading) return;

    const payload = this.emptyReportPayload();
    payload.patientId  = this.patientId;
    payload.reportDate = new Date(`${this.repReportDate}T00:00:00.000Z`).toISOString();

    for (const r of this.repRows) {
      (payload as any)[r.apiKey] = safeStr(r.value);
    }

    this.reportLoading = true;

    this.reportApi.create(payload).subscribe({
      next: async () => {
        this.reportLoading = false;
        await this.toast('Report saved');
        await this.loadReportsForPatient();
        this.startNewReport();
      },
      error: async (err) => {
        this.reportLoading = false;
        await this.presentSimpleAlert(
          'Save Failed',
          err?.error?.message || err?.message || 'Failed to save report'
        );
      },
    });
  }

  // =====================
  // APPLY DETAIL TO ENTRY ROWS
  // =====================
  private applyDetailToEntry(detail: ReportDetail, uiDate: string) {
    this.repReportDate = toKeyYmd(safeStr((detail as any).reportDate)) || todayYmd();

    for (const r of this.repRows) {
      r.value = safeStr((detail as any)[r.apiKey]);
    }

    if (uiDate) this.repSelectedHeaderDate = uiDate;
  }

  // =====================
  // BUILD MATRIX FROM CACHE
  // =====================
  private buildMatrixFromCache() {
    const dates = [...this.repDisplayUiDates];

    this.repMatrix = this.rowsMeta.map((m) => {
      const values: Record<string, string> = {};
      for (const uiDate of dates) {
        const id     = this.repUiDateToReportId[uiDate];
        const detail = id ? this.repDetailsMap[id] : null;
        values[uiDate] = detail ? safeStr((detail as any)[m.apiKey]) : '';
      }
      return { label: m.label, apiKey: m.apiKey, values };
    });
  }

  private refreshMatrixCssCols() {
    const cols = Math.max(1, this.repDisplayUiDates?.length || 0);
    document.documentElement.style.setProperty('--rep-cols', String(cols));
  }

  // =====================
  // ENSURE REPORT DETAIL (cache)
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
    return this.repSummaryList.find((x) => x.patientReportId === reportId)?.uiDate || '';
  }

  // =====================
  // EMPTY PAYLOAD
  // =====================
  private emptyReportPayload(): PatientReportPayload {
    return {
      patientId: this.patientId || 0,
      reportName: '', reportDate: new Date().toISOString(),
      labName: '', referredBy: '', summary: '',
      cholesterolTotal: '', hdl: '', ldl: '', triglycerides: '', lipoprotein_a: '',
      ppbs: '', fbs: '', hbA1C: '',
      creatinine: '', buN_Urea: '', eGFR: '',
      hb: '', wbc: '', plateletCount: '', eosinophilCount: '', esr: '',
      urineRoutine: '', uricAcid: '', vitaminD3: '',
      serumIron: '', tibc: '', ironSaturation: '',
      cK_MB: '', cpk: '', troponin: '', ntProBNP: '',
      pt: '', inr: '',
      tsh: '', t3: '', t4: '',
      sodium: '', potassium: '', chloride: '', serumCalcium: '',
      rA_Test: '', bilirubin: '', sgot: '', sgpt: '',
      totalProtein: '', albumin: '', globulin: '',
      hiv: '', hcv: '',
    };
  }

  // =====================
  // UTIL
  // =====================
  private extractArray(res: any): any[] {
    const list = res?.data ?? res?.list ?? res?.result ?? res?.items ?? res ?? [];
    return Array.isArray(list) ? list : [];
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2000, position: 'top' });
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