import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { CreateAppointmentModalComponent } from './create-appointment-modal.component';

@NgModule({
  declarations: [CreateAppointmentModalComponent],
  imports: [
    CommonModule,
    IonicModule,            // ✅ ion-* tags
    ReactiveFormsModule,    // ✅ formGroup/formControlName
     FormsModule,

  ],
  exports: [CreateAppointmentModalComponent],
})
export class CreateAppointmentModalModule {}
