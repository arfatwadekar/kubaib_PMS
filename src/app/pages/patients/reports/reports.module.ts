import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ReportsPage } from './reports.page';

const routes: Routes = [
  { path: '', component: ReportsPage }
];

@NgModule({
  declarations: [ReportsPage],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,          // ✅ needed for [(ngModel)] on repRows, repReportDate, repSelectedPrevReportId
    RouterModule.forChild(routes)
  ]
})
export class ReportsPageModule {}