import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { AuthService, UserRole } from '../../services/auth.service';

interface MenuItem {
  title: string;
  icon: string;
  url: string;
}

interface MenuSection {
  title: string;
  roles: UserRole[];
  items: MenuItem[];
}

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss'],
  standalone: false,
})
export class SideMenuComponent implements OnInit {

  private readonly MENU_ID = 'mainMenu';

  clinicName = 'Mariam Health Care';
  role: UserRole | null = null;

  menuSections: MenuSection[] = [
    {
      title: 'DASHBOARD',
      roles: ['Doctor', 'Receptionist'],
      items: [
        { title: 'Dashboard', icon: 'grid-outline', url: '/dashboard' },
      ],
    },
    {
      title: 'PATIENTS',
      roles: ['Doctor', 'Receptionist'],
      items: [
        { title: 'Search Patient', icon: 'people-outline', url: '/patients/list' },
        { title: 'Create Patient ID', icon: 'person-add-outline', url: '/patients' },
      ],
    },
    {
      title: 'DOCTOR WORKFLOW',
      roles: ['Doctor'],
      items: [
        { title: 'Follow Up', icon: 'repeat-outline', url: '/patients/follow-up' },
        { title: 'Medical Examination', icon: 'medkit-outline', url: '/patients/medical-examination' },
      ],
    },
    {
      title: 'APPOINTMENTS',
      roles: ['Doctor', 'Receptionist'],
      items: [
        { title: 'Search Appointment', icon: 'calendar-outline', url: '/SearchAppointments' },
      ],
    },
    {
      title: 'MEDICINE INVENTORY',
      roles: ['Doctor'],
      items: [
        { title: 'Medicine Dashboard', icon: 'medkit-outline', url: '/medicines' },
        { title: 'Create Medicine', icon: 'add-circle-outline', url: '/medicines/create' },
      ],
    },
    {
      title: 'COMMUNICATION',
      roles: ['Doctor'],
      items: [
        { title: 'Notifications', icon: 'notifications-outline', url: '/notifications' },
        { title: 'Announcements', icon: 'megaphone-outline', url: '/announcements' },
        { title: 'Add Reviews', icon: 'star-outline', url: '/reviews' },
      ],
    },
    {
      title: 'REPORTS',
      roles: ['Doctor', 'Receptionist'],
      items: [
        { title: 'Reports', icon: 'bar-chart-outline', url: '/reports' },
      ],
    },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private menuCtrl: MenuController
  ) {}

  ngOnInit(): void {
    this.role = this.auth.getRole();
  }

  get visibleSections(): MenuSection[] {
    if (!this.role) return [];
    return this.menuSections.filter(section =>
      section.roles.includes(this.role!)
    );
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
