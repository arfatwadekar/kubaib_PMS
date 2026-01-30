import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export type ComplaintType = 'Chief' | 'Associated' | 'PastHistory';

export interface ClinicalCaseComplaint {
  complaintType: ComplaintType;
  location: string;
  sensation: string;
  modality: string;
  concomitant: string;
}

export interface ClinicalCasePayload {
  patientId: number;
  complaints: ClinicalCaseComplaint[];

  familyHistory: any;
  personalStatus: any;
  menstrualHistory: any;
  maleSexualFunction: any;
  physicalReaction: any;
  physicalExamination: any;
  mentalState: any;
  behavioralEvaluation: any;
}

/** Common API response (as per your swagger sample) */
export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class ClinicalCaseService {
  private readonly base = environment.apiBaseUrl; // e.g. http://localhost:8080
  private readonly endpoint = '/api/ClinicalCase';

  constructor(private http: HttpClient) {}

  /** POST: Create clinical case */
  create(payload: ClinicalCasePayload): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}${this.endpoint}`, payload);
  }

  /** OPTIONAL (future): GET by patientId (only if backend supports) */
  // getByPatientId(patientId: number): Observable<ApiResponse<any>> {
  //   return this.http.get<ApiResponse<any>>(`${this.base}${this.endpoint}/${patientId}`);
  // }

  /** OPTIONAL (future): PUT update (only if backend supports) */
  // update(id: number, payload: ClinicalCasePayload): Observable<ApiResponse<any>> {
  //   return this.http.put<ApiResponse<any>>(`${this.base}${this.endpoint}/${id}`, payload);
  // }
}
