import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, PopoverController } from '@ionic/angular';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import {
  firstValueFrom,
  Subject,
  Subscription,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  catchError,
} from 'rxjs';

import { PatientService } from 'src/app/services/patient.service';
import { PatientActionPopoverComponent } from 'src/app/components/patient-action-popover/patient-action-popover.component';
import { NotificationService } from 'src/app/services/notification.service';
import { AppointmentService } from 'src/app/services/appointment.service';

type Row = {
  srNo: number;
  id: number;
  pid: string;
  name: string;
  phone: string;
  gender: string;
  hasActiveAppointment: boolean;
  raw: any;
};

@Component({
  selector: 'app-patient-listing',
  templateUrl: './patient-list.page.html',
  styleUrls: ['./patient-list.page.scss'],
  standalone: false,
})
export class PatientListPage implements OnInit, OnDestroy {
  currentStatus: number | null = null;
  appointmentId: number | null = null;

  // ── List State ────────────────────────────────────────────────
  loading = false;
  searchText = '';
  isSearching = false;
  searchedOnce = false;
  page = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 0;
  hasNext = false;
  rows: Row[] = [];

  // ── Notifications ─────────────────────────────────────────────
  unreadCount = 0;
  notifications: any[] = [];

  // ── Inline Appointment Panel ──────────────────────────────────
  showAppointmentPanel = false;
  selectedPatientForAppt: Row | null = null;
  creatingAppointment = false;

