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
  standalone:false
})
export class HeaderComponent {

  @Input() title = '';
  @Input() showBack = false;

  @Input() actionIcon?: string;
  @Input() actionLabel?: string;

  @Input() showProfile = false;
  @Input() profileRole?: string;
  @Input() profileInitial?: string;

  @Output() action = new EventEmitter<void>();
  @Output() editProfile = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  @ViewChild('popover') popover!: IonPopover;

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
}
