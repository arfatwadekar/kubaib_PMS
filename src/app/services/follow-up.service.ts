import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

// ══════════════════════════════════════════
// Enums
// ══════════════════════════════════════════
export enum AppointmentStatus {
  Pending         = 1,
  InPatient       = 2,
  AwaitingPayment = 3,
  OutPatient      = 4,
  Cancelled       = 5,
}

// ══════════════════════════════════════════
// FollowUp Criteria Types
// ══════════════════════════════════════════
export type FollowUpCriteriaCreatePayload = {
  patientId:     number;
  criteriaNames: string[];
};

export type FollowUpCriteriaUpdatePayload = {
  patientFollowUpCriteriaId: number;
  patientId:                 number;
  criteriaName:              string;
};

export type FollowUpCriteriaDto = {
  patientFollowUpCriteriaId?: number;
  criteriaId?:                number;
  id?:                        number;
  patientId?:                 number;
  criteriaName?:              string;
};

// ══════════════════════════════════════════
// FollowUp Entry Types
// ══════════════════════════════════════════
export type FollowUpStatusRecord = {
  patientFollowUpStatusId:   number;
  patientFollowUpCriteriaId: number;
  criteriaName:              string;
  remarks:                   string;
};

export type FollowUpCreatePayload = {
  patientFollowUpEntryId: number;
  patientId:              number;
  appointmentId:          number;
  followUpDate:           string;
  interpretation:         string;
  temporaryProblems?:     string;
  charge:                 number;
  statusRecords:          FollowUpStatusRecord[];
};

// ══════════════════════════════════════════
// Appointment Types
// ══════════════════════════════════════════
export type AppointmentCreatePayload = {
  patientId:       number;
  appointmentDate: string;
  appointmentTime: string;
  remark:          string;
};

export type AppointmentStatusUpdatePayload = {
  status: AppointmentStatus | number;
};

// ══════════════════════════════════════════
// Payment Types
// ══════════════════════════════════════════
export type PaymentCreatePayload = {
  patientId:           number;
  appointmentId:       number;
  consultationCharges: number;
  waveOffAmount:       number;
  amountPaid:          number;
  paymentMode:         string;
  paymentDate:         string;
  discountCode?:       string;   // PRD: discount code (not admin password)
};

// ══════════════════════════════════════════
// Medicine / Prescription Types
// ══════════════════════════════════════════
export type PrescriptionPayload = {
  appointmentId: number;
  medicineId:    number;
  dosage:        string;
  frequency:     string;
  duration:      string;
  type:          string;   // PRD: tablet / syrup / etc.
  instructions:  string;
};

// ══════════════════════════════════════════
// Discount Code Verify Type
// ══════════════════════════════════════════
export type DiscountCodeVerifyPayload = {
  discountCode: string;
};

// ══════════════════════════════════════════
// Service
// ══════════════════════════════════════════
@Injectable({ providedIn: "root" })
export class FollowUpService {

  private base = environment.apiBaseUrl;

  private EP = {
    // FollowUpCriteria
    CRITERIA_BY_PATIENT: (pid: number) => `api/FollowUpCriteria/patient/${pid}`,
    CRITERIA_CREATE:                      `api/FollowUpCriteria`,
    CRITERIA_UPDATE:                      `api/FollowUpCriteria`,
    CRITERIA_DELETE:     (id: number)  => `api/FollowUpCriteria/${id}`,

    // FollowUp Entry
    FOLLOWUP_BY_PATIENT: (pid: number) => `api/FollowUp/patient/${pid}`,
    FOLLOWUP_BY_ENTRY:   (id: number)  => `api/FollowUp/${id}`,
    FOLLOWUP_CREATE:                      `api/FollowUp`,
    FOLLOWUP_UPDATE:                      `api/FollowUp`,
    FOLLOWUP_DELETE:     (id: number)  => `api/FollowUp/${id}`,

    // Appointment
    APPT_CREATE:                          `api/Appointment`,
    APPT_BY_PATIENT:     (pid: number) => `api/Appointment/patient/${pid}`,
    APPT_BY_ID:          (id: number)  => `api/Appointment/${id}`,
    APPT_STATUS_UPDATE:  (id: number)  => `api/Appointment/${id}/status`,
    APPT_SUMMARY:        (id: number)  => `api/Appointment/${id}/summary`,

    // Medicine
    MEDICINES:                            `api/Medicine`,
    PRESCRIPTIONS_BY_APPT: (id: number)=> `api/Medicine/appointment/${id}/prescriptions`,
    PRESCRIPTION_ADD:                     `api/Medicine/prescription`,
    PRESCRIPTION_DELETE: (id: number)  => `api/Medicine/prescription/${id}`,

    // Payment
    PAYMENT_CREATE:                       `api/Payment`,
    PAYMENT_BY_ID:       (id: number)  => `api/Payment/${id}`,
    PAYMENT_BY_PATIENT:  (pid: number) => `api/Payment/patient/${pid}`,

    // Discount code verify (replaces admin password for wave-off)
VERIFY_ADMIN_PASSWORD: `api/Auth/verify-admin-password`,
  };

