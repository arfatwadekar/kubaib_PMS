import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { MainLayoutComponent } from './main-layout.component';
import { SideMenuModule } from '../../components/side-menu/side-menu.module';
import { RoleGuard } from 'src/app/guards/role.guard';

const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [

      // ======================
      // Default Redirect
      // ======================
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // ======================
      // Dashboard
      // ======================
      {
        path: 'dashboard',
        loadChildren: () =>
          import('../../pages/dashboard/dashboard.module')
            .then(m => m.DashboardPageModule),
      },

      // ======================
      // Patients
      // ======================
      {
        path: 'patients',
        loadChildren: () =>
          import('../../pages/patients/patient.module')
            .then(m => m.PatientPageModule),
      },

      {
        path: 'patients/list',
        loadChildren: () =>
          import('../../pages/patient-list/patient-list.module')
            .then(m => m.PatientListPageModule),
      },

      {
        path: 'patients/create',
        loadChildren: () =>
          import('../../pages/patients/create-patient/create-patient.module')
            .then(m => m.CreatePatientPageModule),
      },

      {
        path: 'patients/follow-up',
        loadChildren: () =>
          import('../../pages/patients/followUp/follow-up.module')
            .then(m => m.FollowUpPageModule),
      },

      // ======================
      // Reports
      // ======================
      {
        path: 'report',
        loadChildren: () =>
          import('../../pages/report/report.module')
            .then(m => m.ReportPageModule),
      },

      {
        path: 'reports',
        loadChildren: () =>
          import('../../pages/coming-soon/coming-soon.module')
            .then(m => m.ComingSoonModule),
        canActivate: [RoleGuard],
        data: { roles: ['Doctor', 'Receptionist'] },
      },

      // ======================
      // Appointments
      // ======================
      {
        path: 'SearchAppointments',
        loadChildren: () =>
          import('../../pages/search-appointment/search-appointment.module')
            .then(m => m.SearchAppointmentPageModule),
        canActivate: [RoleGuard],
        data: { roles: ['Doctor', 'Receptionist'] },
      },

      // ======================
      // Doctor Only
      // ======================
{
  path: 'medicines',
  loadChildren: () =>
    import('../../pages/medicine/medicine.module')
      .then(m => m.MedicineModule)
}
,
    {
  path: 'notifications',
  loadChildren: () =>
    import('../../pages/notifications/notification.module')
      .then(m => m.NotificationsModule),
  canActivate: [RoleGuard],
  data: { roles: ['Doctor'] },
},

      {
        path: 'announcements',
        loadChildren: () =>
          import('../../pages/coming-soon/coming-soon.module')
            .then(m => m.ComingSoonModule),
        canActivate: [RoleGuard],
        data: { roles: ['Doctor'] },
      },
      {
        path: 'reviews',
        loadChildren: () =>
          import('../../pages/coming-soon/coming-soon.module')
            .then(m => m.ComingSoonModule),
        canActivate: [RoleGuard],
        data: { roles: ['Doctor'] },
      },
    ],
  },
];

@NgModule({
  declarations: [MainLayoutComponent],
  imports: [
    CommonModule,
    IonicModule,
    SideMenuModule,
    RouterModule.forChild(routes),
  ],
})
export class MainLayoutModule {}
