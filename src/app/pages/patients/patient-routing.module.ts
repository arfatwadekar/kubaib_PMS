import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PatientPage } from './patient';

const routes: Routes = [
  {
    path: '',
    component: PatientPage,
    children: [
      { path: '', redirectTo: 'prelim', pathMatch: 'full' },
      {
        path: 'prelim',
        loadChildren: () => import('./prelim/prelim.module').then(m => m.PrelimPageModule),
      },
      {
        path: 'medical',
        loadChildren: () => import('./medical/medical.module').then(m => m.MedicalPageModule),
      },
      {
        path: 'followup',
        loadChildren: () => import('./followup/followup.module').then(m => m.FollowupPageModule),
      },
      {
        path: 'payment',
        loadChildren: () => import('./payment/payment.module').then(m => m.PaymentPageModule),
      },
      {
        path: 'reports',
        loadChildren: () => import('./reports/reports.module').then(m => m.ReportsPageModule),
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PatientRoutingModule {}