import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { ComingSoonPage } from './coming-soon.page';

const routes: Routes = [{ path: '', component: ComingSoonPage }];

@NgModule({
  declarations: [ComingSoonPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class ComingSoonModule {}
