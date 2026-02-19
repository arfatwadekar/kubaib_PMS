import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// =====================
// Interfaces
// =====================
export interface CreatePaymentPayload {
  patientId: number;
  appointmentId?: number;
  consultationCharges: number;
  waveOffAmount?: number;
  amountPaid: number;
  paymentMode: string;       // 'Cash' | 'Online'
  paymentDate: string;       // ISO string
  waveOffPassword?: string;
}

export interface UpdatePaymentPayload extends CreatePaymentPayload {
  id: number;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private base = `${environment.apiBaseUrl}/api/Payment`;

  constructor(private http: HttpClient) {}

  // POST /api/Payment
  createPayment(payload: CreatePaymentPayload): Observable<any> {
    return this.http.post(`${this.base}`, payload);
  }

  // PUT /api/Payment/{id}
  updatePayment(id: number, payload: UpdatePaymentPayload): Observable<any> {
    return this.http.put(`${this.base}/${id}`, payload);
  }

  // GET /api/Payment/{id}
  getById(id: number): Observable<any> {
    return this.http.get(`${this.base}/${id}`);
  }

  // DELETE /api/Payment/{id}
  deletePayment(id: number): Observable<any> {
    return this.http.delete(`${this.base}/${id}`);
  }

  // GET /api/Payment/patient/{patientId}  — payment history
  getByPatient(patientId: number): Observable<any> {
    return this.http.get(`${this.base}/patient/${patientId}`);
  }

  // GET /api/Payment/patient/{patientId}/balance  — pending balance
  getBalance(patientId: number): Observable<any> {
    return this.http.get(`${this.base}/patient/${patientId}/balance`);
  }
}