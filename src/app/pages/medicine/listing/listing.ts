import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  takeUntil
} from 'rxjs';
import {
  Medicine,
  MedicineService,
  MedicineListResponse
} from 'src/app/services/medicine.service';
import { AlertController, ToastController } from '@ionic/angular';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-medicine-listing',
  templateUrl: './listing.html',
  styleUrls: ['./listing.scss'],
  standalone: false
})
export class ListingPage implements OnInit, OnDestroy {

  medicines: Medicine[] = [];

  page = 1;
  pageSize = 5;
  totalCount = 0;
  totalPages = 0;

  search = '';
  loading = false;
  errorMessage = '';

  pageNumbers: number[] = [];

  private destroy$ = new Subject<void>();
  private searchTrigger$ = new Subject<string>();

  constructor(
    private medicineService: MedicineService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
     private notificationService: NotificationService,
  ) {}

  // ================= INIT =================

  ngOnInit(): void {
    this.initializeSearchListener();
    this.loadMedicines();
       this.loadNotifications();
  }


  ionViewWillEnter(): void {
  this.loadMedicines();   // 👈 IMPORTANT FIX
}
  // ================= SEARCH =================

  private initializeSearchListener(): void {
    this.searchTrigger$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.page = 1;
        this.loadMedicines();
      });
  }

  onSearchChange(): void {
    this.searchTrigger$.next(this.search);
  }

  // ================= LOAD =================

  loadMedicines(): void {

    this.loading = true;
    this.errorMessage = '';

    this.medicineService
      .getAll(this.page, this.pageSize, this.search)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: MedicineListResponse) => {

          if (res?.success && res?.data) {
            this.medicines = res.data.items ?? [];
            this.totalCount = res.data.totalCount ?? 0;
            this.totalPages = res.data.totalPages ?? 0;
            this.buildPageNumbers();
          } else {
            this.resetData();
          }

          this.loading = false;
        },
        error: () => {
          this.resetData();
          this.errorMessage = 'Failed to load medicines.';
          this.loading = false;
        }
      });
  }

  private resetData(): void {
    this.medicines = [];
    this.totalCount = 0;
    this.totalPages = 0;
    this.pageNumbers = [];
  }

  // ================= PAGINATION =================

private buildPageNumbers(): void {

  const maxVisible = 5; // pages around current
  const pages: number[] = [];

  if (this.totalPages <= 7) {
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
  } else {

    const start = Math.max(2, this.page - maxVisible);
    const end = Math.min(this.totalPages - 1, this.page + maxVisible);

    pages.push(1);

    if (start > 2) {
      pages.push(-1); // left ellipsis
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < this.totalPages - 1) {
      pages.push(-2); // right ellipsis
    }

    pages.push(this.totalPages);
  }

  this.pageNumbers = pages;
}


  goToPage(p: number): void {
    if (p === this.page || p < 1 || p > this.totalPages) return;
    this.page = p;
    this.loadMedicines();
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.loadMedicines();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadMedicines();
    }
  }

  // ================= REFRESH =================

  refresh(): void {
    this.search = '';
    this.page = 1;
    this.loadMedicines();
  }

  // ================= NAVIGATION =================

  create(): void {
    this.router.navigate(['/medicines/create']);
  }

  edit(id: number): void {
    this.router.navigate(['/medicines/edit', id]);
  }

  view(id: number): void {
    this.router.navigate(['/medicines/view', id]);
  }

  // ================= DELETE =================

  async delete(id: number): Promise<void> {

    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this medicine?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.performDelete(id)
        }
      ]
    });

    await alert.present();
  }

  private performDelete(id: number): void {

    this.loading = true;

    this.medicineService.delete(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          await this.showToast('Medicine deleted successfully.', 'success');
          this.loadMedicines();
        },
        error: async () => {
          this.loading = false;
          await this.showToast('Failed to delete medicine.', 'danger');
        }
      });
  }

  // ================= TOAST =================

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });
    await toast.present();
  }

  // ================= CLEANUP =================

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

    unreadCount = 0;
notifications: any[] = [];
async loadNotifications() {
  const res: any = await this.notificationService.getNotifications().toPromise();

  this.notifications = res || [];

  this.unreadCount = this.notifications.filter(n => !n.isRead).length;
}

openNotifications() {
  this.router.navigate(['/notifications']);
}
}