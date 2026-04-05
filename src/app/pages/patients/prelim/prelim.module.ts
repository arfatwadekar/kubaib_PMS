import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { CanDeactivateGuard } from 'src/app/guards/can-deactivate.guard';

import { PrelimPage } from './prelim.page';

const routes: Routes = [
  {
    path: '',
    component: PrelimPage,
    canDeactivate: [CanDeactivateGuard]  // ← add this
  }
];

@NgModule({
  declarations: [PrelimPage],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule.forChild(routes)
  ]
})
export class PrelimPageModule {}