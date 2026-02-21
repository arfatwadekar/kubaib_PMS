import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ReportPage } from './report';
import { HeaderModule } from 'src/app/components/header/header.module';

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
    HeaderModule,
    ReactiveFormsModule, // ✅ IMPORTANT
    RouterModule.forChild(routes),
  ],
  declarations: [ReportPage],
})
export class ReportPageModule {}
