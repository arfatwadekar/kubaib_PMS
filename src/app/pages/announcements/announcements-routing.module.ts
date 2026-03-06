import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AnnouncementListingPage } from './listing/listing';
import { AnnouncementDetailPage } from './detail/detail';

const routes: Routes = [
  { path: '', component: AnnouncementListingPage },
  { path: 'create', component: AnnouncementDetailPage },
  { path: 'edit/:id', component: AnnouncementDetailPage },
  { path: 'view/:id', component: AnnouncementDetailPage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AnnouncementRoutingModule {}