import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { CreatePatientPage } from './create-patient.page';
import { PidSuccessPageModule } from '../pid-success/pid-success.module'; // ✅ add this

const routes: Routes = [{ path: '', component: CreatePatientPage }];

@NgModule({
  declarations: [CreatePatientPage],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    PidSuccessPageModule, // ✅
    RouterModule.forChild(routes),
  ],
})
export class CreatePatientPageModule {}
