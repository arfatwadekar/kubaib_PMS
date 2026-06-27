// import { HttpClient, HttpParams } from '@angular/common/http';
// import { Injectable } from '@angular/core';
// import { Observable } from 'rxjs';
// import { environment } from 'src/environments/environment';

// export interface OtcMedicinePayment {
//   id: string;
//   otcMedicineId: string;
//   amountPaid: number;
//   paymentDate: string;
//   notes: string;
// }

// export interface OtcMedicine {
//   id: string;
//   nameOfMedicine: string;
//   amountOfMedicine: number;
//   totalAmountPaid: number;
//   pendingBalance: number;
//   patientName: string;
//   dateOfPurchase: string;
//   payments: OtcMedicinePayment[];
// }

// export interface CreateUpdateOtcMedicineRequest {
//   id?: string;
//   nameOfMedicine: string;
//   amountOfMedicine: number;
//   patientName: string;
//   dateOfPurchase: string;
//   amountPaid?: number;
//   paymentNotes?: string;
//   paymentDate?: string;
// }

// @Injectable({
//   providedIn: 'root'
// })
// export class OtcMedicineService {

//   private baseUrl = `${environment.apiBaseUrl}/api/OtcMedicine`;

//   constructor(private http: HttpClient) {}

//   /**
//    * Get all OTC medicine sales
//    */
//   getAll(search?: string): Observable<OtcMedicine[]> {
//     let params = new HttpParams();

//     if (search) {
//       params = params.set('search', search);
//     }

//     return this.http.get<OtcMedicine[]>(this.baseUrl, { params });
//   }

//   /**
//    * Get OTC medicine sale by Id
//    */
//   getById(id: string): Observable<OtcMedicine> {
//     return this.http.get<OtcMedicine>(`${this.baseUrl}/${id}`);
//   }

//   /**
//    * Create OTC medicine sale
//    */
//   create(
//     data: CreateUpdateOtcMedicineRequest
//   ): Observable<OtcMedicine> {
//     return this.http.post<OtcMedicine>(this.baseUrl, data);
//   }

//   /**
//    * Update OTC medicine sale
//    */
//   update(
//     data: CreateUpdateOtcMedicineRequest
//   ): Observable<OtcMedicine> {
//     return this.http.put<OtcMedicine>(this.baseUrl, data);
//   }

//   /**
//    * Soft delete OTC medicine sale
//    */
//   delete(id: string): Observable<string> {
//     return this.http.delete(`${this.baseUrl}/${id}`, {
//       responseType: 'text'
//     });
//   }
// }

import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface OtcMedicinePayment {
  id: string;
  otcMedicineId: string;
  amountPaid: number;
  paymentDate: string;
  notes: string;
}

export interface OtcMedicine {
  id: string;
  nameOfMedicine: string;
  amountOfMedicine: number;
  totalAmountPaid: number;
  pendingBalance: number;
  patientName: string;
  dateOfPurchase: string;
  payments: OtcMedicinePayment[]; // ✅ Ye line add karo
}

export interface CreateUpdateOtcMedicineRequest {
  id?: string;
  nameOfMedicine: string;
  amountOfMedicine: number;
  patientName: string;
  dateOfPurchase: string;
  amountPaid?: number;
  notes?: string;
  paymentDate?: string;
}

@Injectable({
  providedIn: 'root',
})
export class OtcMedicineService {
  private readonly baseUrl = `${environment.apiBaseUrl}/api/OtcMedicine`;

  constructor(private http: HttpClient) {}

  // ================= ERROR HANDLER =================

  private handleError(error: HttpErrorResponse) {
    let message = 'Something went wrong.';

    switch (error.status) {
      case 400:
        message =
          error?.error?.detail || error?.error?.title || 'Invalid request.';
        break;

      case 401:
        message = 'Your session has expired. Please login again.';
        break;

      case 403:
        message = 'You do not have permission to perform this action.';
        break;

      case 404:
        message = 'Record not found.';
        break;

      case 500:
        message = error?.error?.detail || 'Internal server error.';
        break;
    }

    return throwError(() => message);
  }

  // ================= GET ALL =================

  /**
   * Get all OTC medicines with optional search.
   */
  getAll(search?: string): Observable<OtcMedicine[]> {
    let params = new HttpParams();

    if (search?.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http
      .get<OtcMedicine[]>(this.baseUrl, { params })
      .pipe(catchError((error) => this.handleError(error)));
  }

  // ================= GET BY ID =================

  getById(id: string): Observable<OtcMedicine> {
    if (!id?.trim()) {
      return throwError(() => 'Invalid record id.');
    }

    return this.http
      .get<OtcMedicine>(`${this.baseUrl}/${id}`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  // ================= CREATE =================

  create(data: CreateUpdateOtcMedicineRequest): Observable<OtcMedicine> {
    return this.http
      .post<OtcMedicine>(this.baseUrl, data)
      .pipe(catchError((error) => this.handleError(error)));
  }

  // ================= UPDATE =================

  update(data: CreateUpdateOtcMedicineRequest): Observable<OtcMedicine> {
    if (!data?.id?.trim()) {
      return throwError(() => 'Record id is required.');
    }

    // Try the conventional `/api/OtcMedicine` update first; some backends
    // expose a different update route (`/api/OtcMedicineUpdate`) so fall
    // back to it on 404 to handle both server variants.
    const primaryUrl = this.baseUrl; // e.g. /api/OtcMedicine
    const fallbackUrl = `${environment.apiBaseUrl}/api/OtcMedicineUpdate`;

    return this.http.put<OtcMedicine>(primaryUrl, data).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error?.status === 404) {
          // try fallback endpoint
          return this.http
            .put<OtcMedicine>(fallbackUrl, data)
            .pipe(catchError((err) => this.handleError(err)));
        }

        return this.handleError(error);
      }),
    );
  }

  // ================= DELETE =================

  delete(id: string): Observable<string> {
    if (!id?.trim()) {
      return throwError(() => 'Invalid record id.');
    }

    return this.http
      .delete(`${this.baseUrl}/${id}`, {
        responseType: 'text',
      })
      .pipe(catchError((error) => this.handleError(error)));
  }
}
