import { Component, OnInit } from '@angular/core';
import { MenuController } from '@ionic/angular';

@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  standalone: false,
})
export class MainLayoutComponent implements OnInit {

  private readonly MENU_ID = 'mainMenu';

  constructor(private menuCtrl: MenuController) {}

  async ngOnInit(): Promise<void> {
    // Enable once on init
    await this.menuCtrl.enable(true, this.MENU_ID);
  }

  async toggleMenu(): Promise<void> {
    const isOpen = await this.menuCtrl.isOpen(this.MENU_ID);

    if (isOpen) {
      await this.menuCtrl.close(this.MENU_ID);
    } else {
      await this.menuCtrl.open(this.MENU_ID);
    }
  }
}
