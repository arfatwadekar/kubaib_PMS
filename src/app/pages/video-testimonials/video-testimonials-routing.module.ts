import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideoListingPage } from './listing/listing';
import { VideoDetailPage } from './detail/detail';

const routes: Routes = [
  { path: '', component: VideoListingPage },
  { path: 'create', component: VideoDetailPage },
  { path: 'edit/:id', component: VideoDetailPage },
  { path: 'view/:id', component: VideoDetailPage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class VideoTestimonialsRoutingModule {}