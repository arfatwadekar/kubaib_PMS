import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

// =======================
// ✅ Appointment Status Enum
// =======================
export enum AppointmentStatus {
  Pending        = 1,
  InPatient      = 2,
  AwaitingPayment = 3,
  OutPatient     = 4,
  Cancelled      = 5,
}

// =======================
// ✅ FollowUpCriteria Types
// =======================
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

// =======================
// ✅ FollowUp Entry Types
// =======================
export type FollowUpCreatePayload = {
  patientFollowUpEntryId: number;
  patientId:              number;
  followUpDate:           string;
  interpretation:         string;
  temporaryProblems?:     string;
  charge:                 number;
  statusRecords: Array<{
    patientFollowUpStatusId:   number;
    patientFollowUpCriteriaId: number;
    criteriaName:              string;
    remarks:                   string;
  }>;
};

// =======================
// ✅ Appointment Types
// =======================
export type AppointmentCreatePayload = {
  patientId:       number;
  appointmentDate: string;
  appointmentTime: string;
  remark:          string;
};

export type AppointmentStatusUpdatePayload = {
  status: AppointmentStatus | number;
};

// =======================
// ✅ Payment Types
// =======================
export type PaymentCreatePayload = {
  patientId:           number;
  appointmentId:       number;
  consultationCharges: number;
  waveOffAmount:       number;
  amountPaid:          number;
  paymentMode:         string;
  paymentDate:         string;
  waveOffPassword?:    string;   // required by backend when waive-off > 0
};

// =======================
// ✅ Medicine Types
// =======================
export type PrescriptionPayload = {
  appointmentId: number;
  medicineId:    number;
  dosage:        string;
  frequency:     string;
  duration:      string;
  instructions:  string;
};

// =======================
// ✅ Waive-Off Verify Types
// =======================
export type WaveOffVerifyPayload = {
  password: string;
};

@Injectable({ providedIn: "root" })
export class FollowUpService {
  private base = environment.apiBaseUrl;

  // ─── All endpoints taken directly from Swagger ────────────────────────────
  private EP = {
    // FollowUpCriteria
    CRITERIA_BY_PATIENT: (pid: number)  => `api/FollowUpCriteria/patient/${pid}`,
    CRITERIA_CREATE:                        `api/FollowUpCriteria`,
    CRITERIA_UPDATE:                        `api/FollowUpCriteria`,
    CRITERIA_DELETE: (id: number)       => `api/FollowUpCriteria/${id}`,

    // FollowUp
    FOLLOWUP_BY_PATIENT: (pid: number)  => `api/FollowUp/patient/${pid}`,
    FOLLOWUP_BY_ENTRY:   (id: number)   => `api/FollowUp/${id}`,
    FOLLOWUP_CREATE:                        `api/FollowUp`,
    FOLLOWUP_UPDATE:                        `api/FollowUp`,
    FOLLOWUP_DELETE:     (id: number)   => `api/FollowUp/${id}`,

    // Appointment  ← all verified in swagger
    APPT_CREATE:                            `api/Appointment`,
    APPT_BY_PATIENT:     (pid: number)  => `api/Appointment/patient/${pid}`,
    APPT_STATUS_UPDATE:  (id: number)   => `api/Appointment/${id}/status`,

    // Medicine  ← verified in swagger
    MEDICINES:                              `api/Medicine`,
    PRESCRIPTIONS_BY_APPT: (id: number) => `api/Medicine/appointment/${id}/prescriptions`,
    PRESCRIPTION_ADD:                       `api/Medicine/prescription`,
    PRESCRIPTION_DELETE: (id: number)   => `api/Medicine/prescription/${id}`,

    // Payment  ← GET /api/Payment/{id} and GET /api/Payment/patient/{patientId}
    //            NOTE: No GET /api/Payment/appointment/{id} in swagger!
    //            We use GET /api/Payment/patient/{patientId} and filter by appointmentId client-side.
    PAYMENT_CREATE:                         `api/Payment`,
    PAYMENT_BY_ID:       (id: number)   => `api/Payment/${id}`,
    PAYMENT_BY_PATIENT:  (pid: number)  => `api/Payment/patient/${pid}`,

    // Auth
    VERIFY_ADMIN_PASSWORD:                  `api/Auth/verify-admin-password`,
  };

  constructor(private http: HttpClient) {}

  private url(path: string): string {
    return `${this.base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  }

  // =========================
  // 🔹 FollowUp Criteria
  // =========================

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

  // =========================
  // 🔹 FollowUp Entry
  // =========================

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

  // =========================
  // 🔹 Appointment
  // =========================

  getAppointmentsByPatient(patientId: number): Observable<any> {
    return this.http.get(this.url(this.EP.APPT_BY_PATIENT(patientId)));
  }

  createAppointment(payload: AppointmentCreatePayload): Observable<any> {
    return this.http.post(this.url(this.EP.APPT_CREATE), payload);
  }

  updateAppointmentStatus(id: number, payload: AppointmentStatusUpdatePayload): Observable<any> {
    return this.http.put(this.url(this.EP.APPT_STATUS_UPDATE(id)), payload);
  }

  // =========================
  // 🔹 Medicine
  // =========================

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

  // =========================
  // 🔹 Payment
  //
  // ⚠️  Swagger has NO  GET /api/Payment/appointment/{id}
  //     Real endpoints:
  //       GET /api/Payment/{id}
  //       GET /api/Payment/patient/{patientId}   ← returns array, filter by appointmentId
  // =========================

  createPayment(payload: PaymentCreatePayload): Observable<any> {
    return this.http.post(this.url(this.EP.PAYMENT_CREATE), payload);
  }

  getPaymentById(paymentId: number): Observable<any> {
    return this.http.get(this.url(this.EP.PAYMENT_BY_ID(paymentId)));
  }

  /**
   * Returns all payment records for a patient.
   * Filter by appointmentId client-side to get the one for the current visit.
   * Swagger: GET /api/Payment/patient/{patientId}
   */
  getPaymentsByPatient(patientId: number): Observable<any> {
    return this.http.get(this.url(this.EP.PAYMENT_BY_PATIENT(patientId)));
  }

  // =========================
  // 🔹 Auth
  // =========================

  verifyAdminPassword(payload: WaveOffVerifyPayload): Observable<any> {
    return this.http.post(this.url(this.EP.VERIFY_ADMIN_PASSWORD), payload);
  }
}