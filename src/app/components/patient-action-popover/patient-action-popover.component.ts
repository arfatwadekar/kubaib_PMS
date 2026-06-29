import { Component, Input, OnInit } from '@angular/core';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-patient-action-popover',
  templateUrl: './patient-action-popover.component.html',
  styleUrls: ['./patient-action-popover.component.scss'],
  standalone: false,
})
export class PatientActionPopoverComponent implements OnInit {

  @Input() patient: any;
 role = '';
  constructor(private popoverCtrl: PopoverController) {}

    ngOnInit(): void {
    this.role = localStorage.getItem('mhc_role') || '';
  }

  get canDelete(): boolean {
    return (this.role || '').toLowerCase() !== 'receptionist';
  }
  
  close(action: string) {
    this.popoverCtrl.dismiss({ action });
  }

  edit() {
    this.close('edit');
  }

  delete() {
    this.close('delete');
  }
  appointment() {
    this.close('appointment');
  }

  toggleStatus() {
    this.close('status');
  }
}