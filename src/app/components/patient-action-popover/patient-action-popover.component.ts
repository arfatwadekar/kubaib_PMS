import { Component, Input } from '@angular/core';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-patient-action-popover',
  templateUrl: './patient-action-popover.component.html',
  styleUrls: ['./patient-action-popover.component.scss']
})
export class PatientActionPopoverComponent {

  @Input() patient: any;

  constructor(private popoverCtrl: PopoverController) {}

  close(action: string) {
    this.popoverCtrl.dismiss({ action });
  }

  edit() {
    this.close('edit');
  }

  appointment() {
    this.close('appointment');
  }

  toggleStatus() {
    this.close('status');
  }
}