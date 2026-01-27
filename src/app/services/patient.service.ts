// import { Injectable } from '@angular/core';
// import { HttpClient, HttpParams } from '@angular/common/http';
// import { environment } from '../../environments/environment';

// export type PatientDto = {
//   patientId?: any;
//   patientID?: any;
//   pid?: any;

//   firstName?: string;
//   lastName?: string;
//   phoneNumber?: string;
//   gender?: string;
// };

// @Injectable({ providedIn: 'root' })
// export class PatientService {
//   private base = environment.apiBaseUrl;

//   constructor(private http: HttpClient) {}

//   getPatients(page = 1, pageSize = 10) {
//     const params = new HttpParams()
//       .set('page', String(page))
//       .set('pageSize', String(pageSize));

//     return this.http.get(`${this.base}/api/Patients`, { params });
//   }

//   //  getPatients(page = 1, pageSize = 10) {
//   //   return this.http.get(`${this.base}/api/Patients?page=${page}&pageSize=${pageSize}`);
//   // }

//   createPatient(payload: any) {
//     return this.http.post(`${this.base}/api/Patients`, payload);
//   }
// }

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type PatientDto = any;

@Injectable({ providedIn: 'root' })
export class PatientService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  createPatient(payload: any) {
    return this.http.post(`${this.base}/api/Patients`, payload);
  }

  // // ✅ ADD THIS
  // getPatients(page = 1, pageSize = 10) {
  //   return this.http.get(`${this.base}/api/Patients?page=${page}&pageSize=${pageSize}`);
  // }

  
  // ✅ LISTING: GET /api/Patients?page=1&pageSize=10
  getPatients(page = 1, pageSize = 10) {
    const params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));

    return this.http.get(`${this.base}/api/Patients`, { params });
  }

  // ✅ SEARCH: POST /api/Patients/search?query=anas
  // NOTE: body empty {}, query goes in params (options)
  searchPatients(query: string) {
    const q = (query || '').trim();
    const params = new HttpParams().set('query', q);

    return this.http.post(`${this.base}/api/Patients/search`, {}, { params });
  }
}
