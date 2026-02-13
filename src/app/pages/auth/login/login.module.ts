import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms'; // ✅ import this
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { LoginPage } from './login.page';

const routes: Routes = [{ path: '', component: LoginPage }];

@NgModule({
  declarations: [LoginPage],
  imports: [
    CommonModule,
    FormsModule,          // optional (only if ngModel used somewhere)
    ReactiveFormsModule,  // ✅ REQUIRED for formGroup
    IonicModule,
    RouterModule.forChild(routes),
  ],
})
export class LoginPageModule {}
