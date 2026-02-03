import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

export interface PatientReportPayload {
  patientId: number;
  reportName: string;
  reportDate: string;
  labName: string;
  referredBy: string;
  summary: string;

  cholesterolTotal: string;
  hdl: string;
  ldl: string;
  triglycerides: string;
  lipoprotein_a: string;

  ppbs: string;
  fbs: string;
  hbA1C: string;

  creatinine: string;
  buN_Urea: string;
  eGFR: string;

  hb: string;
  wbc: string;
  plateletCount: string;
  eosinophilCount: string;
  esr: string;

  urineRoutine: string;
  uricAcid: string;
  vitaminD3: string;

  serumIron: string;
  tibc: string;
  ironSaturation: string;

  cK_MB: string;
  cpk: string;
  troponin: string;
  ntProBNP: string;

  pt: string;
  inr: string;

  tsh: string;
  t3: string;
  t4: string;

  sodium: string;
  potassium: string;
  chloride: string;
  serumCalcium: string;

  rA_Test: string;
  bilirubin: string;
  sgot: string;
  sgpt: string;
  totalProtein: string;
  albumin: string;
  globulin: string;

  hiv: string;
  hcv: string;
}

// response types (adjust if your backend returns differently)
export type PatientReportListItem = {
  reportId: number;
  patientId: number;
  reportName: string;
  reportDate: string;
  labName?: string;
  referredBy?: string;
  summary?: string;
};

@Injectable({ providedIn: 'root' })
export class PatientReportService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  create(payload: PatientReportPayload) {
    return this.http.post<any>(`${this.base}/api/PatientReport`, payload);
  }

  // ✅ LIST by patient
  getByPatient(patientId: number) {
    return this.http.get<any>(`${this.base}/api/PatientReport/patient/${patientId}`);
  }

  // ✅ GET by reportId
  getById(reportId: number) {
    return this.http.get<any>(`${this.base}/api/PatientReport/${reportId}`);
  }

  // ✅ UPDATE (PUT)
  update(payload: any) {
    return this.http.put<any>(`${this.base}/api/PatientReport`, payload);
  }

  // optional delete
  delete(reportId: number) {
    return this.http.delete<any>(`${this.base}/api/PatientReport/${reportId}`);
  }
}
