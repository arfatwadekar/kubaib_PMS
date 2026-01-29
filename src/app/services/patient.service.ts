import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  createPatient(payload: any): Observable<any> {
    return this.http.post(`${this.base}/api/Patients`, payload);
  }

  getPatients(page = 1, pageSize = 10): Observable<any> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));

    return this.http.get(`${this.base}/api/Patients`, { params });
  }

  searchPatients(query: string): Observable<any> {
    const q = (query || '').trim();
    const params = new HttpParams().set('query', q);
    return this.http.post(`${this.base}/api/Patients/search`, {}, { params });
  }
}
