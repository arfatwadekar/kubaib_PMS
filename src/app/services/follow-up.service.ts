import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type FollowUpCriteriaCreatePayload = {
  patientId: number;
  criteriaNames: string[];
};

export type FollowUpCriteriaDto = {
  patientFollowUpCriteriaId: number;
  patientId: number;
  criteriaName: string;
};

export type FollowUpCreatePayload = {
  patientFollowUpEntryId: number;
  patientId: number;
  followUpDate: string; // ISO
  interpretation: string;
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
  appointmentDate: string; // "YYYY-MM-DD"
  appointmentTime: { ticks: number }; // swagger demands this
  remark: string;
};

@Injectable({ providedIn: 'root' })
export class FollowUpService {
  private baseUrl = 'http://localhost:8080';

  constructor(private http: HttpClient) {}

  // ---------- FollowUp Criteria ----------
  createCriteria(payload: FollowUpCriteriaCreatePayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/FollowUpCriteria`, payload);
  }

  getCriteriaByPatient(patientId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/FollowUpCriteria/patient/${patientId}`);
  }

  // ---------- FollowUp ----------
  createFollowUp(payload: FollowUpCreatePayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/FollowUp`, payload);
  }

  // ---------- Appointment ----------
  createAppointment(payload: AppointmentCreatePayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/Appointment`, payload);
  }
}
