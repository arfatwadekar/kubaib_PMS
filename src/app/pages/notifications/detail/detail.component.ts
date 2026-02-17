import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from 'src/app/services/notification.service';
import { Notification } from 'src/app/models/notification.model';

@Component({
  selector: 'app-notification-detail',
  templateUrl: './detail.component.html',
  styleUrls: ['./detail.component.scss'],
  standalone: false
})
export class DetailComponent implements OnInit {

  notification?: Notification;
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {

    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);

    if (!id) {
      this.router.navigate(['/notifications']);
      return;
    }

    this.loading = true;

    // Subscribe to reactive store
    this.notificationService.notifications$
      .subscribe(data => {

        this.notification = data.find(
          n => n.webNotificationId === id
        );

        if (this.notification && !this.notification.isRead) {
          this.markAsRead(id);
        }

        this.loading = false;
      });

    // If store empty → fetch
    this.notificationService.fetchAll().subscribe();
  }

  private markAsRead(id: number) {

    this.notificationService
      .markAsRead(id)
      .subscribe();
  }
}
