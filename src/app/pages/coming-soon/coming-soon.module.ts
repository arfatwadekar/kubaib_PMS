import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { ComingSoonPage } from './coming-soon.page';
import { HeaderModule } from 'src/app/components/header/header.module';

const routes: Routes = [{ path: '', component: ComingSoonPage }];

@NgModule({
  declarations: [ComingSoonPage],
  imports: [CommonModule, IonicModule, HeaderModule, RouterModule.forChild(routes)],
})
export class ComingSoonModule {}
