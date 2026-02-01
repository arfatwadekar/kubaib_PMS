import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export enum AppointmentStatus {
  Pending = 1,
  InPatient = 2,
  AwaitingPayment = 3,
  OutPatient = 4,
  Cancelled = 5,
}

export interface ApiPatient {
  patientId: number;
  patientIdFormatted: string;
  fullName: string;
  phoneNumber: string;
  gender: string;
}

export interface ApiTimeSpan {
  ticks: number;
}

export interface ApiAppointment {
  appointmentId: number;
  patient: ApiPatient;

  appointmentDate: string;
  appointmentTime: ApiTimeSpan;
  appointmentTimeFormatted: string;

  status: number;
  statusText: string;
  remark: string;
}

export interface AppointmentPagedResponse {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  appointments: ApiAppointment[];
}

@Injectable({ providedIn: 'root' })
export class SearchAppointmentService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getQueue(): Observable<AppointmentPagedResponse> {
    return this.http.get<AppointmentPagedResponse>(`${this.base}/api/Appointment/queue`);
  }

  getToday(): Observable<AppointmentPagedResponse> {
    return this.http.get<AppointmentPagedResponse>(`${this.base}/api/Appointment/today`);
  }

  updateStatus(id: number, status: AppointmentStatus): Observable<ApiAppointment> {
    return this.http.put<ApiAppointment>(
      `${this.base}/api/Appointment/${id}/status`,
      { status }
    );
  }

  updateAppointment(
    id: number,
    body: {
      appointmentDate: string;
      appointmentTime:  string ;
      remark: string;
    }
  ): Observable<ApiAppointment> {
    return this.http.put<ApiAppointment>(
      `${this.base}/api/Appointment/${id}`,
      body
    );
  }
}
