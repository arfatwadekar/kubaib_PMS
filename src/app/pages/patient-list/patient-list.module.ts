import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { PatientListPage } from './patient-list.page';
import { TableModule } from 'src/app/components/table/table.module';
import { HeaderModule } from 'src/app/components/header/header.module';

import { CreateAppointmentModalModule } from 'src/app/components/create-appointment-modal/create-appointment-modal.module';

const routes: Routes = [{ path: '', component: PatientListPage }];

@NgModule({
  declarations: [PatientListPage],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule.forChild(routes),
    HeaderModule,
    TableModule,
    CreateAppointmentModalModule, // ✅ correct
  ],
})
export class PatientListPageModule {}