  apptMinDate = new Date().toISOString().substring(0, 10);
  apptMaxDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().substring(0, 10);
  })();

  // appointmentForm = this.fb.group({
  //   appointmentDate: new FormControl<string | null>(
  //     new Date().toISOString().substring(0, 10),
  //     [Validators.required]
  //   ),
  //   appointmentTime: new FormControl<string | null>(null),
  //   remark: new FormControl<string | null>(''),
  // });

  appointmentForm = this.fb.group({
    appointmentDate: new FormControl<string | null>(
      new Date().toISOString().substring(0, 10),
      [Validators.required],
    ),
    appointmentTime: new FormControl<string | null>(null),
    remark: new FormControl<string | null>(''),
    status: new FormControl<number>(1), // ✅ ADD THIS
  });

  // ── Private ───────────────────────────────────────────────────
  private subs = new Subscription();
  private search$ = new Subject<string>();

  // ─────────────────────────────────────────────────────────────
  constructor(
    private fb: FormBuilder,
    private patientService: PatientService,
    private apptService: AppointmentService,
    private notificationService: NotificationService,
    private toastCtrl: ToastController,
    private router: Router,
    private popoverCtrl: PopoverController,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.setupSearchStream();
    this.loadPatients(true);
    this.loadNotifications();
  }

  ionViewWillEnter(): void {
    this.loadPatients(true);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ─────────────────────────────────────────────────────────────
  // SEARCH
  // ─────────────────────────────────────────────────────────────

  private setupSearchStream(): void {
    const sub = this.search$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((query) => {
          const q = (query || '').trim();

          if (!q) {
            this.isSearching = false;
            this.searchedOnce = false;
            this.page = 1;
            return this.fetchPatients();
          }

          this.isSearching = true;
          this.searchedOnce = true;
          this.loading = true;
          this.page = 1;

          return this.patientService.searchPatients(q).pipe(
            catchError((err) => {
              this.handleError(err, 'Search failed');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        if (!res) {
          this.loading = false;
          return;
        }

        const list = this.extractArray(res);

        if (this.isSearching) {
          this.rows = this.mapRows(list, 1);
          this.totalCount = list.length;
          this.totalPages = 1;
          this.hasNext = false;
        } else {
          this.rows = this.mapRows(list, this.page);
          this.updatePagination(res, list);
        }

        this.loading = false;
      });

    this.subs.add(sub);
  }

  onSearchInput(): void {
    this.search$.next(this.searchText || '');
  }
  search(): void {
    this.search$.next((this.searchText || '').trim());
  }
  clearSearch(): void {
    this.searchText = '';
    this.search$.next('');
  }

  get showCreatePatientBtn(): boolean {
    return (
      this.isSearching &&
      this.searchedOnce &&
      !this.loading &&
      this.rows.length === 0 &&
      (this.searchText || '').trim().length > 0
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LOAD PATIENTS
  // ─────────────────────────────────────────────────────────────

  loadPatients(reset = false): void {
    if (reset) this.page = 1;

    this.fetchPatients().subscribe({
      next: (res) => {
        if (!res) return;
        const list = this.extractArray(res);
        this.rows = this.mapRows(list, this.page);
        this.updatePagination(res, list);
      },
      complete: () => (this.loading = false),
    });
  }

  private fetchPatients() {
    this.loading = true;
    return this.patientService.getPatients(this.page, this.pageSize).pipe(
      catchError((err) => {
        this.handleError(err, 'Failed to load patients');
        return of(null);
      }),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // PAGINATION
  // ─────────────────────────────────────────────────────────────

  nextPage(): void {
    if (this.loading || this.isSearching || !this.hasNext) return;
    this.page++;
    this.loadPatients();
  }

  prevPage(): void {
    if (this.loading || this.isSearching || this.page <= 1) return;
    this.page--;
    this.loadPatients();
  }

  // ─────────────────────────────────────────────────────────────
  // POPOVER ACTIONS
  // ─────────────────────────────────────────────────────────────

  async openActions(ev: Event, row: Row): Promise<void> {
    ev.stopPropagation();

    const popover = await this.popoverCtrl.create({
      component: PatientActionPopoverComponent,
      event: ev,
      translucent: true,
      componentProps: { patient: row },
    });

    await popover.present();

    const { data } = await popover.onDidDismiss();
    if (!data?.action) return;

    switch (data.action) {
      case 'edit':
        this.router.navigate(['/patients'], {
          queryParams: { patientId: row.id, tab: 'prelim', from: 'list' },
        });
        break;

      case 'appointment':
        this.openAppointmentPanel(row);
        break;

      case 'status':
        console.log('Change status clicked');
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // INLINE APPOINTMENT PANEL
  // ─────────────────────────────────────────────────────────────

  // openAppointmentPanel(row: Row): void {
  //   this.selectedPatientForAppt = row;
  //   this.appointmentForm.reset({
  //     appointmentDate: new Date().toISOString().substring(0, 10),
  //     appointmentTime: null,
  //     remark: '',
  //   });
  //   this.showAppointmentPanel = true;
  // }

  async openAppointmentPanel(row: Row): Promise<void> {
    this.selectedPatientForAppt = row;

    this.appointmentForm.reset({
      appointmentDate: new Date().toISOString().substring(0, 10),
      appointmentTime: null,
      remark: '',
      status: 1,
    });

    // 🔵 EDIT MODE → fetch appointment
    if (row.hasActiveAppointment) {
      try {
        const res: any = await firstValueFrom(
          this.apptService.getActiveAppointmentByPatient(row.id),
        );

        if (res) {
          this.appointmentId = res.appointmentId;
          this.currentStatus = res.status;

          this.appointmentForm.patchValue({
            appointmentDate: res.appointmentDate?.slice(0, 10),
            appointmentTime: res.appointmentTime?.slice(0, 5),
            remark: res.remark || '',
            status: res.status,
          });
        }
      } catch {
        this.toastCtrl
          .create({
            message: 'Failed to load appointment',
            duration: 2000,
          })
          .then((t) => t.present());
      }
    }

    this.showAppointmentPanel = true;
  }

  closeAppointmentPanel(): void {
    this.showAppointmentPanel = false;
    this.selectedPatientForAppt = null;
  }

  // async submitAppointment(): Promise<void> {
  //   if (this.creatingAppointment) return;

  //   if (this.appointmentForm.invalid) {
  //     this.appointmentForm.markAllAsTouched();
  //     return;
  //   }

  //   const raw = this.appointmentForm.getRawValue();
  //   const patientId = Number(this.selectedPatientForAppt?.id);

  //   const payload: any = {
  //     patientId,
  //     appointmentDate: raw.appointmentDate,
  //   };

  //   if (raw.appointmentTime) payload.appointmentTime = raw.appointmentTime + ':00';
  //   if (raw.remark?.trim())  payload.remark = raw.remark.trim();

  //   this.creatingAppointment = true;

  //   try {
  //     await firstValueFrom(this.apptService.createAppointment(payload));

  //     const toast = await this.toastCtrl.create({
  //       message: 'Appointment Created ✅',
  //       duration: 2500,
  //       position: 'top',
  //     });
  //     await toast.present();

  //     this.closeAppointmentPanel();
  //     this.loadPatients();
  //   } catch (err) {
  //     await this.handleError(err, 'Failed to create appointment');
  //   } finally {
  //     this.creatingAppointment = false;
  //   }
  // }

  // ─────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────

  async submitAppointment(): Promise<void> {
    if (this.creatingAppointment) return;

    if (this.appointmentForm.invalid) {
      this.appointmentForm.markAllAsTouched();
      return;
    }

    const raw = this.appointmentForm.getRawValue();
    const patientId = Number(this.selectedPatientForAppt?.id);

    const payload: any = {
      appointmentDate: raw.appointmentDate,
    };

    if (raw.appointmentTime) {
      payload.appointmentTime = raw.appointmentTime + ':00';
    }

    if (raw.remark?.trim()) {
      payload.remark = raw.remark.trim();
    }

    this.creatingAppointment = true;

    try {
      // 🟢 CREATE
      if (!this.selectedPatientForAppt?.hasActiveAppointment) {
        await firstValueFrom(
          this.apptService.createAppointment({
            patientId,
            ...payload,
          }),
        );

        await (
          await this.toastCtrl.create({
            message: 'Appointment Created ✅',
            duration: 2000,
          })
        ).present();
      } else {
        // 🔵 UPDATE
        await firstValueFrom(
          this.apptService.updateAppointment(this.appointmentId!, payload),
        );

        if (raw.status !== this.currentStatus) {
          await firstValueFrom(
            this.apptService.updateAppointmentStatus(
              this.appointmentId!,
              Number(raw.status),
            ),
          );
        }

        await (
          await this.toastCtrl.create({
            message: 'Appointment Updated ✅',
            duration: 2000,
          })
        ).present();
      }

      this.closeAppointmentPanel();
      this.loadPatients();
    } catch {
      await (
        await this.toastCtrl.create({
          message: 'Operation failed',
          duration: 2000,
        })
      ).present();
    } finally {
      this.creatingAppointment = false;
    }
  }

  goToCreatePatient(): void {
    this.router.navigate(['/patients'], {
      queryParams: { mode: 'create', from: 'list', tab: 'prelim' },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────

  async loadNotifications(): Promise<void> {
    const res: any = await this.notificationService
      .getNotifications()
      .toPromise();
    this.notifications = res || [];
    this.unreadCount = this.notifications.filter((n) => !n.isRead).length;
  }

  openNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  private extractArray(res: any): any[] {
    if (Array.isArray(res)) return res;
    return res?.items || res?.data || res?.patients || [];
  }

  private updatePagination(res: any, list: any[]): void {
    const count = Number(res?.totalCount ?? 0) || 0;
    const pages =
      Number(res?.totalPages ?? 0) ||
      (count ? Math.ceil(count / this.pageSize) : 0);

    this.totalCount = count;
    this.totalPages = pages;
    this.hasNext =
      pages > 0 ? this.page < pages : list.length === this.pageSize;
  }

  private mapRows(list: any[], page: number): Row[] {
    return list.map((p: any, idx: number) => {
      const patientId = Number(
        p?.patientId ??
          p?.patientID ??
          p?.patientsId ??
          p?.id ??
          p?.patient?.patientId ??
          0,
      );

      if (!patientId) console.warn('❌ Invalid patientId detected:', p);

      return {
        srNo: (page - 1) * this.pageSize + idx + 1,
        id: patientId,
        pid: p?.patientIdFormatted ?? p?.pid ?? '-',
        name: p?.fullName ?? p?.patient?.fullName ?? 'NA',
        phone: p?.phoneNumber ?? p?.patient?.phoneNumber ?? '-',
        gender: p?.gender ?? p?.patient?.gender ?? 'NA',
        hasActiveAppointment: !!p?.hasActiveAppointment,
        raw: p,
      };
    });
  }

  private async handleError(err: any, fallback: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: err?.error?.message || err?.message || fallback,
      duration: 2500,
      position: 'top',
    });
    await toast.present();
  }
}
