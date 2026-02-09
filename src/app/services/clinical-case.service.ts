import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export type ClinicalCasePayload = {
  patientId: number;
  complaints: Array<{
    complaintType: string;
    location: string;
    sensation: string;
    modality: string;
    concomitant: string;
  }>;
  familyHistory: any;
  personalStatus: any;
  menstrualHistory: any;
  maleSexualFunction: any;
  physicalReaction: any;
  physicalExamination: any;
  mentalState: any;
  behavioralEvaluation: any;
};

@Injectable({ providedIn: 'root' })
export class ClinicalCaseService {
  private readonly baseUrl =  environment.apiBaseUrl;
  

  constructor(private http: HttpClient) {}

  create(payload: ClinicalCasePayload): Observable<any> {
    return this.http.post(this.baseUrl, payload, { responseType: 'text' as any });
  }
}
