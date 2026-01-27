import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { TableComponent } from './table.component';

@NgModule({
  declarations: [TableComponent],
  imports: [CommonModule, IonicModule],
  exports: [TableComponent],
})
export class TableModule {}
