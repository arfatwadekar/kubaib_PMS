import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AnnouncementRoutingModule } from './announcements-routing.module';
import { AnnouncementListingPage } from './listing/listing';
import { AnnouncementDetailPage } from './detail/detail';
import { IonicModule } from '@ionic/angular';
import { HeaderModule } from 'src/app/components/header/header.module';

@NgModule({
  declarations: [
    AnnouncementListingPage,
    AnnouncementDetailPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AnnouncementRoutingModule,
    IonicModule,
    HeaderModule
  ]
})
export class AnnouncementModule {}