import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, UrlSegment } from '@angular/router';

type TabKey = 'prelim' | 'medical' | 'followup' | 'payment' | 'reports';
type UserRole = 'Doctor' | 'Receptionist';

@Component({
  selector: 'app-patient',
  templateUrl: './patient.html',
  styleUrls: ['./patient.scss'],
  standalone: false,
})
export class PatientPage implements OnInit {

  activeTab: TabKey = 'prelim';
  role: UserRole = 'Receptionist';
  patientId: number | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {

    // 🔹 Load role
    const raw = (localStorage.getItem('mhc_role') || '').toLowerCase();
    this.role = raw === 'doctor' ? 'Doctor' : 'Receptionist';

    this.route.queryParams.subscribe(params => {
      const id = Number(params['patientId']);
      this.patientId = id > 0 ? id : null;

      const tab = params['tab'] as TabKey;
      if (tab && this.isTabAllowed(tab)) {
        this.activeTab = tab;
      }

      // Check current child route
      const currentChild = this.route.snapshot.firstChild?.routeConfig?.path as TabKey;
      if (tab && this.isTabAllowed(tab) && currentChild !== tab) {
        this.navigateToTab(tab);
      }
    });
  }

  // ======================
  // SEGMENT CHANGE
  // ======================
  onSegmentChange(event: any) {
    const tab = event.detail.value as TabKey;

    if (!this.isTabAllowed(tab)) return;

    this.activeTab = tab;
    this.navigateToTab(tab);
  }

  private navigateToTab(tab: TabKey) {
    this.router.navigate([tab], {
      relativeTo: this.route,
      queryParams: { patientId: this.patientId, tab },
      queryParamsHandling: 'merge'
    });
  }

  // ======================
  // ROLE PERMISSION
  // ======================
  isTabAllowed(tab: TabKey): boolean {
    if (this.role === 'Doctor') return true;

    // Receptionist allowed tabs
    return (
      tab === 'prelim' ||
      tab === 'payment' ||
      tab === 'reports' ||
      tab === 'followup' ||
      tab === 'medical'
    );
  }

  isTabDisabled(tab: TabKey): boolean {
    return !this.isTabAllowed(tab);
  }
}
