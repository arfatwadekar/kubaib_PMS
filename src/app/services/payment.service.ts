import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

/* ============================================================
   INTERFACES (Aligned With Swagger)
============================================================ */

export interface CreatePaymentPayload {
  patientId: number;
  appointmentId?: number;
  consultationCharges: number;
  waveOffAmount?: number;
  amountPaid: number;
  paymentMode: string;       // Cash | Online
  paymentDate: string;       // ISO string
  waveOffPassword?: string;
}

export interface UpdatePaymentPayload {
  amountPaid: number;
  paymentMode: string;
  paymentDate: string;
  notes?: string;
}

/* ============================================================
   SERVICE
============================================================ */

@Injectable({
  providedIn: 'root',
})
export class PaymentService {

  private baseUrl = `${environment.apiBaseUrl}/api/Payment`;

  constructor(private http: HttpClient) {}

  /* ============================================================
     CREATE PAYMENT
     POST /api/Payment
  ============================================================ */
  createPayment(payload: CreatePaymentPayload): Observable<any> {
    return this.http.post(`${this.baseUrl}`, payload);
  }

  /* ============================================================
     UPDATE PAYMENT
     PUT /api/Payment/{id}
  ============================================================ */
  updatePayment(id: number, payload: UpdatePaymentPayload): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}`, payload);
  }

  /* ============================================================
     GET PAYMENT BY ID
     GET /api/Payment/{id}
  ============================================================ */
  getById(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/${id}`);
  }

  /* ============================================================
     DELETE PAYMENT
     DELETE /api/Payment/{id}
  ============================================================ */
  deletePayment(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  /* ============================================================
     GET PAYMENT HISTORY
     GET /api/Payment/patient/{patientId}
  ============================================================ */
  getByPatient(patientId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/patient/${patientId}`);
  }

  /* ============================================================
     GET BALANCE
     GET /api/Payment/patient/{patientId}/balance
  ============================================================ */
  getBalance(patientId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/patient/${patientId}/balance`);
  }
}