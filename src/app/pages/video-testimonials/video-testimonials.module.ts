import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { VideoTestimonialsRoutingModule } from './video-testimonials-routing.module';
import { VideoListingPage } from './listing/listing';
import { VideoDetailPage } from './detail/detail';
import { HeaderModule } from 'src/app/components/header/header.module';

@NgModule({
  declarations: [
    VideoListingPage,
    VideoDetailPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    HeaderModule,
    VideoTestimonialsRoutingModule
  ]
})
export class VideoTestimonialsModule {}