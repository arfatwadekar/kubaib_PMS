import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListingPage } from './listing/listing';
import { DetailPage } from './detail/detail';

const routes: Routes = [
  { path: '', component: ListingPage },
  { path: 'create', component: DetailPage },
  { path: 'edit/:id', component: DetailPage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MedicineRoutingModule {}
