import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

// =======================
// ✅ Appointment Status Enum (backend aligned)
// =======================
export enum AppointmentStatus {
  Pending = 1,
  InPatient = 2,
  AwaitingPayment = 3,
  OutPatient = 4,
  Cancelled = 5,
}

// =======================
// ✅ FollowUpCriteria Types
// =======================
export type FollowUpCriteriaCreatePayload = {
  patientId: number;
  criteriaNames: string[];
};

export type FollowUpCriteriaDto = {
  patientFollowUpCriteriaId?: number;
  criteriaId?: number;
  id?: number;
  patientId?: number;
  criteriaName?: string;
};

// =======================
// ✅ FollowUp Entry Types (if still used elsewhere)
// =======================
export type FollowUpCreatePayload = {
  patientFollowUpEntryId: number;
  patientId: number;
  followUpDate: string; // ISO
  interpretation: string;
  temporaryProblems?: string;
  charge: number;

  statusRecords: Array<{
    patientFollowUpStatusId: number;
    patientFollowUpCriteriaId: number;
    criteriaName: string;
    remarks: string;
  }>;
};

// =======================
// ✅ Appointment Types
// =======================
export type AppointmentCreatePayload = {
  patientId: number;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm:ss
  remark: string;
};

export type AppointmentStatusUpdatePayload = {
  status: AppointmentStatus | number;
};

// =======================
// ✅ Payment Types
// =======================
export type PaymentCreatePayload = {
  patientId: number;
  appointmentId: number;
  consultationCharges: number;
  waveOffAmount: number;
  amountPaid: number;
  paymentMode: string;
  paymentDate: string; // ISO
  waveOffPassword?: string; // ✅ undefined ok
};

// =======================
// ✅ Waive-Off Verify Types
// =======================
export type WaveOffVerifyPayload = {
  password: string;
};

// =======================
// Helpers
// =======================
function safeStr(v: any): string {
  return (v ?? "").toString().trim();
}
function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function cleanCriteriaNames(arr: any[]): string[] {
  return (arr || [])
    .map((x) => safeStr(x))
    .filter(Boolean)
    .slice(0, 60);
}
function toDateOnly(d: any): string {
  const s = safeStr(d);
  if (!s) return "";
  if (s.includes("T")) return s.slice(0, 10);
  return s;
}
function normalizeTime(t: any): string {
  const s = safeStr(t);
  if (!s) return "00:00:00";
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return "00:00:00";
}

@Injectable({ providedIn: "root" })
export class FollowUpService {
  private base = environment.apiBaseUrl;

  // ✅ centralize endpoints here (easy to change)
  private ENDPOINTS = {
    CRITERIA_BY_PATIENT: (pid: number) => `api/FollowUpCriteria/patient/${pid}`,
    CRITERIA: `api/FollowUpCriteria`,

    FOLLOWUP_BY_PATIENT: (pid: number) => `api/FollowUp/patient/${pid}`,
    FOLLOWUP_ENTRY: (id: number) => `api/FollowUp/${id}`,
    FOLLOWUP: `api/FollowUp`,

    APPT_CREATE: `api/Appointment`,
    APPT_STATUS_UPDATE: (apptId: number) => `api/Appointment/${apptId}/status`,

    // ✅ you may need to adjust these 2
    CURRENT_APPTS_BY_PATIENT: (pid: number) => `api/Appointment/patient/${pid}`,
    VERIFY_WAVEOFF_PASSWORD: `api/Payment/verify-waveoff-password`,

    PAYMENT_CREATE: `api/Payment`,
  };

  constructor(private http: HttpClient) {}

  private url(path: string): string {
    const b = (this.base || "").replace(/\/+$/, "");
    const p = (path || "").replace(/^\/+/, "");
    return `${b}/${p}`;
  }

  // ---------------------------
  // FollowUpCriteria
  // ---------------------------
  getCriteriaByPatient(patientId: number): Observable<any> {
    return this.http.get(this.url(this.ENDPOINTS.CRITERIA_BY_PATIENT(safeNum(patientId))));
  }

