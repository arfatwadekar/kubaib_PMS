import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { MainLayoutComponent } from './main-layout.component';
import { SideMenuModule } from '../../components/side-menu/side-menu.module';

const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('../../pages/dashboard/dashboard.module')
            .then(m => m.DashboardPageModule),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
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
