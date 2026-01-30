import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { MedicalExaminationPage } from './medical-examination.page';

const routes: Routes = [
  {
    path: '',
    component: MedicalExaminationPage,
  },
];

@NgModule({
  declarations: [MedicalExaminationPage],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
  ],
})
export class MedicalExaminationPageModule {}
