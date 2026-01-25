import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { PidSuccessPage } from './pid-success.page';

@NgModule({
  declarations: [PidSuccessPage],
  imports: [CommonModule, IonicModule],
  exports: [PidSuccessPage], // ✅ modal use ke liye easy
})
export class PidSuccessPageModule {}
