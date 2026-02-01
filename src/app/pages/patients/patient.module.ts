import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { PatientPage } from './patient';

const routes: Routes = [
  {
    path: '',
    component: PatientPage,
  },
];

@NgModule({
  declarations: [PatientPage],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,     // ✅ THIS FIXES ngModel
    RouterModule.forChild(routes),
  ],
})
export class PatientPageModule {}
