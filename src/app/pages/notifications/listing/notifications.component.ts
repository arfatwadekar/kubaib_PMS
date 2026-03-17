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
isDoctor = false;
  notifications: Notification[] = [];
  unreadCount = 0;
  loading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private alertController: AlertController
  ) {}

  // ==========================
  // INIT
  // ==========================
  // ngOnInit(): void {

  //   this.loadNotifications();

  //   // Listen to real-time updates from service
  //   this.notificationService.notifications$
  //     .pipe(takeUntil(this.destroy$))
  //     .subscribe((data: Notification[]) => {

  //       this.notifications = data.sort(
  //         (a, b) =>
  //           new Date(b.createdOn).getTime() -
  //           new Date(a.createdOn).getTime()
  //       );

  //       this.unreadCount = this.notifications.filter(n => !n.isRead).length;
  //     });
  // }
  

  ngOnInit(): void {

  // Check user role
  const role = localStorage.getItem('mhc_role');
  this.isDoctor = role === 'Doctor';

  // Load initial notifications
  this.loadNotifications();

  // Listen to realtime notification updates
  this.notificationService.notifications$
    .pipe(takeUntil(this.destroy$))
    .subscribe((data: Notification[]) => {

      if (!data) return;

      // Sort latest first
      this.notifications = [...data].sort(
        (a, b) =>
          new Date(b.createdOn).getTime() -
          new Date(a.createdOn).getTime()
      );

      // Calculate unread count
      this.unreadCount = this.notifications
        .filter(n => !n.isRead)
        .length;
    });

     this.notificationService.notifications$.subscribe(data => {
    this.unreadCount = data.filter(n => !n.isRead).length;
  });
}


openNotifications() {
  console.log('Already on notifications page');
}

  // ==========================
  // LOAD INITIAL DATA
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
          this.unreadCount--;
        },
        error: (err) => {
          console.error('Mark Read Error:', err);
        }
      });
  }

  // ==========================
  // DELETE NOTIFICATION
  // ==========================
  // deleteNotification(notification: Notification, event?: Event): void {

  //   event?.stopPropagation();

  //   if (!notification.webNotificationId) return;

  //   // Show confirmation dialog
  //   this.showDeleteConfirmation(notification);
  // }

  /**
   * Show Ionic alert dialog for delete confirmation
   */
  private async showDeleteConfirmation(notification: Notification): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Delete Notification',
      message: `Are you sure you want to delete the notification from <strong>${notification.name}</strong>?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            console.log('Delete cancelled');
          }
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.confirmDelete(notification);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Perform the actual deletion
   */
  private confirmDelete(notification: Notification): void {

    notification.isDeleting = true;

    this.notificationService
      .deleteNotification(notification.webNotificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Remove from local array
          this.notifications = this.notifications.filter(
            n => n.webNotificationId !== notification.webNotificationId
          );

          // Update unread count
          this.unreadCount = this.notifications.filter(n => !n.isRead).length;

          console.log('Notification deleted successfully');
        },
        error: (err) => {
          console.error('Delete Error:', err);
          notification.isDeleting = false;

          // Show error alert
          this.showErrorAlert('Failed to delete notification. Please try again.');
        }
      });
  }

  /**
   * Show error alert
   */
  private async showErrorAlert(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Error',
      message: message,
      buttons: ['OK']
    });

    await alert.present();
  }

  // ==========================
  // OPEN DETAIL
  // ==========================
  openDetail(notification: Notification): void {

    if (!notification.webNotificationId) return;

    this.router.navigate([
      '/notifications',
      notification.webNotificationId
    ]);
  }

  // ==========================
  // MANUAL REFRESH
  // ==========================
  refresh(): void {
    this.loadNotifications();
  }

  // ==========================
  // CLEANUP
  // ==========================
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  deleteNotification(notification: Notification, event?: Event): void {

  event?.stopPropagation();

  if (!this.isDoctor) {
    console.warn('Only doctor can delete notifications');
    return;
  }

  if (!notification.webNotificationId) return;

  this.showDeleteConfirmation(notification);
}
}