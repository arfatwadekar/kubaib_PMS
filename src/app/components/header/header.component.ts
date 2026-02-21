import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: false,
})
export class HeaderComponent {
  /** Page title shown in the center/left */
  @Input() title = '';

  /** Show a back button instead of menu button */
  @Input() showBack = false;

  /** Optional right side action button */
  @Input() actionIcon?: string;
  @Input() actionLabel?: string;

  /** Emits when right action button is clicked */
  @Output() action = new EventEmitter<void>();

  onActionClick() {
    this.action.emit();
  }
}
