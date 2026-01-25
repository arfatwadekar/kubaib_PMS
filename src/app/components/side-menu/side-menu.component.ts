import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { AuthService, UserRole } from '../../services/auth.service';

type MenuItem = {
  title: string;
  url: string;
  icon?: string;
  showDot?: boolean;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
  roles: UserRole[];
};

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss'],
  standalone:false,
})
export class SideMenuComponent {
  clinicName = 'Mariam Health Care';

  private sections: MenuSection[] = [
    {
      title: 'PATIENT',
      roles: ['Doctor', 'Receptionist'],
      items: [
        { title: 'Patient Dashboard', url: '/dashboard', icon: 'grid-outline' },
        { title: 'Create Patient ID', url: '/patients/create', icon: 'person-add-outline' },
        { title: 'Create Appointment', url: '/appointments/create', icon: 'calendar-outline' },
      ],
    },
    {
      title: 'MEDICINE INVENTORY',
      roles: ['Doctor'],
      items: [
        { title: 'Medicine Dashboard', url: '/medicines', icon: 'medkit-outline' },
        { title: 'Create Medicine', url: '/medicines/create', icon: 'add-circle-outline' },
      ],
    },
    {
      title: 'COMMUNICATION',
      roles: ['Doctor'],
      items: [
        { title: 'Notifications', url: '/notifications', icon: 'notifications-outline', showDot: true },
        { title: 'Announcements', url: '/announcements', icon: 'megaphone-outline' },
        { title: 'Add Reviews', url: '/reviews', icon: 'star-outline' },
      ],
    },
    {
      title: 'REPORTS',
      roles: ['Doctor', 'Receptionist'],
      items: [
        { title: 'Reports', url: '/reports', icon: 'bar-chart-outline' },
      ],
    },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private menuCtrl: MenuController
  ) {}

  get role(): UserRole {
    return (this.auth.getRole() as UserRole) || 'Receptionist';
  }

  get visibleSections(): MenuSection[] {
    return this.sections.filter(section =>
      section.roles.includes(this.role)
    );
  }

  async navigate(url: string) {
    await this.menuCtrl.close('mainMenu');
    this.router.navigateByUrl(url);
  }

  async logout() {
    this.auth.logout();
    await this.menuCtrl.close('mainMenu');
    this.router.navigateByUrl('/auth/login');
  }
}
