import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { Notification } from 'src/app/models/notification.model';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-notifications-listing',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  standalone: false
})
export class ListingComponent implements OnInit, OnDestroy {

  // ==========================
  // STATE
  // ==========================
  isDoctor = false;
  loading = false;

  notifications: Notification[] = [];      // paginated data
  allNotifications: Notification[] = [];   // full data

  unreadCount = 0;

  // ==========================
  // PAGINATION
  // ==========================
  page = 1;
  pageSize = 10;
  totalPages = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private alertController: AlertController
  ) {}

  // ==========================
  // INIT
  // ==========================
  ngOnInit(): void {

    // Role check
    const role = localStorage.getItem('mhc_role');
    this.isDoctor = role === 'Doctor';

    // Load initial data
    this.loadNotifications();

    // Subscribe to realtime updates (ONLY ONCE ✅)
    this.notificationService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: Notification[]) => {

        if (!data) return;

        // Sort latest first
        this.allNotifications = [...data].sort(
          (a, b) =>
            new Date(b.createdOn).getTime() -
            new Date(a.createdOn).getTime()
        );

        // Pagination calc
        this.totalPages = Math.ceil(
          this.allNotifications.length / this.pageSize
        );

        // Fix page overflow (edge case)
        if (this.page > this.totalPages) {
          this.page = this.totalPages || 1;
        }

        // Apply pagination
        this.updatePagedData();

        // Unread count
        this.unreadCount = this.allNotifications.filter(
          n => !n.isRead
        ).length;
      });
  }

  // ==========================
  // LOAD DATA
  // ==========================
  loadNotifications(): void {

    this.loading = true;

    this.notificationService.fetchAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: Notification[]) => {
          this.notificationService.setNotifications(data);
          this.loading = false;
        },
        error: (err) => {
          console.error('Notification Load Error:', err);
          this.loading = false;
        }
      });
  }

  // ==========================
  // PAGINATION LOGIC
  // ==========================
  updatePagedData(): void {

    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;

    this.notifications = this.allNotifications.slice(start, end);
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.updatePagedData();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.updatePagedData();
    }
  }

  // ==========================
  // MARK AS READ
  // ==========================
  markAsRead(notification: Notification, event?: Event): void {

    event?.stopPropagation();

    if (!notification.webNotificationId || notification.isRead) return;

    this.notificationService
      .markAsRead(notification.webNotificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {

          notification.isRead = true;

          // Update global data
          const item = this.allNotifications.find(
            n => n.webNotificationId === notification.webNotificationId
          );

          if (item) item.isRead = true;

          this.unreadCount--;
        },
        error: (err) => {
          console.error('Mark Read Error:', err);
        }
      });
  }

  // ==========================
  // DELETE (ENTRY POINT)
  // ==========================
  deleteNotification(notification: Notification, event?: Event): void {

    event?.stopPropagation();

    if (!this.isDoctor) {
      console.warn('Only doctor can delete notifications');
      return;
    }

    if (!notification.webNotificationId) return;

    this.showDeleteConfirmation(notification);
  }

  // ==========================
  // CONFIRMATION DIALOG
  // ==========================
  private async showDeleteConfirmation(notification: Notification): Promise<void> {

    const alert = await this.alertController.create({
      header: 'Delete Notification',
      message: `Are you sure you want to delete the notification from <strong>${notification.name}</strong>?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.confirmDelete(notification)
        }
      ]
    });

    await alert.present();
  }

  // ==========================
  // DELETE LOGIC
  // ==========================
  private confirmDelete(notification: Notification): void {

    notification.isDeleting = true;

    this.notificationService
      .deleteNotification(notification.webNotificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {

          // Remove from master list
          this.allNotifications = this.allNotifications.filter(
            n => n.webNotificationId !== notification.webNotificationId
          );

          // Recalculate pagination
          this.totalPages = Math.ceil(
            this.allNotifications.length / this.pageSize
          );

          if (this.page > this.totalPages) {
            this.page = this.totalPages || 1;
          }

          this.updatePagedData();

          // Update unread count
          this.unreadCount = this.allNotifications.filter(
            n => !n.isRead
          ).length;

          console.log('Notification deleted');
        },
        error: (err) => {
          console.error('Delete Error:', err);
          notification.isDeleting = false;
          this.showErrorAlert('Failed to delete notification.');
        }
      });
  }

  // ==========================
  // ERROR ALERT
  // ==========================
  private async showErrorAlert(message: string): Promise<void> {

    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK']
    });

    await alert.present();
  }

  // ==========================
  // NAVIGATION
  // ==========================
  openDetail(notification: Notification): void {

    if (!notification.webNotificationId) return;

    this.router.navigate([
      '/notifications',
      notification.webNotificationId
    ]);
  }

  openNotifications(): void {
    console.log('Already on notifications page');
  }

  // ==========================
  // REFRESH
  // ==========================
  refresh(): void {
    this.page = 1;
    this.loadNotifications();
  }

  // ==========================
  // CLEANUP
  // ==========================
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}