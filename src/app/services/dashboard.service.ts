import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getTodayAppointments(): Observable<any> {
    return this.http.get(`${this.base}/api/Appointment/today`);
  }

  getAllAppointments(): Observable<any> {
    return this.http.get(`${this.base}/api/Appointment`);
  }

  updateStatus(id: number, status: number): Observable<any> {
    // ✅ Swagger: { "status": 1 }
    return this.http.put(`${this.base}/api/Appointment/${id}/status`, { status });
  }
}
