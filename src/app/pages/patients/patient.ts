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
  isEditFromList = false
appointmentId: number | null = null;
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

  const appointment = Number(params['appointmentId']);
  this.appointmentId = appointment > 0 ? appointment : null;

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

// private navigateToTab(tab: TabKey) {

//   this.router.navigate([tab], {
//     relativeTo: this.route,
//     queryParams: {
//       patientId: this.patientId,
//       appointmentId: this.appointmentId,
//       tab
//     },
//     queryParamsHandling: 'merge'
//   });

// }


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

    // Receptionist allowed tabs: Preliminary, Payment, Reports
    return (
      tab === 'prelim' ||
      tab === 'payment' ||
      tab === 'reports'
    );
  }

  // isTabDisabled(tab: TabKey): boolean {
  //   // When creating a patient (no patientId yet OR mode=create),
  //   // only Preliminary tab should be enabled.
  //   const mode = (this.route.snapshot.queryParamMap.get('mode') || '');
  //   const isCreateMode = mode === 'create' || this.patientId === null;

  //   if (isCreateMode) {
  //     return tab !== 'prelim';
  //   }

  //   return !this.isTabAllowed(tab);
  // }

isTabDisabled(tab: TabKey): boolean {

  const mode = this.route.snapshot.queryParamMap.get('mode');
  const from = this.route.snapshot.queryParamMap.get('from');

  const isCreateMode = mode === 'create';

  // 🔒 Create mode → only prelim enabled
  if (isCreateMode) {
    return tab !== 'prelim';
  }

  // 🔒 Patient List Edit → only prelim enabled
  if (from === 'list') {
    return tab !== 'prelim';
  }

  // 🔓 Dashboard → role based
  if (from === 'dashboard') {
    return !this.isTabAllowed(tab);
  }

  // 🔓 Default → role based
  return !this.isTabAllowed(tab);
}
}
