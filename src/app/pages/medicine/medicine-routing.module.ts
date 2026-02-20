import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListingPage } from './listing/listing';
import { DetailPage } from './detail/detail';

const routes: Routes = [
  { path: '', component: ListingPage },
  { path: 'create', component: DetailPage },
  { path: 'edit/:id', component: DetailPage },
  { path: 'view/:id', component: DetailPage }  // ✅ ADD THIS
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MedicineRoutingModule {}
