import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // POST /api/Appointment
  createAppointment(payload: any): Observable<any> {
    return this.http.post(`${this.base}/api/Appointment`, payload);
  }

  // ✅ GET /api/Appointment/today   (Dashboard should use this)
  getTodayAppointments(): Observable<any> {
    return this.http.get(`${this.base}/api/Appointment/today`);
  }

  // GET /api/Appointment (general listing if you ever need)
  getAppointments(params?: { page?: number; pageSize?: number; q?: string; status?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (params?.status) httpParams = httpParams.set('status', params.status);

    return this.http.get(`${this.base}/api/Appointment`, { params: httpParams });
  }

  // GET /api/Appointment/{id}
  getAppointmentById(id: number): Observable<any> {
    return this.http.get(`${this.base}/api/Appointment/${id}`);
  }

  // PUT /api/Appointment/{id}
  updateAppointment(id: number, payload: any): Observable<any> {
    return this.http.put(`${this.base}/api/Appointment/${id}`, payload);
  }

  // DELETE /api/Appointment/{id}
  deleteAppointment(id: number): Observable<any> {
    return this.http.delete(`${this.base}/api/Appointment/${id}`);
  }

  // GET /api/Appointment/patient/{patientId}
  getAppointmentsByPatient(patientId: number): Observable<any> {
    return this.http.get(`${this.base}/api/Appointment/patient/${patientId}`);
  }

  // GET /api/Appointment/status/{status}
  getAppointmentsByStatus(status: string): Observable<any> {
    return this.http.get(`${this.base}/api/Appointment/status/${encodeURIComponent(status)}`);
  }

  // PUT /api/Appointment/{id}/status
  updateAppointmentStatus(id: number, payload: any): Observable<any> {
    return this.http.put(`${this.base}/api/Appointment/${id}/status`, payload);
  }

  // GET /api/Appointment/queue
  getQueue(): Observable<any> {
    return this.http.get(`${this.base}/api/Appointment/queue`);
  }

  // PUT /api/Appointment/{id}/restore
  restoreAppointment(id: number): Observable<any> {
    return this.http.put(`${this.base}/api/Appointment/${id}/restore`, {});
  }

  
  // ✅ active appointment finder
  getActiveAppointmentByPatient(patientId: number) {
    return this.getAppointmentsByPatient(patientId).pipe(
      map((list) => {
        const arr = Array.isArray(list) ? list : [];

        // active = not OutPatient(4) and not Cancelled(5)
        const active = arr.find((a) => {
          const s = Number(a?.status);
          return s !== 4 && s !== 5;
        });

        return active || arr[0] || null;
      })
    );
  }
}
