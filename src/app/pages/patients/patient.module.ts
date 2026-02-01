import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { PatientPage } from './patient';

const routes: Routes = [{ path: '', component: PatientPage }];

@NgModule({
  declarations: [PatientPage],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,           // ✅ (ngModel/segment ke liye safe)
    ReactiveFormsModule,   // ✅ REQUIRED for [formGroup], formControlName
    RouterModule.forChild(routes),
  ],
})
export class PatientPageModule {}
