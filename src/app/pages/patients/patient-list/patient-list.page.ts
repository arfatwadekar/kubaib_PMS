import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController, ToastController } from '@ionic/angular';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

import { PatientService } from 'src/app/services/patient.service';
import { TableColumn } from 'src/app/components/table/table.component';
import { CreateAppointmentModalComponent } from 'src/app/components/create-appointment-modal/create-appointment-modal.component';

type Row = {
  srNo: number;
  id: number;     // can be 0 if backend doesn't send id, but row should still show
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

  // same semantics: indicates you are in "search mode"
  isSearching = false;

  // ✅ NEW: to control create button correctly (only after a search attempt)
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
    // ✅ typing search (debounce). Button search still works too.
    this.subs.add(
      this.search$
        .pipe(debounceTime(350), distinctUntilChanged())
        .subscribe((q) => this.searchNow(q))
    );

    // ✅ first load
    this.resetToListAndLoad();
  }

  ionViewWillEnter(): void {
    // ✅ optional: keep list fresh when returning
    // If you don't want reload on back, remove this line.
    if (!this.isSearching) this.resetToListAndLoad();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ✅ FIXED: create button only after a search was actually performed
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
  private resetToListAndLoad(): void {
    this.page = 1;
    this.searchText = '';
    this.isSearching = false;
    this.searchedOnce = false;
    this.loadList();
  }

  loadList(): void {
    this.loading = true;
    this.isSearching = false;   // ✅ list mode
    this.searchedOnce = false;  // ✅ not a search screen

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

  // ----------------------------
  // SEARCH (button + typing)
  // ----------------------------
  onSearchInput(): void {
    const q = (this.searchText || '').trim();

    // if user cleared input, go back to list automatically
    if (!q) {
      this.clearSearch();
      return;
    }

    this.search$.next(q);
  }

  search(): void {
    // Search button click
    this.searchNow((this.searchText || '').trim());
  }

  private searchNow(q: string): void {
    const query = (q || '').trim();

    if (!query) {
      this.clearSearch();
      return;
    }

    this.loading = true;
    this.isSearching = true;
    this.searchedOnce = true;

    this.patientService.searchPatients(query).subscribe({
      next: (res) => {
        const list = this.toArray(res);

        // search results -> single page view
        this.page = 1;
        this.rows = this.toRows(list, 1);

        this.totalCount = list.length;
        this.totalPages = 1;
        this.hasNext = false;
      },
      error: (err) => this.showToast(err, 'Search failed'),
      complete: () => (this.loading = false),
    });
  }

  clearSearch(): void {
    this.searchText = '';
    this.page = 1;
    this.isSearching = false;
    this.searchedOnce = false;
    this.loadList(); // ✅ back to GET listing + show table data
  }

  refresh(): void {
    // keep same behavior: refresh resets everything
    this.resetToListAndLoad();
  }

  // ----------------------------
  // PAGINATION (listing only)
  // ----------------------------
  nextPage(): void {
    if (this.loading || this.isSearching || !this.hasNext) return;
    this.page++;
    this.loadList();
  }

  prevPage(): void {
    if (this.loading || this.isSearching || this.page <= 1) return;
    this.page--;
    this.loadList();
  }

  // ----------------------------
  // NAV
  // ----------------------------
  goToCreatePatient(): void {
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
      // optional
      // if (!this.isSearching) this.loadList();
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

  // ✅ IMPORTANT FIX: don't drop rows if id not present
  private toRows(list: any[], page: number): Row[] {
    return (list || []).map((p: any, idx: number) => {
      // try multiple possible keys for id
      const id =
        Number(
          p?.patientsId ??
            p?.patientId ??
            p?.patientID ??
            p?.id ??
            0
        ) || 0;

      const pid = String(
        p?.pid ??
          p?.patientIdFormatted ??
          p?.patientIDFormatted ??
          p?.patientCode ??
          id ??
          ''
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
