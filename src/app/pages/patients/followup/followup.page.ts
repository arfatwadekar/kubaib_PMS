import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormArray, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { FollowUpService } from 'src/app/services/follow-up.service';

const INIT_ROWS = 10;
const MAX_ROWS = 30;
const AUTO_ADD_ROWS = 2;

@Component({
  selector: 'app-followup',
  templateUrl: './followup.page.html',
  styleUrls: ['./followup.page.scss'],
  standalone: false,
})
export class FollowupPage implements OnInit, OnDestroy {
  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE PROPERTIES
  // ─────────────────────────────────────────────────────────────────────────
  showPasswordModal = false;
  interpretation = '';
  temporaryProblems = '';
  waveOffSelected = false;
  symptomStatus: string[] = [];

  consultationCharge = 0;
  waveOffAmount = 0;

  nextAppointmentDate: string | null = null;
  nextAppointmentTime: string | null = null;

  currentAppointmentId!: number;

  prescriptions: any[] = [];

  adminPassword = '';

  waveOffVerified = false;

  medicines: any[] = [];
  patientId!: number;
  creatingMedicine = false;

  isFirstVisit = true;
  isSaved = false;
  isEditMode = false;
  criteriaLoading = false;

  existingCriteria: any[] = [];

  summaryList: any[] = [];

  private destroy$ = new Subject<void>();

  // ─────────────────────────────────────────────────────────────────────────
  // FORM DEFINITION
  // ─────────────────────────────────────────────────────────────────────────

