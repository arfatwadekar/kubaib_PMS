import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { IonPopover } from '@ionic/angular';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: false
})
export class HeaderComponent {

  @Input() title = '';
  @Input() showBack = false;

  @Input() actionIcon?: string;
  @Input() actionLabel?: string;

  @Input() showProfile = false;
  @Input() profileRole?: string;
  @Input() profileInitial?: string;

  // ========== NOTIFICATION INPUTS ==========
  @Input() showNotification = false;
  @Input() notificationCount = 0;
  @Input() notificationIcon = 'notifications-outline';

  @Output() action = new EventEmitter<void>();
  @Output() editProfile = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() notificationClick = new EventEmitter<void>();

  @ViewChild('popover') popover!: IonPopover;
// @Input() notificationCount = 0;

// @Output() notificationClick = new EventEmitter<void>();
  profileOpen = false;
  profileEvent: any;

  // ================= PROFILE DATA =================

  get resolvedRole(): string {
    return (
      this.profileRole ||
      localStorage.getItem('mhc_role') ||
      'Doctor'
    );
  }

  get resolvedInitial(): string {
    const name =
      this.profileInitial ||
      localStorage.getItem('mhc_user_name') ||
      this.resolvedRole ||
      'U';

    return name.substring(0, 1).toUpperCase();
  }

  // ================= ACTION BUTTON =================

  onActionClick() {
    this.action.emit();
  }

  // ================= NOTIFICATION =================

  // onNotificationClick() {
  //   this.notificationClick.emit();
  // }

  // Clear notification count programmatically (optional)
  clearNotifications() {
    this.notificationCount = 0;
  }

  // Update notification count
  setNotificationCount(count: number) {
    this.notificationCount = count;
  }

  // ================= POPOVER =================

  openProfilePopover(ev: any) {
    this.profileEvent = ev;
    this.profileOpen = true;
  }

  closePopover() {
    this.profileOpen = false;
    if (this.popover) {
      this.popover.dismiss();
    }
  }

  onEditProfile() {
    this.closePopover();
    this.editProfile.emit();
  }

  onLogout() {
    this.closePopover();
    this.logout.emit();
  }

  onNotificationClick() {
  this.notificationClick.emit();
}
}