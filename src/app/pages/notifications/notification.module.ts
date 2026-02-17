import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NotificationsRoutingModule } from './notification-routing.module';

import { ListingComponent } from './listing/notifications.component';
import { DetailComponent } from './detail/detail.component';   // ✅ ADD THIS
import { IonicModule } from '@ionic/angular';

@NgModule({
  declarations: [
    ListingComponent,
    DetailComponent    // ✅ ADD THIS
  ],
  imports: [
    CommonModule,
    NotificationsRoutingModule,
    HttpClientModule,
    IonicModule
  ]
})
export class NotificationsModule {}
