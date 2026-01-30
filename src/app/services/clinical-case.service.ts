
// src/app/services/clinical-case.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class ClinicalCaseService {
  private baseUrl = 'http://localhost:8080'; // ✅ change if needed

  constructor(private http: HttpClient) {}

  createClinicalCase(payload: ClinicalCasePayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/ClinicalCase`, payload);
  }
}
