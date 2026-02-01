// import { Injectable } from '@angular/core';
// import { HttpClient, HttpParams } from '@angular/common/http';
// import { environment } from '../../environments/environment';
// import { map, Observable } from 'rxjs';

// export enum AppointmentStatus {
//   Pending = 1,
//   InPatient = 2,
//   AwaitingPayment = 3,
//   OutPatient = 4,
//   Cancelled = 5,
// }

// @Injectable({ providedIn: 'root' })
// export class AppointmentService {
//   private base = environment.apiBaseUrl;

//   constructor(private http: HttpClient) {}

//   // ---------------- POST /api/Appointment ----------------
//   // POST needs appointmentTime "HH:mm:00"
//   createAppointment(payload: {
//     patientId: number;
//     appointmentDate: string;   // YYYY-MM-DD
//     appointmentTime: string;   // HH:mm:00
//     remark?: string;
//   }): Observable<any> {
//     return this.http.post(`${this.base}/api/Appointment`, payload);
//   }

//   // ---------------- PUT /api/Appointment/{id} ----------------
//   // PUT needs appointmentTime { ticks }
//   updateAppointment(id: number, payload: {
//     appointmentDate: string;          // YYYY-MM-DD
//     appointmentTime: string;
//     remark?: string;
//   }): Observable<any> {
//     return this.http.put(`${this.base}/api/Appointment/${id}`, payload);
//   }

//   // ---------------- PUT /api/Appointment/{id}/status ----------------
//   updateAppointmentStatus(id: number, status: AppointmentStatus): Observable<any> {
//     return this.http.put(`${this.base}/api/Appointment/${id}/status`, { status });
//   }

//   // ---------------- GET /api/Appointment/patient/{patientId} ----------------
//   getAppointmentsByPatient(patientId: number): Observable<any> {
//     return this.http.get(`${this.base}/api/Appointment/patient/${patientId}`);
//   }

//   // ✅ ACTIVE appointment helper (Swagger response: { appointments: [...] })
//   // Active = not OutPatient(4) and not Cancelled(5)
//   getActiveAppointmentByPatient(patientId: number) {
//     return this.getAppointmentsByPatient(patientId).pipe(
//       map((res: any) => {
//         const arr = Array.isArray(res?.appointments) ? res.appointments : [];
//         const active = arr.find((a: any) => {
//           const s = Number(a?.status);
//           return s !== AppointmentStatus.OutPatient && s !== AppointmentStatus.Cancelled;
//         });
//         return active || null;
//       })
//     );
//   }

//   // ---------------- Optional / existing endpoints ----------------
//   getTodayAppointments(): Observable<any> {
//     return this.http.get(`${this.base}/api/Appointment/today`);
//   }

//   getAppointments(params?: { page?: number; pageSize?: number; q?: string; status?: string }): Observable<any> {
//     let httpParams = new HttpParams();
//     if (params?.page != null) httpParams = httpParams.set('page', String(params.page));
//     if (params?.pageSize != null) httpParams = httpParams.set('pageSize', String(params.pageSize));
//     if (params?.q) httpParams = httpParams.set('q', params.q);
//     if (params?.status) httpParams = httpParams.set('status', params.status);
//     return this.http.get(`${this.base}/api/Appointment`, { params: httpParams });
//   }

//   getAppointmentById(id: number): Observable<any> {
//     return this.http.get(`${this.base}/api/Appointment/${id}`);
//   }

//   deleteAppointment(id: number): Observable<any> {
//     return this.http.delete(`${this.base}/api/Appointment/${id}`);
//   }

//   getAppointmentsByStatus(status: string): Observable<any> {
//     return this.http.get(`${this.base}/api/Appointment/status/${encodeURIComponent(status)}`);
//   }

//   getQueue(): Observable<any> {
//     return this.http.get(`${this.base}/api/Appointment/queue`);
//   }

//   restoreAppointment(id: number): Observable<any> {
//     return this.http.put(`${this.base}/api/Appointment/${id}/restore`, {});
//   }

//   // ---------------- TIME HELPERS ----------------

//   // POST needs "HH:mm:00"
//   hhmmToTimeString(hhmm: string): string {
//     const s = String(hhmm || '').trim();
//     if (!s.includes(':')) return '00:00:00';
//     const [hhStr, mmStr] = s.split(':');
//     const hh = Number(hhStr);
//     const mm = Number(mmStr);
//     if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '00:00:00';
//     if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '00:00:00';
//     return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
//   }

//   // PUT needs ticks
//   hhmmToTicks(hhmm: string): number {
//     const s = String(hhmm || '').trim();
//     const [hhStr, mmStr] = s.split(':');
//     const hh = Number(hhStr);
//     const mm = Number(mmStr);

//     if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
//     if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return 0;

//     const totalSeconds = (hh * 60 + mm) * 60;
//     return totalSeconds * 10_000_000; // .NET ticks
//   }

//   // ticks -> HH:mm
//   ticksToHHmm(ticks: number): string {
//     const t = Number(ticks || 0);
//     if (!Number.isFinite(t) || t < 0) return '00:00';

