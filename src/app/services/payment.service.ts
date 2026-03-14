import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  private paymentUrl = `${environment.apiBaseUrl}/api/Payment`;
  private medicineUrl = `${environment.apiBaseUrl}/api/Medicine`;
  private appointmentUrl = `${environment.apiBaseUrl}/api/Appointment`;

  constructor(private http: HttpClient) {}

  /* ===================================================
      APPOINTMENT SUMMARY
      Fetches:
      - consultation charges
      - wave off
      - payment
      - followup
      - medicines
  =================================================== */

  getAppointmentSummary(appointmentId: number): Observable<any> {
    return this.http.get(
      `${this.appointmentUrl}/${appointmentId}/summary`
    );
  }

  /* ===================================================
      CREATE PAYMENT
  =================================================== */

  createPayment(payload: any): Observable<any> {
    return this.http.post(
      `${this.paymentUrl}`,
      payload
    );
  }

  /* ===================================================
      UPDATE PAYMENT
  =================================================== */

  updatePayment(paymentId: number, payload: any): Observable<any> {
    return this.http.put(
      `${this.paymentUrl}/${paymentId}`,
      payload
    );
  }

  /* ===================================================
      GET PAYMENT BY ID
  =================================================== */

  getPaymentById(paymentId: number): Observable<any> {
    return this.http.get(
      `${this.paymentUrl}/${paymentId}`
    );
  }

  /* ===================================================
      PAYMENT HISTORY (PATIENT LEVEL)
  =================================================== */

  getByPatient(patientId: number): Observable<any> {
    return this.http.get(
      `${this.paymentUrl}/patient/${patientId}`
    );
  }

  /* ===================================================
      GET PENDING BALANCE
  =================================================== */

  getBalance(patientId: number): Observable<any> {
    return this.http.get(
      `${this.paymentUrl}/patient/${patientId}/balance`
    );
  }

  /* ===================================================
      PRESCRIPTIONS BY APPOINTMENT
  =================================================== */

  getPrescriptionsByAppointment(appointmentId: number): Observable<any> {
    return this.http.get(
      `${this.medicineUrl}/appointment/${appointmentId}/prescriptions`
    );
  }

  /* ===================================================
      UPDATE APPOINTMENT STATUS
      Used after payment complete
  =================================================== */

  // updateAppointmentStatus(
  //   appointmentId: number,
  //   status: string
  // ): Observable<any> {
  //   return this.http.put(
  //     `${this.appointmentUrl}/${appointmentId}/status`,
  //     { status }
  //   );
  // }

  updateAppointmentStatus(
  appointmentId: number,
  status: number
): Observable<any> {
  return this.http.put(
    `${this.appointmentUrl}/${appointmentId}/status`,
    { status }
  );
}


}