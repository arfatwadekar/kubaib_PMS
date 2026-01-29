import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // POST /api/Patients
  createPatient(payload: any): Observable<any> {
    return this.http.post(`${this.base}/api/Patients`, payload);
  }

  // GET /api/Patients?page=1&pageSize=10
  getPatients(page = 1, pageSize = 10): Observable<any> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));

    return this.http.get(`${this.base}/api/Patients`, { params });
  }

  // POST /api/Patients/search?query=anas (body empty {})
  searchPatients(query: string): Observable<any> {
    const q = (query || '').trim();
    const params = new HttpParams().set('query', q);
    return this.http.post(`${this.base}/api/Patients/search`, {}, { params });
  }

  // ✅ GET /api/Patients/{id}  (Dashboard -> form prefill)
  getPatientById(id: number): Observable<any> {
    return this.http.get(`${this.base}/api/Patients/${id}`);
  }

  // ✅ PUT /api/Patients/{id} (Update mode)
  updatePatient(id: number, payload: any): Observable<any> {
    return this.http.put(`${this.base}/api/Patients/${id}`, payload);
  }

  // optional
  deletePatient(id: number): Observable<any> {
    return this.http.delete(`${this.base}/api/Patients/${id}`);
  }
}