  fuCriteriaForm = this.fb.group({
    symptoms: this.fb.array<FormControl<string>>([]),
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTRUCTOR & DEPENDENCY INJECTION
  // ─────────────────────────────────────────────────────────────────────────

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private api: FollowUpService,
    private toastCtrl: ToastController,
    private router: Router,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────────────────────────────────

  get fuSymptomsArr(): FormArray<FormControl<string>> {
    return this.fuCriteriaForm.get('symptoms') as FormArray<
      FormControl<string>
    >;
  }

  // Get only non-empty symptoms for Follow-Up rating table
  get symptomsArray(): any[] {
    return this.fuSymptomsArr.controls
      .map((ctrl: any, i) => ({
        index: i,
        value: ctrl.value,
        criteriaId: ctrl.criteriaId,
      }))
      .filter((item) => item.value && item.value.trim() !== '');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE HOOKS
  // ─────────────────────────────────────────────────────────────────────────

  async ngOnInit() {
    const patientParam = this.route.snapshot.queryParamMap.get('patientId');

    this.patientId = patientParam ? Number(patientParam) : 0;

    console.log('PATIENT ID:', this.patientId);

    if (!this.patientId || isNaN(this.patientId)) {
      this.showToast('Invalid patient ID');
      return;
    }

    // 1️⃣ Load current appointment
    await this.loadCurrentAppointment();

    // 2️⃣ Load summary
    await this.loadSummary();

    // 3️⃣ Initialize form rows
    this.initRows();
    this.listenExpansion();

    // 4️⃣ Load existing criteria (symptoms from first visit)
    await this.loadCriteria();

    // 5️⃣ Load medicines
    this.loadMedicines();

    // 6️⃣ Add default medicine row
    this.addMedicineRow();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD CURRENT APPOINTMENT
  // ─────────────────────────────────────────────────────────────────────────

  async loadCurrentAppointment() {
    try {
      const res: any = await firstValueFrom(
        this.api.getAppointmentsByPatient(this.patientId),
      );

      console.log('APPOINTMENT RESPONSE:', res);

      const list = res?.appointments || [];

      if (!list.length) {
        this.showToast('No appointment found');
        return;
      }

      // Get latest appointment
      this.currentAppointmentId = list[0].appointmentId;

      console.log('CURRENT APPOINTMENT ID:', this.currentAppointmentId);
    } catch (err) {
      console.error('Appointment load error:', err);
      this.showToast('Failed to load appointment');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD SUMMARY DATA
  // ─────────────────────────────────────────────────────────────────────────

  summary: any = null;

  async loadSummary() {
    try {
      const res: any = await firstValueFrom(
        this.api.getAppointmentSummary(this.currentAppointmentId),
      );

      console.log('SUMMARY API:', res);

      this.summary = res;
       if (res?.payment?.consultationCharges) {
      this.consultationCharge = res.payment.consultationCharges;
    }
    } catch (err) {
      console.error('Summary load error:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZE FORM ROWS
  // ─────────────────────────────────────────────────────────────────────────

  private initRows() {
    for (let i = 0; i < INIT_ROWS; i++) {
      this.fuSymptomsArr.push(this.fb.control('', { nonNullable: true }));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-EXPANSION LISTENER
  // When last row is filled, auto-add rows until MAX_ROWS
  // ─────────────────────────────────────────────────────────────────────────

  private listenExpansion() {
    this.fuSymptomsArr.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((values) => {
        // Only expand if:
        // 1. Data is not saved, OR
        // 2. In edit mode (after loading criteria)
        if (this.isSaved && !this.isEditMode) return;

        const lastValue = values[this.fuSymptomsArr.length - 1];

        // If last row has content and we haven't reached MAX_ROWS, add more rows
        if (lastValue && this.fuSymptomsArr.length < MAX_ROWS) {
          this.addRows(AUTO_ADD_ROWS);
        }
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADD MORE ROWS
  // ─────────────────────────────────────────────────────────────────────────

  private addRows(count: number) {
    for (let i = 0; i < count; i++) {
      if (this.fuSymptomsArr.length >= MAX_ROWS) return;

      this.fuSymptomsArr.push(this.fb.control('', { nonNullable: true }));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRACK BY INDEX (Performance optimization)
  // ─────────────────────────────────────────────────────────────────────────

  trackByIndex(index: number): number {
    return index;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD EXISTING CRITERIA FROM SERVER
  // This loads symptoms from the first visit or previous visits
  // ─────────────────────────────────────────────────────────────────────────

  private async loadCriteria() {
    try {
      const res: any = await firstValueFrom(
        this.api.getCriteriaByPatient(this.patientId),
      );

      // Handle various response formats
      const list = Array.isArray(res) ? res : res?.data || [];

      // If no criteria exist, this is a first visit
      if (!list.length) {
        this.isFirstVisit = true;
        this.isSaved = false;
        this.isEditMode = false;
        return;
      }

      // ===================================================================
      // REVISIT FLOW: Populate form with existing criteria
      // ===================================================================
      this.isSaved = true;
      this.isFirstVisit = false;
      this.isEditMode = false;

      // Clear initial rows and load criteria
      this.fuSymptomsArr.clear();
      this.existingCriteria = [...list];

      list.forEach((criteria: any) => {
        const ctrl = this.fb.control(
          { value: criteria.criteriaName, disabled: true },
          { nonNullable: true },
        );

        // Store criteria ID on control for later identification
        (ctrl as any).criteriaId = criteria.patientFollowUpCriteriaId;

        this.fuSymptomsArr.push(ctrl);
      });

      console.log('✓ CRITERIA LOADED FOR REVISIT');
      console.log('Criteria count:', this.existingCriteria.length);
      console.log('Existing criteria:', this.existingCriteria);
    } catch (err) {
      console.error('Load criteria error:', err);
      this.showToast('Failed to load symptoms');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ENABLE EDIT MODE
  // Unlock all disabled controls so user can edit existing symptoms
  // ─────────────────────────────────────────────────────────────────────────

  enableEdit() {
    console.log('🔓 ENABLING EDIT MODE');

    this.isEditMode = true;

    // Enable all controls for editing
    this.fuSymptomsArr.controls.forEach((ctrl) => {
      ctrl.enable();
    });

    // Reset status badge to show editing state
    this.showToast('Editing mode enabled. You can now modify symptoms.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE CRITERIA (For Initial Creation & Revisit Updates)
  // This handles:
  // 1. Creating new symptoms on first visit
  // 2. Updating existing symptoms on revisit
  // 3. Adding new symptoms on revisit
  // ─────────────────────────────────────────────────────────────────────────

  async saveCriteria() {
    console.log('💾 SAVING CRITERIA');

    const createList: string[] = [];
    const updateList: any[] = [];

    // Iterate through all controls and categorize them
    this.fuSymptomsArr.controls.forEach((ctrl: any) => {
      const value = ctrl.getRawValue().trim();

      // Skip empty values
      if (!value) return;

      const criteriaId = ctrl.criteriaId;

      if (criteriaId) {
        // ═══════════════════════════════════════════════════════════════════
        // CASE 1: EXISTING CRITERIA (Has criteriaId)
        // ═══════════════════════════════════════════════════════════════════
        const existing = this.existingCriteria.find(
          (x: any) => x.patientFollowUpCriteriaId === criteriaId,
        );

        // Only add to update list if the value changed
        if (existing && existing.criteriaName !== value) {
          console.log('📝 UPDATING CRITERIA:', criteriaId, value);

          updateList.push({
            patientFollowUpCriteriaId: criteriaId,
            patientId: this.patientId,
            criteriaName: value,
          });
        }
      } else {
        // ═══════════════════════════════════════════════════════════════════
        // CASE 2: NEW CRITERIA (No criteriaId)
        // ═══════════════════════════════════════════════════════════════════
        console.log('✨ NEW CRITERIA:', value);
        createList.push(value);
      }
    });

    // If nothing changed, notify user
    if (!createList.length && !updateList.length) {
      this.showToast('No changes to save');
      return;
    }

    this.criteriaLoading = true;

    try {
      // ═══════════════════════════════════════════════════════════════════
      // PROCESS ALL UPDATES FIRST (PUT requests)
      // ═══════════════════════════════════════════════════════════════════
      for (const updatePayload of updateList) {
        console.log('🔄 Calling PUT for criteria:', updatePayload);

        await firstValueFrom(this.api.updateCriteria(updatePayload));
      }

      // ═══════════════════════════════════════════════════════════════════
      // PROCESS ALL CREATES (POST requests)
      // ═══════════════════════════════════════════════════════════════════
      if (createList.length) {
        // Remove duplicates from create list
        const uniqueList = [...new Set(createList)];

        console.log('➕ Calling POST for new criteria:', uniqueList);

        await firstValueFrom(
          this.api.createCriteria({
            patientId: this.patientId,
            criteriaNames: uniqueList,
          }),
        );
      }

      this.showToast('Symptoms saved successfully');

      // ═══════════════════════════════════════════════════════════════════
      // RESET STATE AND RELOAD
      // ═══════════════════════════════════════════════════════════════════
      this.isSaved = true;
      this.isEditMode = false;

      // Reload criteria to reflect changes
      await this.loadCriteria();
    } catch (err) {
      console.error('Save criteria error:', err);
      this.showToast('Save failed. Please try again.');
    } finally {
      this.criteriaLoading = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD MEDICINES
  // ─────────────────────────────────────────────────────────────────────────

  async loadMedicines() {
    try {
      const res: any = await firstValueFrom(
        this.api.getAllMedicines(1, 100, ''),
      );

      console.log('MED API RESPONSE:', res);

      this.medicines = res?.data?.items || [];

      console.log('MED LIST:', this.medicines);
    } catch (err) {
      console.error('Medicine load error', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADD NEW MEDICINE (Dialog-based)
  // ─────────────────────────────────────────────────────────────────────────

  async addNewMedicine() {
    const medicineName = prompt('Enter medicine name:');

    if (!medicineName || !medicineName.trim()) {
      this.showToast('Medicine name cannot be empty');
      return;
    }

    this.creatingMedicine = true;

    try {
      const payload = {
        name: medicineName.trim(),
        strength: '',
        dosageForm: 'Tablet',
        stockQuantity: 0,
        unit: 'Piece',
        batchNumber: '',
        expiryDate: new Date().toISOString(),
        notes: 'Added from prescription',
      };

      console.log('Creating medicine:', payload);

      const res: any = await firstValueFrom(this.api.createMedicine(payload));

      console.log('Medicine created:', res);

      const newMedicine = res?.data || res;

      // Add to medicines list
      this.medicines.unshift(newMedicine);

      this.showToast('Medicine created successfully!');

      // Reload medicines to be sure
      await this.loadMedicines();
    } catch (err) {
      console.error('Create medicine error:', err);
      this.showToast('Failed to create medicine. Please try again.');
    } finally {
      this.creatingMedicine = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ON MEDICINE CHANGE (Dropdown)
  // Handles adding new medicine from dropdown selection
  // ─────────────────────────────────────────────────────────────────────────

  async onMedicineChange(event: any, index: number) {
    const value = event.target.value;

    if (value !== 'add_new') return;

    const name = prompt('Enter medicine name');

    if (!name || !name.trim()) {
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        strength: '',
        dosageForm: 'Tablet',
        stockQuantity: 0,
        unit: 'Piece',
        batchNumber: '',
        expiryDate: new Date().toISOString(),
        notes: 'Added from prescription',
      };

      const res: any = await firstValueFrom(this.api.createMedicine(payload));

      const newMed = res?.data || res;

      // add to list
      this.medicines.push(newMed);

      // auto select
      this.prescriptions[index].medicineId = newMed.medicineId;

      this.showToast('Medicine added successfully');
    } catch (err) {
      console.error(err);
      this.showToast('Failed to add medicine');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADD MEDICINE ROW TO PRESCRIPTION TABLE
  // ─────────────────────────────────────────────────────────────────────────

  addMedicineRow() {
    this.prescriptions.push({
      medicineId: null,
      dosage: '',
      frequency: '',
      duration: '',
      type: '',
      instructions: '',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REMOVE MEDICINE ROW FROM PRESCRIPTION TABLE
  // ─────────────────────────────────────────────────────────────────────────

  removeMedicineRow(index: number) {
    this.prescriptions.splice(index, 1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD STATUS RECORDS FOR FOLLOW-UP ENTRY
  // Maps symptom values to their status ratings
  // ─────────────────────────────────────────────────────────────────────────

  buildStatusRecords() {
    console.log('SYMPTOMS ARRAY:', this.symptomsArray);
    console.log('SYMPTOM STATUS:', this.symptomStatus);

    const records: any[] = [];

    this.symptomsArray.forEach((sym) => {
      if (!sym.criteriaId) return;

      records.push({
        patientFollowUpStatusId: 0,
        patientFollowUpCriteriaId: sym.criteriaId,
        criteriaName: sym.value,
        remarks: String(this.symptomStatus[sym.index] || ''),
      });
    });

    return records;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATE SYMPTOM STATUS INPUT
  // Ensures value is between 1-10
  // ─────────────────────────────────────────────────────────────────────────

  validateSymptom(event: any, index: number) {
    const value = event.target.value;
    this.symptomStatus[index] = value;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WAVE OFF CHANGE
  // ─────────────────────────────────────────────────────────────────────────

  onWaveOffChange(value: string) {
    if (value === 'yes') {
      this.waveOffSelected = true;

      if (!this.waveOffVerified) {
        this.showPasswordModal = true;
      }
    } else {
      this.waveOffSelected = false;
      this.waveOffVerified = false;
      this.waveOffAmount = 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASSWORD MODAL
  // ─────────────────────────────────────────────────────────────────────────

  closePasswordModal() {
    this.showPasswordModal = false;
    this.adminPassword = '';
  }

  async verifyAdminPassword() {
    if (!this.adminPassword) {
      this.showToast('Password required');
      return;
    }

    try {
      await firstValueFrom(
        this.api.verifyAdminPassword({
          password: this.adminPassword,
        }),
      );

      this.waveOffVerified = true;

      this.showPasswordModal = false;

      this.showToast('Password verified');
    } catch (err) {
      console.error(err);

      this.showToast('Invalid password');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE FOLLOW-UP (Main save function)
  // Orchestrates the entire follow-up flow:
  // 1. Save/Update criteria (symptoms)
  // 2. Create follow-up entry
  // 3. Save prescriptions
  // 4. Update appointment status
  // 5. Create payment
  // 6. Schedule next appointment (if applicable)
  // ─────────────────────────────────────────────────────────────────────────

  async saveFollowUp() {
    console.log('===== SAVE FOLLOW-UP STARTED =====');
    console.log('PATIENT ID:', this.patientId);
    console.log('APPOINTMENT ID:', this.currentAppointmentId);

    try {
      // ═════════════════════════════════════════════════════════════════════
      // 0️⃣ CREATE / UPDATE CRITERIA (Symptoms)
      // ═════════════════════════════════════════════════════════════════════

      console.log('\n📋 STEP 0: SAVE CRITERIA (SYMPTOMS)');

      const createList: string[] = [];
      const updateList: any[] = [];

      this.fuSymptomsArr.controls.forEach((ctrl: any) => {
        const value = ctrl.getRawValue().trim();
        if (!value) return;

        const criteriaId = ctrl.criteriaId;

        if (criteriaId) {
          const existing = this.existingCriteria.find(
            (x: any) => x.patientFollowUpCriteriaId === criteriaId,
          );

          if (existing && existing.criteriaName !== value) {
            console.log('  → Updating criteria:', value);

            updateList.push({
              patientFollowUpCriteriaId: criteriaId,
              patientId: this.patientId,
              criteriaName: value,
            });
          }
        } else {
          console.log('  → Creating new criteria:', value);
          createList.push(value);
        }
      });

      // Update existing criteria
      for (const updatePayload of updateList) {
        console.log('  🔄 PUT request for:', updatePayload);

        await firstValueFrom(this.api.updateCriteria(updatePayload));
      }

      // Create new criteria
      if (createList.length) {
        const uniqueList = [...new Set(createList)];

        console.log('  ➕ POST request for:', uniqueList);

        await firstValueFrom(
          this.api.createCriteria({
            patientId: this.patientId,
            criteriaNames: uniqueList,
          }),
        );
      }

      console.log('✓ Criteria saved successfully');

      // ═════════════════════════════════════════════════════════════════════
      // 1️⃣ CREATE FOLLOWUP ENTRY
      // ═════════════════════════════════════════════════════════════════════

      console.log('\n📝 STEP 1: CREATE FOLLOW-UP ENTRY');

      const followUpPayload = {
        patientFollowUpEntryId: 0,
        patientId: this.patientId,
        appointmentId: this.currentAppointmentId,
        followUpDate: new Date().toISOString(),
        interpretation: this.interpretation,
        temporaryProblems: this.temporaryProblems,
        charge: this.consultationCharge,
        statusRecords: this.buildStatusRecords(),
      };

      console.log('Follow-up payload:', followUpPayload);
      console.log('Status records:', followUpPayload.statusRecords);

      await firstValueFrom(this.api.createFollowUp(followUpPayload));

      console.log('✓ Follow-up entry created');

      // ═════════════════════════════════════════════════════════════════════
      // 2️⃣ SAVE PRESCRIPTIONS
      // ═════════════════════════════════════════════════════════════════════

      console.log('\n💊 STEP 2: SAVE PRESCRIPTIONS');

      for (const med of this.prescriptions) {
        console.log('Medicine:', med);

        if (!med.medicineId) {
          console.log('  ⊘ Skipped (no medicine selected)');
          continue;
        }

        const payload = {
          appointmentId: this.currentAppointmentId,
          medicineId: Number(med.medicineId),
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          type: med.type || 'Capsule',
          instructions: med.instructions,
        };

        console.log('  Prescription payload:', payload);

        await firstValueFrom(this.api.addPrescription(payload));
      }

      console.log('✓ Prescriptions saved');

      // ═════════════════════════════════════════════════════════════════════
      // 3️⃣ UPDATE APPOINTMENT STATUS
      // ═════════════════════════════════════════════════════════════════════

      console.log('\n📅 STEP 3: UPDATE APPOINTMENT STATUS');

      await firstValueFrom(
        this.api.updateAppointmentStatus(this.currentAppointmentId, {
          status: 3,
        }),
      );

      console.log('✓ Appointment status updated to 3 (completed)');

      // ═════════════════════════════════════════════════════════════════════
      // 4️⃣ CREATE PAYMENT
      // ═════════════════════════════════════════════════════════════════════

      console.log('\n💰 STEP 4: CREATE PAYMENT');

  const consultation = parseFloat(String(this.consultationCharge)) || 0;
const waveOff = parseFloat(String(this.waveOffAmount)) || 0;

console.log("CONSULTATION INPUT:", consultation);
console.log("WAVE OFF INPUT:", waveOff);

      if (waveOff > consultation) {
        this.showToast('Wave off cannot exceed consultation charges');
        return;
      }

      // const paymentPayload: any = {
      //   patientId: this.patientId,
      //   appointmentId: this.currentAppointmentId,
      //   consultationCharges: consultation,
      //   waveOffAmount: waveOff,
      //   amountPaid: consultation - waveOff,
      //   waveOffPassword: this.adminPassword,
      // };

      const paymentPayload: any = {
  patientId: this.patientId,
  appointmentId: this.currentAppointmentId,
  consultationCharges: Math.round(consultation),
  waveOffAmount: Math.round(waveOff),
  amountPaid: Math.round(consultation - waveOff),
  waveOffPassword: this.adminPassword,
};

      console.log('Payment payload:', paymentPayload);

      await firstValueFrom(this.api.createPayment(paymentPayload));

      console.log('✓ Payment created');

      // ═════════════════════════════════════════════════════════════════════
      // 5️⃣ CREATE NEXT APPOINTMENT (Optional)
      // ═════════════════════════════════════════════════════════════════════

      console.log('\n🔔 STEP 5: SCHEDULE NEXT APPOINTMENT');

      if (this.nextAppointmentDate && this.nextAppointmentTime) {
        await firstValueFrom(
          this.api.createAppointment({
            patientId: this.patientId,
            appointmentDate: this.nextAppointmentDate,
            appointmentTime: this.nextAppointmentTime,
            remark: 'Follow up',
          }),
        );

        console.log('✓ Next appointment scheduled');
      } else {
        console.log('⊘ No next appointment scheduled');
      }

      // ═════════════════════════════════════════════════════════════════════
      // SUCCESS
      // ═════════════════════════════════════════════════════════════════════

      this.showToast('Follow-Up saved successfully');

      console.log('===== SAVE FOLLOW-UP COMPLETED SUCCESSFULLY =====');

      // Navigate to payment page
      this.router.navigate(['../payment'], {
        relativeTo: this.route,
        queryParams: {
          patientId: this.patientId,
          appointmentId: this.currentAppointmentId,
          tab: 'payment',
        },
        queryParamsHandling: 'merge',
      });
    } catch (err) {
      console.error('===== SAVE FOLLOW-UP ERROR =====', err);
      this.showToast('Save failed. Please check the console for details.');
      return;
    }
  }

onConsultationChange(value: any) {
  const num = parseFloat(value);
  this.consultationCharge = isNaN(num) ? 0 : num;
}

onWaveOffAmountChange(value: any) {
  const num = parseFloat(value);
  this.waveOffAmount = isNaN(num) ? 0 : num;
}
  // ─────────────────────────────────────────────────────────────────────────
  // TOAST NOTIFICATION
  // ─────────────────────────────────────────────────────────────────────────

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
      color: 'dark',
    });

    await toast.present();
  }
}
