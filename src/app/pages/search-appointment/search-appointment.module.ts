import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { SearchAppointmentPage } from './search-appointment.page';

const routes: Routes = [{ path: '', component: SearchAppointmentPage }];

@NgModule({
  declarations: [SearchAppointmentPage],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes),
  ],
})
export class SearchAppointmentPageModule {}
