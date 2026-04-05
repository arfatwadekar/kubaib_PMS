import { Component, OnDestroy, OnInit, HostListener } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { PatientService } from 'src/app/services/patient.service';
import { CanComponentDeactivate } from 'src/app/guards/can-deactivate.guard';

const onlyDigits = (v: string) => (v || '').replace(/\D/g, '');
const toIso = (date: string): string | null => {
  if (!date) return null;
  if (date.includes('T')) return date;
  const [y, m, d] = date.split('-').map(Number);
  if (!y) return null;
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toISOString();
};
const toDateInput = (v: any): string => {
  const s = (v ?? '').toString().trim();
  if (!s) return '';
  return s.includes('T') ? s.slice(0, 10) : s;
};
const nullIfBlank = (v: any) => {
  const s = (v ?? '').toString().trim();
  return s ? s : null;
};
const nullIfDigitsBlank = (v: any, max: number) => {
  const d = onlyDigits((v ?? '').toString()).slice(0, max);
  return d ? d : null;
};
const normalizeMaritalSince = (v: any): string | null => {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  if (/^\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return toIso(s);
  return s;
};
const safeStr = (v: any) => (v ?? '').toString().trim();
const safeNum = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0;

type UserRole = 'Doctor' | 'Receptionist';

@Component({
  selector: 'app-prelim',
  templateUrl: './prelim.page.html',
  styleUrls: ['./prelim.page.scss'],
  standalone: false,
})
export class PrelimPage implements OnInit, OnDestroy, CanComponentDeactivate {

  today = new Date().toLocaleDateString('en-GB');
  maxDob = new Date().toISOString().split('T')[0];

  loading = false;
  isEditMode = false;
  patientId: number | null = null;
  role: UserRole = 'Receptionist';

  showSuccessModal = false;
  successMode: 'create' | 'update' = 'create';
  successPatient: any = null;

  private currentPatient: any = null;
  private sub = new Subscription();
  private isSaved = false;

  // ── Browser tab close / refresh warning ──────────────────────────────────
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.form.dirty && !this.isSaved) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // ── Guard check ──────────────────────────────────────────────────────────
  canDeactivate(): boolean {
    return this.isSaved || !this.form.dirty;
  }

  form = this.fb.group({
    pid: [{ value: '', disabled: true }],
    firstName:          ['', [Validators.required, Validators.minLength(2)]],
    lastName:           ['', [Validators.required, Validators.minLength(2)]],
    gender:             ['Male', Validators.required],
    dateOfBirth:        ['', Validators.required],
    age:                [{ value: '', disabled: true }],
    phoneNumber:        ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    alternateNumber:    [''],
    email:              [''],
    address:            ['', [Validators.required, Validators.minLength(5)]],
    city:               [''],
    state:              [''],
    pinCode:            [''],
    maritalStatus:      ['Single'],
    maritalStatusSince: [''],
    religion:           [''],
    diet:               [''],
    education:          [''],
    occupation:         [''],
    aadharNumber:       [''],
    panNumber:          [''],
    referredBy:         [''],
  });

  constructor(
    private fb:       FormBuilder,
    private patient:  PatientService,
    private toastCtrl: ToastController,
    private route:    ActivatedRoute,
    private router:   Router
  ) {}

  ngOnInit(): void {
    this.loadRole();
    this.initAgeCalculation();

    this.sub.add(
      this.route.queryParams.subscribe(params => {
        const id = safeNum(params?.['patientId']);
        if (id > 0) {
          this.isEditMode = true;
          this.patientId  = id;
          this.loadPatient(id);
        } else {
          this.isEditMode     = false;
          this.patientId      = null;
          this.currentPatient = null;
          this.resetForm();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private loadRole() {
    const raw = (localStorage.getItem('mhc_role') || '').toLowerCase();
    this.role = raw === 'doctor' ? 'Doctor' : 'Receptionist';
  }

  private initAgeCalculation() {
    this.form.get('dateOfBirth')?.valueChanges.subscribe(dob => {
      if (!dob) {
        this.form.patchValue({ age: '' }, { emitEvent: false });
        return;
      }
      const birth = new Date(dob);
      const today = new Date();
      let years = today.getFullYear() - birth.getFullYear();
      if (
        today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() &&
          today.getDate() < birth.getDate())
      ) { years--; }
      this.form.patchValue(
        { age: years >= 0 ? `${years} Years` : '' },
        { emitEvent: false }
      );
    });
  }

  onPhoneInput() {
    this.form.patchValue(
      { phoneNumber: onlyDigits(this.form.value.phoneNumber || '').slice(0, 10) },
      { emitEvent: false }
    );
  }

  onAltPhoneInput() {
    this.form.patchValue(
      { alternateNumber: onlyDigits(this.form.value.alternateNumber || '').slice(0, 10) },
      { emitEvent: false }
    );
  }

  onAadharInput() {
    this.form.patchValue(
      { aadharNumber: onlyDigits(this.form.value.aadharNumber || '').slice(0, 12) },
      { emitEvent: false }
    );
  }

  private loadPatient(id: number) {
    this.loading = true;
    this.patient.getPatientById(id).subscribe({
      next: (res: any) => {
        const p = res?.data ?? res;
        this.currentPatient = p;
        this.form.patchValue({
          pid: safeStr(p.pid), 
          firstName:          safeStr(p.firstName),
          lastName:           safeStr(p.lastName),
          gender:             safeStr(p.gender) || 'Male',
          dateOfBirth:        toDateInput(p.dateOfBirth),
          phoneNumber:        safeStr(p.phoneNumber),
          alternateNumber:    safeStr(p.alternateNumber),
          email:              safeStr(p.email),
          address:            safeStr(p.address),
          city:               safeStr(p.city),
          state:              safeStr(p.state),
          pinCode:            safeStr(p.pinCode),
          maritalStatus:      safeStr(p.maritalStatus) || 'Single',
          maritalStatusSince: toDateInput(p.maritalStatusSince),
          religion:           safeStr(p.religion),
          diet:               safeStr(p.diet),
          education:          safeStr(p.education),
          occupation:         safeStr(p.occupation),
          aadharNumber:       safeStr(p.aadharNumber),
          panNumber:          safeStr(p.panNumber),
          referredBy:         safeStr(p.referredBy),
        });
        this.form.markAsPristine();
        this.form.markAsUntouched();
      },
      error: err =>
        this.toast(err?.error?.message || err?.message || 'Failed to load patient'),
      complete: () => (this.loading = false),
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast('Please fill all required fields correctly.');
      return;
    }
    const phone = onlyDigits(this.form.value.phoneNumber || '');
    if (phone.length !== 10) {
      this.toast('Phone Number must be exactly 10 digits.');
      return;
    }
    this.loading = true;
    const payload = this.isEditMode ? this.buildUpdatePayload() : this.buildCreatePayload();
    const request$ = this.isEditMode && this.patientId
      ? this.patient.updatePatient(this.patientId, payload)
      : this.patient.createPatient(payload);

    request$.subscribe({
      next: (res: any) => {
        this.loading = false;
        const data = res?.data ?? res;

        if (this.isEditMode) {
          // UPDATE: just show toast, no modal
          // markAsPristine so guard resets — if user edits again, guard triggers again
          this.form.markAsPristine();
          this.form.markAsUntouched();
          this.toast('Patient data updated successfully.');
        } else {
          // CREATE: show modal
          this.isSaved = true;
          this.successMode = 'create';
          this.successPatient = data;
          this.showSuccessModal = true;
          this.patientId = data?.patientsId || data?.patientId;
          this.isEditMode = true;
        }
      },
      error: err => {
        this.loading = false;
        this.toast(err?.error?.message || err?.message || 'Operation failed');
      },
    });
  }

  private buildCreatePayload() {
    const v = this.form.value;
    return {
      firstName:          safeStr(v.firstName),
      lastName:           safeStr(v.lastName),
      dateOfBirth:        toIso(v.dateOfBirth || ''),
      gender:             safeStr(v.gender) || 'Male',
      phoneNumber:        onlyDigits(v.phoneNumber || ''),
      alternateNumber:    onlyDigits(v.alternateNumber || '').length === 10
                            ? onlyDigits(v.alternateNumber || '')
                            : onlyDigits(v.phoneNumber || ''),
      email:              nullIfBlank(v.email),
      address:            nullIfBlank(v.address),
      city:               nullIfBlank(v.city),
      state:              nullIfBlank(v.state),
      pinCode:            nullIfBlank(v.pinCode),
      maritalStatus:      nullIfBlank(v.maritalStatus) ?? 'Single',
      maritalStatusSince: normalizeMaritalSince(v.maritalStatusSince),
      religion:           nullIfBlank(v.religion),
      diet:               nullIfBlank(v.diet),
      education:          nullIfBlank(v.education),
      occupation:         nullIfBlank(v.occupation),
      aadharNumber:       nullIfDigitsBlank(v.aadharNumber, 12),
      panNumber:          nullIfBlank(v.panNumber),
      referredBy:         nullIfBlank(v.referredBy),
    };
  }

  private buildUpdatePayload() {
    return {
      ...this.buildCreatePayload(),
      patientsId: this.currentPatient?.patientsId ?? this.patientId,
      pid:        this.currentPatient?.pid ?? null,
    };
  }

  private resetForm() {
    this.form.reset({ gender: 'Male', maritalStatus: 'Single' });
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
    });
    await t.present();
  }

  goToPatientList() {
    this.showSuccessModal = false;
    this.router.navigate(['/patients/list']);
  }
  closeModal() {
    this.showSuccessModal = false;
  }
}