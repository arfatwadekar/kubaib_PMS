import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// ===== API DTOs (Swagger) =====
export type ClinicalComplaintDto = {
  complaintType: string;
  location: string;
  sensation: string;
  modality: string;
  concomitant: string;
};

export type ClinicalCasePayload = {
  patientId: number;
  complaints: ClinicalComplaintDto[];

  familyHistory: any;
  personalStatus: any;
  menstrualHistory: any;
  maleSexualFunction: any;
  physicalReaction: any;

  physicalExamination: any;
  mentalState: any;
  behavioralEvaluation: any;
};

export type ApiResponse<T = any> = {
  success: boolean;
  message: string;
  data: T;
};

@Injectable({ providedIn: 'root' })
export class MedicalExaminationService {
  private base = environment.apiBaseUrl; // ex: http://localhost:5000

  constructor(private http: HttpClient) {}

  // ===============================
  // POST : Create Clinical Case
  // ===============================
  create(payload: ClinicalCasePayload): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.base}/api/ClinicalCase`,
      payload
    );
  }

  // ===============================
  // GET : Get by PatientId
  // GET /api/ClinicalCase/{patientId}
  // ===============================
  getByPatientId(patientId: number): Observable<ClinicalCasePayload> {
    return this.http.get<ClinicalCasePayload>(
      `${this.base}/api/ClinicalCase/${patientId}`
    );
  }

  // ===============================
  // PUT : Update Clinical Case
  // PUT /api/ClinicalCase
  // ===============================
  update(payload: ClinicalCasePayload): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(
      `${this.base}/api/ClinicalCase`,
      payload
    );
  }
}
