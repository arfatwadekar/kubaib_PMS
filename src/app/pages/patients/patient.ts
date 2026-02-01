import { Component, OnInit } from '@angular/core';

type StepKey = 's1' | 's2' | 's3' | 's4';
type StepStatus = 'locked' | 'active' | 'done';

@Component({
  selector: 'app-patient',
  templateUrl: './patient.html',
  styleUrls: ['./patient.scss'],
  standalone: false,
})
export class PatientPage implements OnInit {

  loading = false;

  // ===============================
  // FLOW CONTEXT (IDs + step state)
  // ===============================
  ctx = {
    patientId: null as number | null,
    pid: '',
    appointmentId: null as number | null,
    clinicalCaseId: null as number | null,
    followupId: null as number | null,
    paymentId: null as number | null,

    activeStep: 's1' as StepKey,
    steps: {
      s1: 'active' as StepStatus,
      s2: 'locked' as StepStatus,
      s3: 'locked' as StepStatus,
      s4: 'locked' as StepStatus,
    },
  };

  // ===============================
  // STEP FORM MODELS (DEMO)
  // ===============================
  s1 = {
    fullName: '',
    phone: '',
    gender: '',
    dob: '',
    address: '',
  };

  s2 = {
    chiefComplaint: '',
    associatedComplaint: '',
    pastHistory: '',
  };

  s3 = {
    nextVisitDate: '',
    notes: '',
  };

  s4 = {
    amount: 0,
    mode: '',
    remarks: '',
  };

  constructor() {}

  ngOnInit(): void {}

  // ===============================
  // STEP NAVIGATION
  // ===============================
  go(step: StepKey): void {
    if (this.ctx.steps[step] === 'locked') return;
    this.ctx.activeStep = step;
  }

  private markDone(step: StepKey): void {
    this.ctx.steps[step] = 'done';
  }

  private unlock(step: StepKey): void {
    if (this.ctx.steps[step] === 'locked') {
      this.ctx.steps[step] = 'active';
    }
  }

  resetAll(): void {
    this.ctx = {
      patientId: null,
      pid: '',
      appointmentId: null,
      clinicalCaseId: null,
      followupId: null,
      paymentId: null,
      activeStep: 's1',
      steps: { s1: 'active', s2: 'locked', s3: 'locked', s4: 'locked' },
    };

    this.s1 = { fullName: '', phone: '', gender: '', dob: '', address: '' };
    this.s2 = { chiefComplaint: '', associatedComplaint: '', pastHistory: '' };
    this.s3 = { nextVisitDate: '', notes: '' };
    this.s4 = { amount: 0, mode: '', remarks: '' };
  }

  // ===============================
  // STEP 1: PRELIMINARY
  // Create patientId + pid
  // Create appointmentId (today visit)
  // ===============================
  saveS1(): void {
    if (!this.s1.fullName || !this.s1.phone) {
      alert('Name and Phone are required');
      return;
    }

    this.loading = true;

    // ---- DEMO: create patient ----
    setTimeout(() => {
      this.ctx.patientId = this.randId();
      this.ctx.pid = 'P-' + this.randId();

      // ---- DEMO: create appointment ----
      this.ctx.appointmentId = this.randId();

      this.markDone('s1');
      this.unlock('s2');
      this.ctx.activeStep = 's2';
      this.loading = false;
    }, 500);
  }

  // ===============================
  // STEP 2: MEDICAL
  // Create clinicalCaseId
  // ===============================
  saveS2(): void {
    if (!this.ctx.patientId || !this.ctx.appointmentId) {
      alert('Patient not created yet');
      return;
    }

    this.loading = true;

    setTimeout(() => {
      this.ctx.clinicalCaseId = this.randId();

      this.markDone('s2');
      this.unlock('s3');
      this.ctx.activeStep = 's3';
      this.loading = false;
    }, 400);
  }

  // ===============================
  // STEP 3: FOLLOW-UP
  // Create followupId
  // ===============================
  saveS3(): void {
    if (!this.ctx.clinicalCaseId) {
      alert('Medical examination pending');
      return;
    }

    this.loading = true;

    setTimeout(() => {
      this.ctx.followupId = this.randId();

      this.markDone('s3');
      this.unlock('s4');
      this.ctx.activeStep = 's4';
      this.loading = false;
    }, 400);
  }

  // ===============================
  // STEP 4: PAYMENT
  // Create paymentId
  // ===============================
  saveS4(): void {
    if (!this.s4.amount || !this.s4.mode) {
      alert('Amount and payment mode required');
      return;
    }

    this.loading = true;

    setTimeout(() => {
      this.ctx.paymentId = this.randId();
      this.markDone('s4');
      this.loading = false;

      alert('✅ Patient flow completed (Demo)');
    }, 400);
  }

  // ===============================
  // UTIL
  // ===============================
  private randId(): number {
    return Math.floor(10000 + Math.random() * 90000);
  }
}
