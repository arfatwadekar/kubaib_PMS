import { NgModule }             from '@angular/core';
import { CommonModule }          from '@angular/common';
import { FormsModule }           from '@angular/forms';
import { IonicModule }           from '@ionic/angular';
import { RouterModule }          from '@angular/router';

// ✅ ng2-charts v5 — NO NgChartsModule. Use BaseChartDirective + provideCharts
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { DashboardPage } from './dashboard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,            // ✅ required for all ion-* elements
    BaseChartDirective,     // ✅ ng2-charts v5 directive (standalone, importable directly)
    RouterModule.forChild([{ path: '', component: DashboardPage }]),
  ],
  declarations: [DashboardPage],
  providers: [
    provideCharts(withDefaultRegisterables()),  // ✅ registers all Chart.js chart types
  ],
})
export class DashboardPageModule {}