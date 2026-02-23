import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
  ModalController,
  ToastController,
  PopoverController
} from '@ionic/angular';

import {
  Subject,
  Subscription,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  catchError
} from 'rxjs';

import { PatientService } from 'src/app/services/patient.service';
import { CreateAppointmentModalComponent } from 'src/app/components/create-appointment-modal/create-appointment-modal.component';
import { PatientActionPopoverComponent } from 'src/app/components/patient-action-popover/patient-action-popover.component';

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
  standalone  : false
})
export class PatientListPage implements OnInit, OnDestroy {

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

  private subs = new Subscription();
  private search$ = new Subject<string>();

  constructor(
    private patientService: PatientService,
    private toastCtrl: ToastController,
    private router: Router,
    private modalCtrl: ModalController,
    private popoverCtrl: PopoverController
  ) {}

  ngOnInit(): void {
    this.setupSearchStream();
    this.loadPatients(true);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ================= SEARCH STREAM =================

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
            })
          );
        })
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
    const q = (this.searchText || '').trim();
    this.search$.next(q);
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

  // ================= DATA LOAD =================

  loadPatients(reset = false): void {
    if (reset) this.page = 1;

    this.fetchPatients().subscribe({
      next: (res) => {
        if (!res) return;
        const list = this.extractArray(res);
        this.rows = this.mapRows(list, this.page);
        this.updatePagination(res, list);
      },
      complete: () => (this.loading = false)
    });
  }

  private fetchPatients() {
    this.loading = true;

    return this.patientService
      .getPatients(this.page, this.pageSize)
      .pipe(
        catchError((err) => {
          this.handleError(err, 'Failed to load patients');
          return of(null);
        })
      );
  }

  // ================= PAGINATION =================

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

  // ================= ACTIONS =================

  async openActions(ev: Event, row: Row) {

    const popover = await this.popoverCtrl.create({
      component: PatientActionPopoverComponent,
      event: ev,
      translucent: true,
      componentProps: { patient: row }
    });

    await popover.present();
  }

  goToCreatePatient(): void {
    this.router.navigate(['/patients'], {
      queryParams: { q: this.searchText.trim() }
    });
  }

  // ================= HELPERS =================

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
    this.hasNext = pages > 0 ? this.page < pages : list.length === this.pageSize;
  }

  private mapRows(list: any[], page: number): Row[] {
    return list.map((p: any, idx: number) => ({
      srNo: (page - 1) * this.pageSize + idx + 1,
      id: p?.patientId ?? p?.id ?? 0,
      pid: p?.patientIdFormatted ?? p?.pid ?? '-',
      name: p?.fullName ?? 'NA',
      phone: p?.phoneNumber ?? '-',
      gender: p?.gender ?? 'NA',
      hasActiveAppointment: !!p?.hasActiveAppointment,
      raw: p
    }));
  }

  private async handleError(err: any, fallback: string) {
    const toast = await this.toastCtrl.create({
      message: err?.message || fallback,
      duration: 2500,
      position: 'top'
    });
    await toast.present();
  }
}