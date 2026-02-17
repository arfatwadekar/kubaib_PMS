import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { Notification } from 'src/app/models/notification.model';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-notifications-listing',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  standalone: false
})
export class ListingComponent implements OnInit, OnDestroy {

  notifications: Notification[] = [];
  unreadCount = 0;
  loading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private notificationService: NotificationService,
    private router: Router
  ) {}

  // ==========================
  // INIT
  // ==========================
  ngOnInit(): void {

    this.loadNotifications();

    // Listen to real-time updates from service
    this.notificationService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: Notification[]) => {

        this.notifications = data.sort(
          (a, b) =>
            new Date(b.createdOn).getTime() -
            new Date(a.createdOn).getTime()
        );

        this.unreadCount = this.notifications.filter(n => !n.isRead).length;
      });
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
}
