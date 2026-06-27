import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import {
  OtcMedicine,
  OtcMedicineService,
} from 'src/app/services/otc-medicine.service';

import { AlertController, ToastController } from '@ionic/angular';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-otc-medicine-listing',
  templateUrl: './listing.html',
  styleUrls: ['./listing.scss'],
  standalone: false,
})
export class ListingPage implements OnInit, OnDestroy {
  otcMedicines: OtcMedicine[] = [];

  search = '';
  loading = false;
  errorMessage = '';

  unreadCount = 0;
  notifications: any[] = [];
  
  allMedicines: OtcMedicine[] = [];

currentPage = 1;
pageSize = 10;

  private destroy$ = new Subject<void>();
  private searchTrigger$ = new Subject<string>();

  

  constructor(
    private otcMedicineService: OtcMedicineService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.initializeSearchListener();
    this.loadData();
    this.loadNotifications();
  }

  ionViewWillEnter(): void {
    this.loadData();
  }

  private initializeSearchListener(): void {
    this.searchTrigger$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadData();
      });
  }

  onSearchChange(): void {
    this.searchTrigger$.next(this.search);
  }

  // loadData(): void {
  //   this.loading = true;
  //   this.errorMessage = '';

  //   this.otcMedicineService
  //     .getAll(this.search)
  //     .pipe(takeUntil(this.destroy$))
  //     .subscribe({
  //       next: (res) => {
  //         this.otcMedicines = res || [];
  //         this.loading = false;
  //       },
  //       error: () => {
  //         this.errorMessage = 'Failed to load OTC medicines.';
  //         this.loading = false;
  //       },
  //     });
  // }

  loadData(): void {
  this.loading = true;
  this.errorMessage = '';

  this.otcMedicineService
    .getAll(this.search)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res) => {
        this.allMedicines = res || [];
        this.currentPage = 1;
        this.updatePagination();
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load OTC medicines.';
        this.loading = false;
      },
    });
}

updatePagination(): void {
  const start = (this.currentPage - 1) * this.pageSize;
  const end = start + this.pageSize;

  this.otcMedicines = this.allMedicines.slice(start, end);
}

get totalPages(): number {
  return Math.ceil(this.allMedicines.length / this.pageSize);
}

get pages(): number[] {
  return Array.from({ length: this.totalPages }, (_, i) => i + 1);
}

previousPage(): void {
  if (this.currentPage > 1) {
    this.currentPage--;
    this.updatePagination();
  }
}

nextPage(): void {
  if (this.currentPage < this.totalPages) {
    this.currentPage++;
    this.updatePagination();
  }
}

goToPage(page: number): void {
  this.currentPage = page;
  this.updatePagination();
}

  refresh(): void {
    this.search = '';
    this.loadData();
  }

  create(): void {
    this.router.navigate(['/otc-medicine/create']);
  }

  view(id: string): void {
    this.router.navigate(['/otc-medicine/view', id]);
  }

  edit(id: string): void {
    this.router.navigate(['/otc-medicine/edit', id]);
  }

  async delete(id: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this OTC medicine record?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.performDelete(id),
        },
      ],
    });

    await alert.present();
  }

  private performDelete(id: string): void {
    this.otcMedicineService
      .delete(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          await this.showToast('OTC medicine deleted successfully.', 'success');
          this.loadData();
        },
        error: async () => {
          await this.showToast('Failed to delete OTC medicine.', 'danger');
        },
      });
  }

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top',
    });

    await toast.present();
  }

  async loadNotifications() {
    const res: any = await this.notificationService
      .getNotifications()
      .toPromise();

    this.notifications = res || [];

    this.unreadCount = this.notifications.filter((x) => !x.isRead).length;
  }

  openNotifications() {
    this.router.navigate(['/notifications']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
