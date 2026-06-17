// import { NgModule }             from '@angular/core';
// import { CommonModule }          from '@angular/common';
// import { FormsModule }           from '@angular/forms';
// import { IonicModule }           from '@ionic/angular';
// import { RouterModule }          from '@angular/router';

// // ✅ ng2-charts v5 — NO NgChartsModule. Use BaseChartDirective + provideCharts
// import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';

// import { AnalyticsPage }         from './analytics.page';
// import { HeaderModule } from 'src/app/components/header/header.module';

// @NgModule({
//   imports: [
//     CommonModule,
//     FormsModule,
//     IonicModule,            // ✅ required for all ion-* elements
//     HeaderModule,
//     BaseChartDirective,     // ✅ ng2-charts v5 directive (standalone, importable directly)
//     RouterModule.forChild([{ path: '', component: AnalyticsPage }]),
//   ],
//   declarations: [AnalyticsPage],
//   providers: [
//     provideCharts(withDefaultRegisterables()),  // ✅ registers all Chart.js chart types
//   ],
// })
// export class AnalyticsPageModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

import { HeaderModule } from 'src/app/components/header/header.module';
import { AnalyticsPage } from './analytics.page';

// Chart.js (ng2-charts)
import {
  BaseChartDirective,
  provideCharts,
  withDefaultRegisterables,
} from 'ng2-charts';

// ApexCharts
import { NgApexchartsModule } from 'ng-apexcharts';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HeaderModule,

    // Chart.js
    BaseChartDirective,

    // ApexCharts
    NgApexchartsModule,

    RouterModule.forChild([
      {
        path: '',
        component: AnalyticsPage,
      },
    ]),
  ],
  declarations: [AnalyticsPage],
  providers: [provideCharts(withDefaultRegisterables())],
})
export class AnalyticsPageModule {}
