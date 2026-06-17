import {
  HttpClient,
  HttpErrorResponse
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface AnalyticsFilterRequest {
  filterType: string;
  fromDate?: string;
  toDate?: string;
  gender?: string;
  retentionStatus?: string;
}

export interface AnalyticsSummary {
  consultationRevenueTotalAmount: number;
  consultationRevenueAppointmentCount: number;
  patientPaymentsTotalAmountPaid: number;
  totalRemainingBalance: number;
  otcSalesTotalAmountOfMedicine: number;
  pendingOtcAmount: number;
}

export interface DailyBreakdown {
  date: string;
  appointmentCount: number;
  consultationCharges: number;
  consultationReceived: number;
  pendingConsultation: number;
  otcSales: number;
  otcReceived: number;
  pendingOtc: number;
  intake?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly baseUrl =
    `${environment.apiBaseUrl}/api/Analytics`;

  constructor(private http: HttpClient) {}

  // ================= ERROR HANDLER =================

  private handleError(error: HttpErrorResponse) {
    let message = 'Something went wrong.';

    switch (error.status) {
      case 400:
        message =
          error?.error?.detail ||
          error?.error?.title ||
          'Invalid request.';
        break;

      case 401:
        message =
          'Your session has expired. Please login again.';
        break;

      case 403:
        message =
          'You do not have permission to perform this action.';
        break;

      case 404:
        message = 'Requested data not found.';
        break;

      case 500:
        message =
          error?.error?.detail ||
          'Internal server error.';
        break;
    }

    return throwError(() => message);
  }

  // ================= VALIDATION =================

  private validateFilter(
    request: AnalyticsFilterRequest
  ): string | null {

    if (!request?.filterType?.trim()) {
      return 'Filter type is required.';
    }

    if (
      request.fromDate &&
      request.toDate &&
      new Date(request.fromDate) >
        new Date(request.toDate)
    ) {
      return 'From date cannot be greater than To date.';
    }

    return null;
  }

  // ================= SUMMARY =================

  getSummary(
    request: AnalyticsFilterRequest
  ): Observable<AnalyticsSummary> {

    const validationError =
      this.validateFilter(request);

    if (validationError) {
      return throwError(() => validationError);
    }

    return this.http
      .post<AnalyticsSummary>(
        `${this.baseUrl}/summary`,
        request
      )
      .pipe(
        catchError((error) =>
          this.handleError(error)
        )
      );
  }

  // ================= DAILY BREAKDOWN =================

  getDailyBreakdown(
    request: AnalyticsFilterRequest
  ): Observable<DailyBreakdown[]> {

    const validationError =
      this.validateFilter(request);

    if (validationError) {
      return throwError(() => validationError);
    }

    return this.http
      .post<DailyBreakdown[]>(
        `${this.baseUrl}/daily-breakdown`,
        request
      )
      .pipe(
        catchError((error) =>
          this.handleError(error)
        )
      );
  }

  // ================= EXPORT EXCEL =================

  exportDailyBreakdownExcel(
    request: AnalyticsFilterRequest
  ): Observable<Blob> {

    const validationError =
      this.validateFilter(request);

    if (validationError) {
      return throwError(() => validationError);
    }

    return this.http
      .post(
        `${this.baseUrl}/daily-breakdown/export-excel`,
        request,
        {
          responseType: 'blob'
        }
      )
      .pipe(
        catchError((error) =>
          this.handleError(error)
        )
      );
  }
}