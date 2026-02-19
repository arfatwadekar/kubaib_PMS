import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { MedicalPage } from './medical.page';

const routes: Routes = [
  {
    path: '',
    component: MedicalPage
  }
];

@NgModule({
  declarations: [MedicalPage],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,          // ✅ Needed for ngModel (if used anywhere)
    ReactiveFormsModule,  // ✅ REQUIRED for [formGroup]
    RouterModule.forChild(routes)
  ]
})
export class MedicalPageModule {}