  constructor(private http: HttpClient) {}

  private url(path: string): string {
    return `${this.base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  }

  // ── FollowUp Criteria ─────────────────────────────────────────────────────

  getCriteriaByPatient(patientId: number): Observable<any> {
    return this.http.get(this.url(this.EP.CRITERIA_BY_PATIENT(patientId)));
  }

  createCriteria(payload: FollowUpCriteriaCreatePayload): Observable<any> {
    return this.http.post(this.url(this.EP.CRITERIA_CREATE), payload);
  }

  updateCriteria(payload: FollowUpCriteriaUpdatePayload): Observable<any> {
    return this.http.put(this.url(this.EP.CRITERIA_UPDATE), payload);
  }

  deleteCriteria(criteriaId: number): Observable<any> {
    return this.http.delete(this.url(this.EP.CRITERIA_DELETE(criteriaId)));
  }

  // ── FollowUp Entry ────────────────────────────────────────────────────────

  getFollowUpsByPatient(patientId: number): Observable<any> {
    return this.http.get(this.url(this.EP.FOLLOWUP_BY_PATIENT(patientId)));
  }

  getFollowUpByEntry(entryId: number): Observable<any> {
    return this.http.get(this.url(this.EP.FOLLOWUP_BY_ENTRY(entryId)));
  }

  createFollowUp(payload: FollowUpCreatePayload): Observable<any> {
    return this.http.post(this.url(this.EP.FOLLOWUP_CREATE), payload);
  }

  updateFollowUp(payload: FollowUpCreatePayload): Observable<any> {
    return this.http.put(this.url(this.EP.FOLLOWUP_UPDATE), payload);
  }

  deleteFollowUp(entryId: number): Observable<any> {
    return this.http.delete(this.url(this.EP.FOLLOWUP_DELETE(entryId)));
  }

  // ── Appointment ───────────────────────────────────────────────────────────

  getAppointmentsByPatient(patientId: number): Observable<any> {
    return this.http.get(this.url(this.EP.APPT_BY_PATIENT(patientId)));
  }

  getAppointmentById(appointmentId: number): Observable<any> {
    return this.http.get(this.url(this.EP.APPT_BY_ID(appointmentId)));
  }

  getAppointmentSummary(appointmentId: number): Observable<any> {
    return this.http.get(this.url(this.EP.APPT_SUMMARY(appointmentId)));
  }

  createAppointment(payload: AppointmentCreatePayload): Observable<any> {
    return this.http.post(this.url(this.EP.APPT_CREATE), payload);
  }

  updateAppointmentStatus(id: number, payload: AppointmentStatusUpdatePayload): Observable<any> {
    return this.http.put(this.url(this.EP.APPT_STATUS_UPDATE(id)), payload);
  }

  // ── Medicine ──────────────────────────────────────────────────────────────

  getAllMedicines(page = 1, pageSize = 100, search = ""): Observable<any> {
    return this.http.get(
      this.url(`${this.EP.MEDICINES}?page=${page}&pageSize=${pageSize}&search=${search}`)
    );
  }

  getPrescriptionsByAppointment(appointmentId: number): Observable<any> {
    return this.http.get(this.url(this.EP.PRESCRIPTIONS_BY_APPT(appointmentId)));
  }

  addPrescription(payload: PrescriptionPayload): Observable<any> {
    return this.http.post(this.url(this.EP.PRESCRIPTION_ADD), payload);
  }

  deletePrescription(prescriptionId: number): Observable<any> {
    return this.http.delete(this.url(this.EP.PRESCRIPTION_DELETE(prescriptionId)));
  }

  // ── Payment ───────────────────────────────────────────────────────────────

  createPayment(payload: PaymentCreatePayload): Observable<any> {
    return this.http.post(this.url(this.EP.PAYMENT_CREATE), payload);
  }

  getPaymentById(paymentId: number): Observable<any> {
    return this.http.get(this.url(this.EP.PAYMENT_BY_ID(paymentId)));
  }

  getPaymentsByPatient(patientId: number): Observable<any> {
    return this.http.get(this.url(this.EP.PAYMENT_BY_PATIENT(patientId)));
  }

  // ── Discount Code Verify (PRD: wave-off uses discount code, not admin pwd) ─

verifyAdminPassword(payload: { password: string }): Observable<any> {
  return this.http.post(
    this.url(this.EP.VERIFY_ADMIN_PASSWORD),
    payload
  );
}
}