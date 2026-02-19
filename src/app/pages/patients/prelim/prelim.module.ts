import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { PrelimPage } from './prelim.page';

const routes: Routes = [
  {
    path: '',
    component: PrelimPage
  }
];

@NgModule({
  declarations: [PrelimPage],
  imports: [
    CommonModule,
    FormsModule,              // ✅ for ngModel (if used)
    ReactiveFormsModule,      // ✅ REQUIRED for formGroup
    IonicModule,
    RouterModule.forChild(routes)
  ]
})
export class PrelimPageModule {}