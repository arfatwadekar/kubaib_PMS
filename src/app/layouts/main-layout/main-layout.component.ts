import { Component } from '@angular/core';
import { MenuController } from '@ionic/angular';

@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  standalone: false,
})
export class MainLayoutComponent {
  isMenuOpen = true;

  constructor(private menuCtrl: MenuController) {}

  async toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;

    if (this.isMenuOpen) {
      await this.menuCtrl.enable(true, 'mainMenu');
      await this.menuCtrl.open('mainMenu');
    } else {
      await this.menuCtrl.close('mainMenu');
      await this.menuCtrl.enable(false, 'mainMenu');
    }
  }
}
