import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.page.html',
  styleUrls: ['./analytics.page.scss'],
  standalone: false,
})
export class AnalyticsPage implements OnInit {

  unreadCount = 0;
  notifications: any[] = [];

  showFilters = false;

  activeTab = 'overview';

  tabs = [
    {
      id: 'overview',
      label: 'Overview Keynotes',
      icon: 'pulse-outline'
    },
    {
      id: 'billing',
      label: 'Billing Cycle & Sales',
      icon: 'card-outline'
    },
    {
      id: 'patient',
      label: 'Patient Demographics',
      icon: 'people-outline'
    },
    {
      id: 'history',
      label: 'Historical Bookkeeper',
      icon: 'document-text-outline'
    }
  ];

  kpiCards = [
    {
      title: 'CONSULTATION CHARGES',
      value: '₹9,00,000',
      icon: 'pulse-outline',
      color: 'blue',
      footerLeft: '1200 Appointments',
      footerRight: 'Care visits booked'
    },
    {
      title: 'CONSULTATION DEPOSITS',
      value: '₹8,00,238',
      icon: 'wallet-outline',
      color: 'green',
      footerLeft: 'Realized capital:',
      footerRight: '89% realized'
    },
    {
      title: 'CONSULT OUTSTANDING',
      value: '₹99,762',
      icon: 'alert-circle-outline',
      color: 'orange',
      footerLeft: 'Patients Pending payment:',
      footerRight: '182 accounts'
    },
    {
      title: 'PHARMACY OTC SALES',
      value: '₹28,28,470',
      icon: 'link-outline',
      color: 'cyan',
      footerLeft: 'Direct cash deposits:',
      footerRight: '₹22,94,989 received'
    },
    {
      title: 'OTC PHARMACY OUTSTANDING',
      value: '₹5,33,481',
      icon: 'document-text-outline',
      color: 'red',
      footerLeft: 'Unrealized credits ratio:',
      footerRight: '19% pending'
    },
    {
      title: 'NEW PATIENT INTAKE',
      value: '343 Patients',
      icon: 'person-add-outline',
      color: 'indigo',
      footerLeft: 'Intake billing contributions:',
      footerRight: '₹4,11,600'
    },
    {
      title: 'RETURNING RETENTION CHECKUPS',
      value: '857 Returnees',
      icon: 'people-outline',
      color: 'emerald',
      footerLeft: 'Loyalty checkout value:',
      footerRight: '₹7,84,155'
    },
    {
      title: 'COLLECTION RATE (OVERALL)',
      value: '83%',
      icon: 'percentage-outline',
      color: 'purple',
      stats: [
        { value: '89%', label: 'Consult' },
        { value: '81%', label: 'Pharmacy' },
        { value: '83%', label: 'Aggregate' }
      ]
    }
  ];

  constructor(
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadNotifications();
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  async loadNotifications() {
    const res: any = await this.notificationService
      .getNotifications()
      .toPromise();

    this.notifications = res || [];

    this.unreadCount = this.notifications.filter(
      (n: any) => !n.isRead
    ).length;
  }

  openNotifications() {
    this.router.navigate(['/notifications']);
  }
}