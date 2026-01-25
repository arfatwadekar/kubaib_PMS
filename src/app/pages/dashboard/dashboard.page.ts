import { Component } from '@angular/core';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  standalone: false,
})
export class DashboardPage {
  constructor(private layout: MainLayoutComponent) {}

  toggleMenu() {
    this.layout.toggleMenu();
  }
}
