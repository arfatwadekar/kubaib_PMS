import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController, ToastController } from '@ionic/angular';
import {
  Subject,
  Subscription,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  catchError,
} from 'rxjs';

import { PatientService } from 'src/app/services/patient.service';
import { TableColumn } from 'src/app/components/table/table.component';
import { CreateAppointmentModalComponent } from 'src/app/components/create-appointment-modal/create-appointment-modal.component';

type Row = {
  srNo: number;
  id: number;
  pid: string;
  name: string;
  phone: string;
  raw: any;
};

@Component({
  selector: 'app-patient-listing',
  templateUrl: './patient-list.page.html',
  styleUrls: ['./patient-list.page.scss'],
  standalone: false,
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

  columns: TableColumn[] = [
    { key: 'srNo', label: 'Sr', width: '60px', align: 'center' },
    { key: 'pid', label: 'Patient ID', width: '140px' },
    { key: 'name', label: 'Patient Name' },
    { key: 'phone', label: 'Phone Number', width: '150px' },
    { key: 'actions', label: 'Action', width: '180px', align: 'end' },
  ];

  private subs = new Subscription();
  private search$ = new Subject<string>();

  constructor(
    private patientService: PatientService,
    private toastCtrl: ToastController,
    private router: Router,
    private modalCtrl: ModalController
  ) {}

  ngOnInit(): void {
    // ✅ typing search – cancels previous request automatically
    this.subs.add(
      this.search$
        .pipe(
          debounceTime(350),
          distinctUntilChanged(),
          switchMap((q) => {
            const query = (q || '').trim();

            // If empty -> fallback to listing
            if (!query) {
              this.isSearching = false;
              this.searchedOnce = false;
              this.page = 1;
              this.loading = true;
              return this.patientService.getPatients(this.page, this.pageSize).pipe(
                catchError((err) => {
                  this.showToast(err, 'Failed to load patients');
                  return of(null);
                })
              );
            }

            // Search mode
            this.isSearching = true;
            this.searchedOnce = true;
            this.loading = true;

            return this.patientService.searchPatients(query).pipe(
              catchError((err) => {
                this.showToast(err, 'Search failed');
                return of(null);
              })
            );
          })
        )
        .subscribe((res) => {
          if (res == null) {
            this.loading = false;
            return;
          }

          const list = this.toArray(res);

          if (this.isSearching) {
            // search result view
            this.page = 1;
            this.rows = this.toRows(list, 1);
            this.totalCount = list.length;
            this.totalPages = 1;
            this.hasNext = false;
          } else {
            // listing view
            this.rows = this.toRows(list, this.page);
            this.updatePager(res, list);
          }

          this.loading = false;
        })
    );

    // ✅ first load listing
    this.loadList(true);
  }

  // ✅ When page becomes active, just refresh listing if NOT searching
  ionViewWillEnter(): void {
    if (!this.isSearching) {
      this.loadList(true);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
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

  // ----------------------------
  // LIST
  // ----------------------------
  loadList(resetPage = false): void {
    if (resetPage) this.page = 1;

    this.loading = true;
    this.isSearching = false;
    this.searchedOnce = false;

    this.patientService.getPatients(this.page, this.pageSize).subscribe({
      next: (res) => {
        const list = this.toArray(res);
        this.rows = this.toRows(list, this.page);
        this.updatePager(res, list);
      },
      error: (err) => this.showToast(err, 'Failed to load patients'),
      complete: () => (this.loading = false),
    });
  }

  refresh(): void {
    this.searchText = '';
    this.isSearching = false;
    this.searchedOnce = false;
    this.loadList(true);
  }

  // ----------------------------
  // SEARCH
  // ----------------------------
  onSearchInput(): void {
    this.search$.next(this.searchText || '');
  }

  search(): void {
    // manual trigger (button / enter)
    this.search$.next(this.searchText || '');
  }

  clearSearch(): void {
    this.searchText = '';
    // push empty => auto listing load from stream
    this.search$.next('');
  }

  // ----------------------------
  // PAGINATION (listing only)
  // ----------------------------
  nextPage(): void {
    if (this.loading || this.isSearching || !this.hasNext) return;
    this.page++;
    this.loadList(false);
  }

  prevPage(): void {
    if (this.loading || this.isSearching || this.page <= 1) return;
    this.page--;
    this.loadList(false);
  }

  // ----------------------------
  // NAV
  // ----------------------------
  goToCreatePatient(): void {
    // ✅ blank create page (no patientId)
    this.router.navigate(['/patients/create'], {
      queryParams: { q: (this.searchText || '').trim() },
    });
  }

  // ----------------------------
  // MODAL
  // ----------------------------
  async openApptModal(r: Row, ev?: Event) {
    ev?.stopPropagation();

    const modal = await this.modalCtrl.create({
      component: CreateAppointmentModalComponent,
      componentProps: {
        patient: {
          id: r.id,
          pid: r.pid,
          name: r.name,
          phone: r.phone,
        },
      },
      cssClass: 'mhc-appt-modal',
      backdropDismiss: false,
    });

    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'success') {
      // optional refresh listing
      // if (!this.isSearching) this.loadList(false);
    }
  }

  // ----------------------------
  // HELPERS
  // ----------------------------
  private toArray(res: any): any[] {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.result)) return res.result;
    return [];
  }

  private updatePager(res: any, list: any[]): void {
    const count =
      Number(res?.totalCount ?? res?.totalRecords ?? res?.count ?? 0) || 0;

    const pages =
      Number(res?.totalPages ?? 0) ||
      (count ? Math.ceil(count / this.pageSize) : 0);

    this.totalCount = count;
    this.totalPages = pages;

    this.hasNext =
      pages > 0 ? this.page < pages : (list?.length || 0) === this.pageSize;
  }

  private toRows(list: any[], page: number): Row[] {
    return (list || []).map((p: any, idx: number) => {
      const id =
        Number(p?.patientsId ?? p?.patientId ?? p?.patientID ?? p?.id ?? 0) || 0;

      const pid = String(
        p?.pid ??
          p?.patientIdFormatted ??
          p?.patientIDFormatted ??
          p?.patientCode ??
          (id ? id : '')
      ).trim();

      const fullName = String(p?.fullName ?? '').trim();
      const name =
        fullName ||
        `${String(p?.firstName ?? '').trim()} ${String(p?.lastName ?? '').trim()}`.trim() ||
        'NA';

      const phone =
        String(p?.phoneNumber ?? p?.mobile ?? p?.phone ?? '').trim() || '-';

      return {
        srNo: (page - 1) * this.pageSize + idx + 1,
        id,
        pid: pid || '-',
        name,
        phone,
        raw: p,
      };
    });
  }

  private async showToast(err: any, fallback: string): Promise<void> {
    const msg = err?.error?.message || err?.message || fallback;
    const t = await this.toastCtrl.create({
      message: msg,
      duration: 2500,
      position: 'top',
    });
    await t.present();
  }
}
