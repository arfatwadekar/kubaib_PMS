import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MedicineRoutingModule } from './medicine-routing.module';
import { ListingPage } from './listing/listing';
import { DetailPage } from './detail/detail';
import { IonicModule } from '@ionic/angular';
import { HeaderModule } from 'src/app/components/header/header.module';

@NgModule({
  declarations: [
    ListingPage,
    DetailPage
  ],
  imports: [
    CommonModule,        // 🔥 for ngClass, ngIf
    FormsModule,         // 🔥 for ngModel
    ReactiveFormsModule, // 🔥 for formGroup
    MedicineRoutingModule,
    IonicModule,
    HeaderModule
  ]
})
export class MedicineModule {}
