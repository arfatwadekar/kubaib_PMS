import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { AuthService, UserRole } from '../../services/auth.service';

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss'],
  standalone:false,
})
export class SideMenuComponent {
  clinicName = 'Mariam Health Care';

  constructor(
    private auth: AuthService,
    private router: Router,
    private menuCtrl: MenuController
  ) {}

  get role(): UserRole {
    return (this.auth.getRole() as UserRole) || 'Receptionist';
  }

  async go(url: string) {
    await this.menuCtrl.close('mainMenu');
    this.router.navigateByUrl(url);
  }

  async logout() {
    this.auth.logout();
    await this.menuCtrl.close('mainMenu');
    this.router.navigateByUrl('/auth/login');
  }
}
