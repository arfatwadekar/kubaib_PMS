import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { PatientActionPopoverComponent } from './patient-action-popover.component';

@NgModule({
  declarations: [PatientActionPopoverComponent],
  imports: [
    CommonModule,
    IonicModule
  ],
  exports: [PatientActionPopoverComponent]
})
export class PatientActionPopoverModule {}