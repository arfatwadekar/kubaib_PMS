import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
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
  gender: string;
  status: 'Active' | 'Deactive';
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

  // ---------------- STATE ----------------
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

  // ---------------- TABLE ----------------
  columns: TableColumn[] = [
    { key: 'srNo', label: 'Sr', width: '50px', align: 'center' },
    { key: 'pid', label: 'Patient ID', width: '120px' },
    { key: 'name', label: 'Patient Name' },
    { key: 'phone', label: 'Phone Number', width: '130px' },
    { key: 'gender', label: 'Gender', width: '100px', align: 'center' },
    { key: 'status', label: 'Status', width: '120px', align: 'center' },
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

  // ============================================================
  // LIFECYCLE
  // ============================================================

  ngOnInit(): void {
    this.setupSearchStream();
    this.loadPatients(true);
  }

  ionViewWillEnter(): void {
    this.loadPatients(true);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ============================================================
  // SEARCH STREAM
  // ============================================================

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

        let list = this.extractArray(res);

        // Exact match first
        if (this.isSearching && this.searchText.trim()) {
          const q = this.searchText.trim().toLowerCase();

          list = list.sort((a: any, b: any) => {
            const aExact =
              a?.patientIdFormatted?.toLowerCase() === q ||
              a?.phoneNumber === q;

            const bExact =
              b?.patientIdFormatted?.toLowerCase() === q ||
              b?.phoneNumber === q;

            return Number(bExact) - Number(aExact);
          });
        }

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

  // ============================================================
  // DATA LOAD
  // ============================================================

  loadPatients(reset = false): void {
    if (reset) this.page = 1;

    this.isSearching = false;
    this.searchedOnce = false;

    this.fetchPatients().subscribe({
      next: (res) => {
        if (!res) return;

        const list = this.extractArray(res);
        this.rows = this.mapRows(list, this.page);
        this.updatePagination(res, list);
      },
      error: () => this.handleError(null, 'Failed to load patients'),
      complete: () => (this.loading = false),
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

  // ============================================================
  // SEARCH HANDLERS
  // ============================================================

  onSearchInput(): void {
    this.search$.next(this.searchText || '');
  }

  search(): void {
    this.search$.next(this.searchText || '');
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
      this.searchText.trim().length > 0
    );
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  nextPage(): void {
    if (this.loading || this.isSearching || !this.hasNext) return;
    this.page++;
    this.loadPatients(false);
  }

  prevPage(): void {
    if (this.loading || this.isSearching || this.page <= 1) return;
    this.page--;
    this.loadPatients(false);
  }

  refresh(): void {
    this.searchText = '';
    this.loadPatients(true);
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  editPatient(row: Row, ev?: Event): void {
    ev?.stopPropagation();
    this.router.navigate(['/patients'], {
      queryParams: { patientId: row.id, tab: 'prelim' },
    });
  }

  async openApptModal(row: Row, ev?: Event) {
    ev?.stopPropagation();

    const modal = await this.modalCtrl.create({
      component: CreateAppointmentModalComponent,
      componentProps: {
        patient: {
          id: row.id,
          pid: row.pid,
          name: row.name,
          phone: row.phone,
        },
        mode: row.hasActiveAppointment ? 'edit' : 'create',
      },
      backdropDismiss: false,
    });

    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'success') {
      this.isSearching ? this.search() : this.loadPatients(false);
    }
  }

  goToCreatePatient(): void {
    this.router.navigate(['/patients'], {
      queryParams: { q: this.searchText.trim() },
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private extractArray(res: any): any[] {
    if (Array.isArray(res)) return res;
    return res?.items || res?.data || res?.result || res?.patients || [];
  }

  private updatePagination(res: any, list: any[]): void {
    const count =
      Number(res?.totalCount ?? res?.totalRecords ?? 0) || 0;

    const pages =
      Number(res?.totalPages ?? 0) ||
      (count ? Math.ceil(count / this.pageSize) : 0);

    this.totalCount = count;
    this.totalPages = pages;
    this.hasNext = pages > 0 ? this.page < pages : list.length === this.pageSize;
  }

  private mapRows(list: any[], page: number): Row[] {
    return list.map((p: any, idx: number) => {
      const id = Number(p?.patientsId ?? p?.patientId ?? p?.id ?? 0) || 0;

      const pid =
        p?.patientIdFormatted ??
        p?.pid ??
        id ??
        '-';

      const name =
        p?.fullName ||
        `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() ||
        'NA';

      return {
        srNo: (page - 1) * this.pageSize + idx + 1,
        id,
        pid: String(pid),
        name,
        phone: p?.phoneNumber || '-',
        gender: p?.gender || 'NA',
        status: p?.isActive === false ? 'Deactive' : 'Active',
        hasActiveAppointment: !!p?.hasActiveAppointment,
        raw: p,
      };
    });
  }

  private async handleError(err: any, fallback: string) {
    const message = err?.error?.message || err?.message || fallback;

    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
    });

    await toast.present();
  }
}