import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from 'src/app/services/notification.service';

type TabKey = 'prelim' | 'medical' | 'followup' | 'payment' | 'reports';
type UserRole = 'Doctor' | 'Receptionist';

@Component({
  selector: 'app-patient',
  templateUrl: './patient.html',
  styleUrls: ['./patient.scss'],
  standalone:false
})
export class PatientPage implements OnInit {

  activeTab: TabKey = 'prelim';
  role: UserRole = 'Receptionist';

  patientId: number | null = null;
  appointmentId: number | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
           private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {

    this.loadRole();

    this.route.queryParams.subscribe(params => {

      const pid = Number(params['patientId']);
      this.patientId = pid > 0 ? pid : null;

      const aid = Number(params['appointmentId']);
      this.appointmentId = aid > 0 ? aid : null;

      const tab = params['tab'] as TabKey;

      // If tab provided → use it
      if (tab && this.isTabAllowed(tab)) {
        this.activeTab = tab;
        return;
      }

      // Default landing tab based on role
      const defaultTab: TabKey =
        this.role === 'Doctor' ? 'medical' : 'payment';

      this.activeTab = defaultTab;

      this.navigateToTab(defaultTab);

    });

    this.loadNotifications();
  }

  
async loadNotifications() {
  const res: any = await this.notificationService.getNotifications().toPromise();

  this.notifications = res || [];

  this.unreadCount = this.notifications.filter(n => !n.isRead).length;
}

openNotifications() {
  this.router.navigate(['/notifications']);
}

  private loadRole() {
    const raw = (localStorage.getItem('mhc_role') || '').toLowerCase();
    this.role = raw === 'doctor' ? 'Doctor' : 'Receptionist';
  }

  /* ================================
     TAB SELECT
  ================================= */

async selectTab(tab: TabKey) {
  console.log('SELECT TAB CALLED:', tab, new Date().getTime());  // ← add this
  if (this.isTabDisabled(tab)) return;

  const previousTab = this.activeTab;

  // Navigate first — guard will run
  const navigationResult = await this.router.navigate([tab], {
    relativeTo: this.route,
    queryParams: {
      patientId:     this.patientId,
      appointmentId: this.appointmentId,
      tab
    },
    queryParamsHandling: 'merge',
    replaceUrl: true
  });

  // Only update active tab if navigation succeeded
  // If guard returned false, navigationResult will be false/null
  if (navigationResult) {
    this.activeTab = tab;
  } else {
    // Guard blocked navigation — restore previous tab highlight
    this.activeTab = previousTab;
  }
}


  /* ================================
     ROUTER NAVIGATION
  ================================= */

private navigateToTab(tab: TabKey) {
  this.router.navigate([tab], {
    relativeTo: this.route,
    queryParams: {
      patientId:     this.patientId,
      appointmentId: this.appointmentId,
      tab
    },
    queryParamsHandling: 'merge',
    replaceUrl: true
  });
}

  /* ================================
     ROLE PERMISSION
  ================================= */

  // isTabAllowed(tab: TabKey): boolean {

  //   if (this.role === 'Doctor') return true;

  //   return (
  //     tab === 'prelim' ||
  //     tab === 'payment' ||
  //     tab === 'reports'
  //   );

  // }

  isTabAllowed(tab: TabKey): boolean {

  if (this.role === 'Doctor') return true;

  // ✅ Receptionist can access all tabs (view mode)
  return true;

}

  /* ================================
     DISABLED STATE
  ================================= */

  // isTabDisabled(tab: TabKey): boolean {

  //   const mode = this.route.snapshot.queryParamMap.get('mode');
  //   const from = this.route.snapshot.queryParamMap.get('from');

  //   const isCreateMode = mode === 'create';

  //   // Create Patient → only Preliminary
  //   if (isCreateMode) {
  //     return tab !== 'prelim';
  //   }

  //   // Edit from Patient List → only Preliminary
  //   if (from === 'list') {
  //     return tab !== 'prelim';
  //   }

  //   // Dashboard → role based
  //   return !this.isTabAllowed(tab);

  // }

//   isTabDisabled(tab: TabKey): boolean {

//   const mode = this.route.snapshot.queryParamMap.get('mode');
//   const from = this.route.snapshot.queryParamMap.get('from');

//   // CREATE MODE → only Preliminary allowed
//   if (mode === 'create') {
//     return tab !== 'prelim';
//   }

//   // EDIT FROM LIST → only Preliminary
//   if (from === 'list') {
//     return tab !== 'prelim';
//   }

//   // Dashboard → role based
//   if (from === 'dashboard') {
//     return !this.isTabAllowed(tab);
//   }

//   // Default → role based
//   return !this.isTabAllowed(tab);

// }

isTabDisabled(tab: TabKey): boolean {
  const mode  = this.route.snapshot.queryParamMap.get('mode');
  const from  = this.route.snapshot.queryParamMap.get('from');

  // ── CREATE MODE: patientId is null — only Prelim allowed ──────────
  if (mode === 'create' || !this.patientId) {
    return tab !== 'prelim';
  }

  // ── EDIT FROM PATIENT LIST: only Prelim allowed ───────────────────
  // if (from === 'list') {
  //   return tab !== 'prelim';
  // }

  // ── DASHBOARD / DEFAULT: role-based permission ────────────────────
  return !this.isTabAllowed(tab);
}

unreadCount = 0;
notifications: any[] = [];
}