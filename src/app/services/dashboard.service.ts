import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DashboardService {

  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  /* ──────────────────────────────────────────────
     EXISTING APPOINTMENT APIs (UNCHANGED)
  ────────────────────────────────────────────── */

  getTodayAppointments(): Observable<any> {
    return this.http.get(`${this.base}/api/Appointment/today`);
  }

  getAllAppointments(): Observable<any> {
    return this.http.get(`${this.base}/api/Appointment`);
  }

  updateStatus(id: number, status: number): Observable<any> {
    // Swagger expects: { "status": 1 }
    return this.http.put(
      `${this.base}/api/Appointment/${id}/status`,
      { status }
    );
  }

  /* ──────────────────────────────────────────────
     NEW DASHBOARD APIs
  ────────────────────────────────────────────── */

  /** GET /api/Dashboard/stats */
  getDashboardStats(): Observable<any> {
    return this.http.get(
      `${this.base}/api/Dashboard/stats`
    );
  }

  /** GET /api/Dashboard/weekly-overview */
  getWeeklyOverview(weekOffset: number = 0): Observable<any> {
  const params = new HttpParams().set('weekOffset', weekOffset.toString());
  return this.http.get(
    `${this.base}/api/Dashboard/weekly-overview`,
    { params }
  );
}

  /**
   * GET /api/Dashboard/todays-appointments
   * Optional query param: status (Default = 'All')
   */
  getDashboardTodayAppointments(status: string = 'All'): Observable<any> {
    const params = new HttpParams().set('status', status);

    return this.http.get(
      `${this.base}/api/Dashboard/todays-appointments`,
      { params }
    );
  }
}