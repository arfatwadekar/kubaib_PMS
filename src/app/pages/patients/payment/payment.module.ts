import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';   // ✅ Required for ngModel
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { CanDeactivateGuard } from 'src/app/guards/can-deactivate.guard';
import { PaymentPage } from './payment.page';

const routes: Routes = [
  {
    path: '',
    component: PaymentPage,
    canDeactivate: [CanDeactivateGuard] 
  }
];

@NgModule({
  declarations: [PaymentPage],
  imports: [
    CommonModule,
    FormsModule,        // ✅ Added
    IonicModule,
    RouterModule.forChild(routes),
  ],
})
export class PaymentPageModule {}