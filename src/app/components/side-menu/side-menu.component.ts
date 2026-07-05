import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { AuthService, UserRole } from '../../services/auth.service';

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss'],
  standalone: false,
})
export class SideMenuComponent implements OnInit {
  private readonly MENU_ID = 'mainMenu';

  clinicName = 'Mumbra Health Care';
  role: UserRole | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private menuCtrl: MenuController,
  ) {}

  ngOnInit(): void {
    this.role = this.auth.getRole();
  }

  async go(url: string): Promise<void> {
    await this.menuCtrl.close(this.MENU_ID);

    // If user is going to create a new patient (no patientId yet),
    // force the prelim tab and disable other tabs via query param.
    if (url === '/patients') {
      await this.router.navigate(['/patients'], {
        queryParams: { tab: 'prelim', mode: 'create' },
      });
      return;
    }

    await this.router.navigateByUrl(url);
  }

  async logout(): Promise<void> {
    this.auth.logout();
    await this.menuCtrl.close(this.MENU_ID);
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
