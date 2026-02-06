import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ✅ Swagger ke hisab se
export type FollowUpCriteriaCreatePayload = {
  patientId: number;
  criteriaNames: string[];
};

// FollowUpCriteria GET item (approx)
export type FollowUpCriteriaDto = {
  patientFollowUpCriteriaId?: number; // mostly ye aayega
  criteriaId?: number;
  id?: number;
  patientId?: number;
  criteriaName?: string;
};

// FollowUp POST payload (tumhare followup page wala)
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

export type AppointmentCreatePayload = {
  patientId: number;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // "14:30:00"
  remark: string;
};

@Injectable({ providedIn: 'root' })
export class FollowUpService {
  // ✅ apne env ke hisab se set karo
  private readonly baseUrl = ''; // e.g. environment.apiUrl

  constructor(private http: HttpClient) {}

  // ---------------------------
  // FollowUpCriteria
  // ---------------------------
  getCriteriaByPatient(patientId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/FollowUpCriteria/patient/${patientId}`);
  }

  createCriteria(payload: FollowUpCriteriaCreatePayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/FollowUpCriteria`, payload);
  }

  updateCriteria(payload: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/FollowUpCriteria`, payload);
  }

  deleteCriteria(criteriaId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/FollowUpCriteria/${criteriaId}`);
  }

  // ---------------------------
  // FollowUp
  // ---------------------------
  getFollowUpsByPatient(patientId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/FollowUp/patient/${patientId}`);
  }

  getFollowUpByEntry(entryId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/FollowUp/${entryId}`);
  }

  createFollowUp(payload: FollowUpCreatePayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/FollowUp`, payload);
  }

  updateFollowUp(payload: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/FollowUp`, payload);
  }

  deleteFollowUp(entryId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/FollowUp/${entryId}`);
  }

  // ---------------------------
  // Appointment
  // ---------------------------
  createAppointment(payload: AppointmentCreatePayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/Appointment`, payload);
  }
}
