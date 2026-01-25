import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type PatientDto = {
  patientId?: any;
  patientID?: any;
  pid?: any;

  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  gender?: string;
};

@Injectable({ providedIn: 'root' })
export class PatientService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getPatients(page = 1, pageSize = 10) {
    const params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));

    return this.http.get(`${this.base}/api/Patients`, { params });
  }

  createPatient(payload: any) {
    return this.http.post(`${this.base}/api/Patients`, payload);
  }
}
