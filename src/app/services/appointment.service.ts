import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  createAppointment(payload: any) {
    return this.http.post(`${this.base}/api/Appointment`, payload);
  }

  // ✅ List/Appointments (today or all)
  getAppointments(params?: { date?: string; page?: number; pageSize?: number; q?: string }) {
    let httpParams = new HttpParams();

    if (params?.date) httpParams = httpParams.set('date', params.date);
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
    if (params?.q) httpParams = httpParams.set('q', params.q);

    return this.http.get(`${this.base}/api/Appointment`, { params: httpParams });
  }
}
