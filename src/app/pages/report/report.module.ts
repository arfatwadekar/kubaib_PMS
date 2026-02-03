import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ReportPage } from './report';

const routes: Routes = [
  {
    path: '',
    component: ReportPage,
  },
];

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule, // ✅ IMPORTANT
    RouterModule.forChild(routes),
  ],
  declarations: [ReportPage],
})
export class ReportPageModule {}