  createCriteria(payload: FollowUpCriteriaCreatePayload): Observable<any> {
    const body: FollowUpCriteriaCreatePayload = {
      patientId: safeNum(payload?.patientId),
      criteriaNames: cleanCriteriaNames(payload?.criteriaNames || []),
    };
    return this.http.post(this.url(this.ENDPOINTS.CRITERIA), body);
  }

  updateCriteria(payload: any): Observable<any> {
    return this.http.put(this.url(this.ENDPOINTS.CRITERIA), payload);
  }

  deleteCriteria(criteriaId: number): Observable<any> {
    return this.http.delete(this.url(`${this.ENDPOINTS.CRITERIA}/${safeNum(criteriaId)}`));
  }

  // ---------------------------
  // FollowUp Entries (optional use)
  // ---------------------------
  getFollowUpsByPatient(patientId: number): Observable<any> {
    return this.http.get(this.url(this.ENDPOINTS.FOLLOWUP_BY_PATIENT(safeNum(patientId))));
  }

  getFollowUpByEntry(entryId: number): Observable<any> {
    return this.http.get(this.url(this.ENDPOINTS.FOLLOWUP_ENTRY(safeNum(entryId))));
  }

  createFollowUp(payload: FollowUpCreatePayload): Observable<any> {
    return this.http.post(this.url(this.ENDPOINTS.FOLLOWUP), payload);
  }

  updateFollowUp(payload: any): Observable<any> {
    return this.http.put(this.url(this.ENDPOINTS.FOLLOWUP), payload);
  }

  deleteFollowUp(entryId: number): Observable<any> {
    return this.http.delete(this.url(this.ENDPOINTS.FOLLOWUP_ENTRY(safeNum(entryId))));
  }

  // ---------------------------
  // ✅ Appointment
  // ---------------------------
  createAppointment(payload: AppointmentCreatePayload): Observable<any> {
    const body: AppointmentCreatePayload = {
      patientId: safeNum(payload?.patientId),
      appointmentDate: toDateOnly(payload?.appointmentDate),
      appointmentTime: normalizeTime(payload?.appointmentTime),
      remark: safeStr(payload?.remark),
    };
    return this.http.post(this.url(this.ENDPOINTS.APPT_CREATE), body);
  }

  updateAppointmentStatus(appointmentId: number, payload: AppointmentStatusUpdatePayload): Observable<any> {
    const body: AppointmentStatusUpdatePayload = {
      status: safeNum(payload?.status),
    };
    return this.http.put(this.url(this.ENDPOINTS.APPT_STATUS_UPDATE(safeNum(appointmentId))), body);
  }

  // ✅ fetch current appointments (to get current appointmentId)
  getCurrentAppointments(patientId: number): Observable<any> {
    return this.http.get(this.url(this.ENDPOINTS.CURRENT_APPTS_BY_PATIENT(safeNum(patientId))));
  }

  // ---------------------------
  // ✅ Waive-Off Verify
  // ---------------------------
  verifyWaveOffPassword(payload: WaveOffVerifyPayload): Observable<any> {
    const body: WaveOffVerifyPayload = {
      password: safeStr(payload?.password),
    };
    return this.http.post(this.url(this.ENDPOINTS.VERIFY_WAVEOFF_PASSWORD), body);
  }

  // ---------------------------
  // ✅ Payment
  // ---------------------------
  createPayment(payload: PaymentCreatePayload): Observable<any> {
    const pw = safeStr(payload?.waveOffPassword);

    const body: PaymentCreatePayload = {
      patientId: safeNum(payload?.patientId),
      appointmentId: safeNum(payload?.appointmentId),
      consultationCharges: safeNum(payload?.consultationCharges),
      waveOffAmount: safeNum(payload?.waveOffAmount),
      amountPaid: safeNum(payload?.amountPaid),
      paymentMode: safeStr(payload?.paymentMode) || "Cash",
      paymentDate: safeStr(payload?.paymentDate) || new Date().toISOString(),
      // ✅ send only if present (undefined else)
      ...(pw ? { waveOffPassword: pw } : {}),
    };

    return this.http.post(this.url(this.ENDPOINTS.PAYMENT_CREATE), body);
  }
}
