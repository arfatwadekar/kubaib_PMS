import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { FollowUpPage } from './follow-up.page';

const routes: Routes = [{ path: '', component: FollowUpPage }];

@NgModule({
  declarations: [FollowUpPage],
  imports: [CommonModule, IonicModule, ReactiveFormsModule, RouterModule.forChild(routes)],
})
export class FollowUpPageModule {}
