import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NotificationsRoutingModule } from './notification-routing.module';

import { ListingComponent } from './listing/notifications.component';
import { DetailComponent } from './detail/detail.component';   // ✅ ADD THIS
import { IonicModule } from '@ionic/angular';
import { HeaderModule } from 'src/app/components/header/header.module';

@NgModule({
  declarations: [
    ListingComponent,
    DetailComponent    // ✅ ADD THIS
  ],
  imports: [
    CommonModule,
    NotificationsRoutingModule,
    HttpClientModule,
    IonicModule,
    HeaderModule
  ]
})
export class NotificationsModule {}
