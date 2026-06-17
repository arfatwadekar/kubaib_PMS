import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { OtcMedicineRoutingModule } from './otc-medicine-routing.module';

import { ListingPage } from './listing/listing';
import { DetailPage } from './detail/detail';

import { HeaderModule } from 'src/app/components/header/header.module';

@NgModule({
  declarations: [ListingPage, DetailPage],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    HeaderModule,
    OtcMedicineRoutingModule,
  ],
})
export class OtcMedicineModule {}
