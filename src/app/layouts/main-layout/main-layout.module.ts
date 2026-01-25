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
  {
    path: 'dashboard',
    loadChildren: () =>
      import('../../pages/dashboard/dashboard.module').then((m) => m.DashboardPageModule),
  },

  // ✅ Everyone (Doctor + Receptionist)
 {
  path: 'patients/create',
  loadChildren: () =>
    import('../../pages/patients/create-patient/create-patient.module').then(
      (m) => m.CreatePatientPageModule
    ),
},

  {
    path: 'appointments/create',
    loadChildren: () =>
      import('../../pages/coming-soon/coming-soon.module').then((m) => m.ComingSoonModule),
    canActivate: [RoleGuard],
    data: { roles: ['Doctor', 'Receptionist'] },
  },
  {
    path: 'reports',
    loadChildren: () =>
      import('../../pages/coming-soon/coming-soon.module').then((m) => m.ComingSoonModule),
    canActivate: [RoleGuard],
    data: { roles: ['Doctor', 'Receptionist'] },
  },

  // ✅ Doctor only
  {
    path: 'medicines',
    loadChildren: () =>
      import('../../pages/coming-soon/coming-soon.module').then((m) => m.ComingSoonModule),
    canActivate: [RoleGuard],
    data: { roles: ['Doctor'] },
  },
  {
    path: 'medicines/create',
    loadChildren: () =>
      import('../../pages/coming-soon/coming-soon.module').then((m) => m.ComingSoonModule),
    canActivate: [RoleGuard],
    data: { roles: ['Doctor'] },
  },
  {
    path: 'notifications',
    loadChildren: () =>
      import('../../pages/coming-soon/coming-soon.module').then((m) => m.ComingSoonModule),
    canActivate: [RoleGuard],
    data: { roles: ['Doctor'] },
  },
  {
    path: 'announcements',
    loadChildren: () =>
      import('../../pages/coming-soon/coming-soon.module').then((m) => m.ComingSoonModule),
    canActivate: [RoleGuard],
    data: { roles: ['Doctor'] },
  },
  {
    path: 'reviews',
    loadChildren: () =>
      import('../../pages/coming-soon/coming-soon.module').then((m) => m.ComingSoonModule),
    canActivate: [RoleGuard],
    data: { roles: ['Doctor'] },
  },

  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
]

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