//     const totalSeconds = Math.floor(t / 10_000_000);
//     const hh = Math.floor(totalSeconds / 3600) % 24;
//     const mm = Math.floor((totalSeconds % 3600) / 60);

//     return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
//   }

//   // status label fallback (agar statusText na aaye)
//   statusLabel(s: number): string {
//     switch (Number(s)) {
//       case AppointmentStatus.Pending: return 'Pending';
//       case AppointmentStatus.InPatient: return 'In Patient';
//       case AppointmentStatus.AwaitingPayment: return 'Awaiting Payment';
//       case AppointmentStatus.OutPatient: return 'Out Patient';
//       case AppointmentStatus.Cancelled: return 'Cancelled';
//       default: return 'Unknown';
//     }
//   }
// }


// ================================================================
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, Observable } from 'rxjs';

export enum AppointmentStatus {
  Pending = 1,
  InPatient = 2,
  AwaitingPayment = 3,
  OutPatient = 4,
  Cancelled = 5,
}

export type AppointmentDto = {
  appointmentId: number;
  patient?: {
    patientId: number;
    patientIdFormatted?: string;
    fullName?: string;
    phoneNumber?: string;
    gender?: string;
  };
  appointmentDate?: string; // ISO
  appointmentTime?: any; // API sometimes returns string / sometimes object in older responses
  appointmentTimeFormatted?: string;
  status?: number;
  statusText?: string;
  remark?: string;
};

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // ---------------- CREATE ----------------
  // POST /api/Appointment
  createAppointment(payload: {
    patientId: number;
    appointmentDate: string;  // YYYY-MM-DD
    appointmentTime: string;  // HH:mm:00
    remark?: string;
  }): Observable<any> {
    return this.http.post(`${this.base}/api/Appointment`, payload);
  }

  // ---------------- UPDATE DETAILS ----------------
  // PUT /api/Appointment/{id}
  updateAppointment(
    id: number,
    payload: {
      appointmentDate: string; // YYYY-MM-DD
      appointmentTime: string; // HH:mm:00
      remark?: string;
    }
  ): Observable<any> {
    return this.http.put(`${this.base}/api/Appointment/${id}`, payload);
  }

  // ---------------- UPDATE STATUS ----------------
  // PUT /api/Appointment/{id}/status
  updateAppointmentStatus(id: number, status: AppointmentStatus): Observable<any> {
    return this.http.put(`${this.base}/api/Appointment/${id}/status`, { status });
  }

  // ---------------- FETCH ----------------
  // GET /api/Appointment/patient/{patientId}
  getAppointmentsByPatient(patientId: number): Observable<any> {
    return this.http.get(`${this.base}/api/Appointment/patient/${patientId}`);
  }

  // Active appointment = not OutPatient, not Cancelled
  getActiveAppointmentByPatient(patientId: number): Observable<AppointmentDto | null> {
    return this.getAppointmentsByPatient(patientId).pipe(
      map((res: any) => {
        const arr: AppointmentDto[] = Array.isArray(res?.appointments)
          ? res.appointments
          : Array.isArray(res)
          ? res
          : [];

        const active =
          arr.find((a) => {
            const s = Number(a?.status);
            return s !== AppointmentStatus.OutPatient && s !== AppointmentStatus.Cancelled;
          }) || null;

        return active;
      })
    );
  }

  // ---------------- Helpers ----------------

  // "HH:mm" => "HH:mm:00"
  hhmmToTimeString(hhmm: string): string {
    const s = String(hhmm || '').trim();
    const [hhStr, mmStr] = s.split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr);

    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '00:00:00';
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '00:00:00';

    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  }

  // API returns time as "14:30:00" OR { ticks } (older) OR { appointmentTimeFormatted }
  // We need HH:mm for <input type="time">
  toHHmmFromApiTime(appt: any): string {
    const t1 = String(appt?.appointmentTimeFormatted || '').trim();
    if (t1) return t1.substring(0, 5); // "HH:mm"

    const t = appt?.appointmentTime;

    // if string "14:30:00"
    if (typeof t === 'string' && t.includes(':')) return t.substring(0, 5);

    // if { ticks }
    const ticks = Number(t?.ticks || 0) || 0;
    if (ticks) return this.ticksToHHmm(ticks);

    return '11:45';
  }

  ticksToHHmm(ticks: number): string {
    const totalSeconds = Math.floor(Number(ticks) / 10_000_000);
    const hh = Math.floor(totalSeconds / 3600) % 24;
    const mm = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  statusLabel(s: number): string {
    switch (Number(s)) {
      case AppointmentStatus.Pending: return 'Pending';
      case AppointmentStatus.InPatient: return 'InPatient';
      case AppointmentStatus.AwaitingPayment: return 'AwaitingPayment';
      case AppointmentStatus.OutPatient: return 'OutPatient';
      case AppointmentStatus.Cancelled: return 'Cancelled';
      default: return 'Unknown';
    }
  }
}

