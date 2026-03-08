import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { FollowupPage } from './followup.page';

const routes: Routes = [
  { path: '', component: FollowupPage }
];

@NgModule({
  declarations: [FollowupPage],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    FormsModule,
    NgSelectModule,
    
  ]
})
export class FollowupPageModule {}