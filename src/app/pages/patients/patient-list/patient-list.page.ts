import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, ModalController } from '@ionic/angular';

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
export class PatientListPage implements OnInit {
  loading = false;
  searchText = '';
  isSearching = false;

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

  constructor(
    private patientService: PatientService,
    private toastCtrl: ToastController,
    private router: Router,
    private modalCtrl: ModalController
  ) {}

  ngOnInit(): void {
    this.loadList();
  }

  get showCreatePatientBtn(): boolean {
    return this.isSearching && !this.loading && this.rows.length === 0;
  }

  // ----------------------------
  // LIST + SEARCH
  // ----------------------------
  loadList(): void {
    this.loading = true;
    this.isSearching = false;

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

  search(): void {
    const q = (this.searchText || '').trim();
    if (!q) {
      this.page = 1;
      this.loadList();
      return;
    }

    this.loading = true;
    this.isSearching = true;

    this.patientService.searchPatients(q).subscribe({
      next: (res) => {
        const list = this.toArray(res);
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
    this.loadList();
  }

  refresh(): void {
    this.page = 1;
    this.searchText = '';
    this.loadList();
  }

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

  goToCreatePatient(): void {
    this.router.navigate(['/patients/create'], {
      queryParams: { q: (this.searchText || '').trim() },
    });
  }

  // ----------------------------
  // ✅ OPEN MODAL (SEPARATE COMPONENT)
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
      // optional: refresh list or do nothing
      // this.loadList();
    }
  }

  // ----------------------------
  // HELPERS
  // ----------------------------
  private toArray(res: any): any[] {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  }

  private updatePager(res: any, list: any[]): void {
    const count = Number(res?.totalCount ?? res?.totalRecords ?? res?.count ?? 0) || 0;

    const pages =
      Number(res?.totalPages ?? 0) ||
      (count ? Math.ceil(count / this.pageSize) : 0);

    this.totalCount = count;
    this.totalPages = pages;
    this.hasNext = pages > 0 ? this.page < pages : (list?.length || 0) === this.pageSize;
  }

  private toRows(list: any[], page: number): Row[] {
    return (list || [])
      .map((p: any, idx: number) => {
        const id = Number(p?.patientsId ?? p?.patientId ?? p?.patientID ?? 0) || 0;

        const pid = String(p?.pid ?? p?.patientIdFormatted ?? p?.patientIDFormatted ?? '').trim();

        const fullName = String(p?.fullName ?? '').trim();
        const name =
          fullName ||
          `${String(p?.firstName ?? '').trim()} ${String(p?.lastName ?? '').trim()}`.trim() ||
          'NA';

        const phone = String(p?.phoneNumber ?? '').trim() || '-';

        return {
          srNo: (page - 1) * this.pageSize + idx + 1,
          id,
          pid: pid || String(id),
          name,
          phone,
          raw: p,
        };
      })
      .filter((r) => r.id > 0);
  }

  private async showToast(err: any, fallback: string): Promise<void> {
    const msg = err?.error?.message || err?.message || fallback;
    const t = await this.toastCtrl.create({
      message: msg,
      duration: 2500,
      position: 'top',
    });
    t.present();
  }
}
