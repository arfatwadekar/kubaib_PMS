import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormArray, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { FollowUpService } from 'src/app/services/follow-up.service';
import { getErrorMessage } from 'src/app/shared/utils/error-message.util';

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
  role: 'Doctor' | 'Receptionist' = 'Receptionist';
  isReadonly = false;
  showMedicineModal = false;
  newMedicineName = '';
  selectedMedicineIndex: number | null = null;

  today = new Date();
  todayDate: string = '';
  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE PROPERTIES
  // ─────────────────────────────────────────────────────────────────────────
  showPasswordModal = false;
  interpretation = '';
  observationsAndSymptoms = '';
  waveOffSelected = false;
  symptomStatus: string[] = [];

  consultationCharge = 0;
  waveOffAmount = 0;
  pendingBalance = 0; // balance carried over from previous visits

  nextAppointmentDate: string | null = null;
  nextAppointmentTime: string | null = null;

  currentAppointmentId!: number;

  prescriptions: any[] = [];
  isDeletingPrescription = false;

  adminPassword = '';

  waveOffVerified = false;

  isFollowUpAlreadySaved = false;
  appointmentStatus: string = '';
  isFollowUpEditMode = false;
  existingFollowUpEntryId: number | null = null;
  private savedStatusRecords: any[] = [];

  medicines: any[] = [];
  patientId!: number;
  creatingMedicine = false;

  isFirstVisit = true;
  isSaved = false;
  isEditMode = false;
  criteriaLoading = false;

  existingCriteria: any[] = [];

  summaryList: any[] = [];
  // ─── Patient Summary / History ───────────────────────────────────────────
  summaryHistory: any[] = [];
  summaryPage = 1;
  summaryPageSize = 10;
  summaryTotalPages = 0;
  summaryTotalCount = 0;
  summaryLoading = false;

  fromList = false; 

  private destroy$ = new Subject<void>();

  // ─── Auto-save ───────────────────────────────────────────────────────────
  private autosaveKey = '';
  private autosave$ = new Subject<void>();
  private formDirty = false;
  private beforeUnloadHandler = () => {
    if (this.formDirty) {
      this.saveDraft();
    }
  };

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
      .filter(
        (item) => item.value && item.value.trim() !== '' && item.criteriaId,
      );
  }
  get isAppointmentEditable(): boolean {
    return ['Pending', 'InPatient', 'AwaitingPayment'].includes(
      this.appointmentStatus,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE HOOKS
  // ─────────────────────────────────────────────────────────────────────────

  async ngOnInit() {
    this.loadRole();
    const patientParam = this.route.snapshot.queryParamMap.get('patientId');

    this.patientId = patientParam ? Number(patientParam) : 0;

    this.fromList = this.route.snapshot.queryParamMap.get('from') === 'list';

    console.log('PATIENT ID:', this.patientId);

    if (!this.patientId || isNaN(this.patientId)) {
      this.showToast('Invalid patient ID');
      return;
    }

    const apptParam = this.route.snapshot.queryParamMap.get('appointmentId');
    if (apptParam && Number(apptParam)) {
      this.currentAppointmentId = Number(apptParam);
    }
    // 1️⃣ Load current appointment
    //await this.loadCurrentAppointment();

    // 2️⃣ Load summary
    await this.loadSummary();

    // 2️⃣b Load patient appointment history
    await this.loadPatientSummary();
    // 3️⃣ Initialize form rows
    this.initRows();
    this.listenExpansion();

    // 4️⃣ Load existing criteria (symptoms from first visit)
    await this.loadCriteria();

    // 5️⃣ Load medicines
    this.loadMedicines();

    // 6️⃣ Add default medicine row
    this.addMedicineRow();

    const today = new Date();

    // format: yyyy-MM-dd (IMPORTANT ⚠️)
    this.todayDate = today.toISOString().split('T')[0];
    this.setupAutosave();
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  ngOnDestroy() {
    // Flush any pending debounced autosave immediately — otherwise a quick
    // tab switch within the 1s debounce window drops the draft, since the
    // debounce timer is cancelled by takeUntil(destroy$) below before it fires.
    if (this.formDirty) {
      this.saveDraft();
    }
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
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
      this.showToast(getErrorMessage(err, 'Failed to load appointment'));
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

      this.appointmentStatus = res?.status || '';
      this.existingFollowUpEntryId =
        res?.followUpEntry?.patientFollowUpEntryId || null;

      if (this.existingFollowUpEntryId) {
        this.isFollowUpAlreadySaved = true;
        this.interpretation = res?.followUpEntry?.interpretation || '';
        this.observationsAndSymptoms =
          res?.followUpEntry?.observationsAndSymptoms || '';
        this.consultationCharge = Number(res?.followUpEntry?.charge || 0);
        this.waveOffAmount = Number(res?.payment?.waveOffAmount || 0);
        this.waveOffSelected = this.waveOffAmount > 0;
        this.savedStatusRecords = res?.followUpEntry?.statusRecords || [];

        // ── Prescriptions ──────────────────────────────────────────────
        if (res?.prescribedMedicines?.length) {
          this.prescriptions = res?.prescribedMedicines?.length
            ? res.prescribedMedicines.map((med: any) => ({
                prescribedMedicineId: med.prescribedMedicineId ?? null, // ← ADD THIS
                medicineId: med.medicineId,
                dosage: med.dosage || '',
                frequency: med.frequency || '',
                duration: med.duration || '',
                type: med.type || 'Tablet',
                instructions: med.instructions || '',
              }))
            : [];
        }
      } else {
        if (res?.payment?.consultationCharges && !this.consultationCharge) {
          this.consultationCharge = Number(res.payment.consultationCharges);
        }
      }
    } catch (err) {
      console.error('Summary load error:', err);
    }

    try {
      const balanceRes: any = await firstValueFrom(
        this.api.getBalance(this.patientId),
      );
      this.pendingBalance = Math.max(0, Number(balanceRes?.pendingBalance ?? 0));
    } catch (err) {
      console.error('Balance load error:', err);
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
  trackBySymIndex(index: number, sym: any): number {
    return sym.index;
  }
  // Helper to get criteriaId from a control by index (avoids template type error)
  getCriteriaId(index: number): number | undefined {
    return (this.fuSymptomsArr.at(index) as any).criteriaId;
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

      // ── Populate symptomStatus from saved DB records ──────────────────
      if (this.savedStatusRecords.length) {
        this.fuSymptomsArr.controls.forEach((ctrl: any, i) => {
          const record = this.savedStatusRecords.find(
            (r: any) => r.patientFollowUpCriteriaId === ctrl.criteriaId,
          );
          if (record) {
            this.symptomStatus[i] = record.remarks || '';
          }
        });
        console.log('✓ Symptom status restored from saved records');
      }

      console.log('✓ CRITERIA LOADED FOR REVISIT');
      console.log('Criteria count:', this.existingCriteria.length);
      console.log('Existing criteria:', this.existingCriteria);
    } catch (err) {
      console.error('Load criteria error:', err);
      this.showToast(getErrorMessage(err, 'Failed to load symptoms'));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ENABLE EDIT MODE
  // Unlock all disabled controls so user can edit existing symptoms
  // ─────────────────────────────────────────────────────────────────────────

  enableEdit() {
     if (this.isReadonly) return; 
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
  // ENABLE FOLLOW-UP EDIT MODE
  // Allows editing symptom status, interpretation, charge, waveoff
  // ─────────────────────────────────────────────────────────────────────────

  enableFollowUpEdit() {
     if (this.isReadonly) return; 
    this.isFollowUpEditMode = true;
    this.showToast('You can now modify the follow-up entry.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE FOLLOW-UP EDIT
  // Calls PUT /api/FollowUp to update existing entry + payment
  // ─────────────────────────────────────────────────────────────────────────

  async saveFollowUpEdit() {
    if (!this.isFollowUpFormValid()) {
      this.showToast('Please fill all required fields.');
      return;
    }

    const consultation = parseFloat(String(this.consultationCharge)) || 0;
    const waveOff = parseFloat(String(this.waveOffAmount)) || 0;
    const overallCharges = consultation + this.pendingBalance;

    if (waveOff > overallCharges) {
      this.showToast('Wave off cannot exceed overall charges');
      return;
    }

    try {
      // ── 1. Update follow-up entry (status records + interpretation + charge)
      const followUpPayload = {
        patientFollowUpEntryId: this.existingFollowUpEntryId,
        patientId: this.patientId,
        appointmentId: this.currentAppointmentId,
        followUpDate: new Date().toISOString(),
        interpretation: this.interpretation,
        observationsAndSymptoms: this.observationsAndSymptoms,
        charge: consultation,
        statusRecords: this.buildStatusRecords(),
      };

      await firstValueFrom(this.api.updateFollowUp(followUpPayload as any));
      console.log('✓ Follow-up entry updated');

      // ── 2. ✅ UPDATE PRESCRIPTIONS (was completely missing) ───────────
      console.log('💊 Updating prescriptions...');
      for (const med of this.prescriptions) {
        if (!med.medicineId) {
          console.log('Skipped — no medicine selected');
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

        console.log('Prescription payload:', payload);
        await firstValueFrom(this.api.addPrescription(payload));
      }
      console.log('✓ Prescriptions updated');

      // ── 3. Update payment (consultation charge + waveoff)
      const paymentPayload: any = {
        patientId: this.patientId,
        appointmentId: this.currentAppointmentId,
        consultationCharges: consultation,
        waveOffAmount: waveOff,
        waveOffPassword: this.adminPassword,
      };

      await firstValueFrom(this.api.createPayment(paymentPayload));
      console.log('✓ Payment updated');

      this.isFollowUpEditMode = false;
      this.clearDraft();
      this.showToast('Follow-up updated successfully.');

      // Reload summary to get fresh data
      await this.loadSummary();
      await this.loadPatientSummary();
    } catch (err: any) {
      console.error('Update follow-up error:', err);
      this.showToast(getErrorMessage(err, 'Update failed.'));
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // DELETE CRITERIA ROW
  // Calls DELETE API then removes the row from the form array
  // ─────────────────────────────────────────────────────────────────────────

  async deleteCriteria(index: number) {
      if (this.isReadonly) return;
    const ctrl = this.fuSymptomsArr.at(index) as any;
    const criteriaId = ctrl.criteriaId;

    // Should never reach here without criteriaId (button is hidden for those)
    // but guard anyway
    if (!criteriaId) return;

    this.criteriaLoading = true;

    try {
      await firstValueFrom(this.api.deleteCriteria(criteriaId));

      this.showToast('Symptom deleted successfully');

      await this.loadCriteria();
    } catch (err: any) {
      console.error('Delete criteria error:', err);
      this.showToast(getErrorMessage(err, 'Failed to delete symptom'));
    } finally {
      this.criteriaLoading = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE CRITERIA (For Initial Creation & Revisit Updates)
  // This handles:
  // 1. Creating new symptoms on first visit
  // 2. Updating existing symptoms on revisit
  // 3. Adding new symptoms on revisit
  // ─────────────────────────────────────────────────────────────────────────

  async saveCriteria() {
      if (this.isReadonly) return;
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
      this.showToast(getErrorMessage(err, 'Save failed. Please try again.'));
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

  // ─────────────────────────────────────────────────────────────────────────
  // ON MEDICINE CHANGE (Dropdown)
  // Handles adding new medicine from dropdown selection
  // ─────────────────────────────────────────────────────────────────────────

  //  async onMedicineChange(event: any, index: number) {
  //   const value = event.target.value;

  //   if (value === 'add_new') {
  //     this.openMedicineModal(index); // ✅ modal open
  //   }
  // }
  async onMedicineChange(event: any, index: number) {
    const value = event.target.value;

    if (value === 'add_new') {
      this.prescriptions[index].medicineId = null; // reset model
      event.target.value = null; // reset DOM select
      this.openMedicineModal(index);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADD MEDICINE ROW TO PRESCRIPTION TABLE
  // ─────────────────────────────────────────────────────────────────────────

  // addMedicineRow() {
  //   this.prescriptions.push({
  //     medicineId: null,
  //     dosage: '',
  //     frequency: '',
  //     duration: '',
  //     type: '',
  //     instructions: '',
  //   });
  // }

  addMedicineRow() {
    if (this.isReadonly) return;
    this.prescriptions.push({
      medicineId: null,
      dosage: '',
      frequency: '',
      duration: '',
      type: '',
      instructions: '',
    });
    // No auto-open modal here — that was never the issue
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REMOVE MEDICINE ROW FROM PRESCRIPTION TABLE
  // ─────────────────────────────────────────────────────────────────────────

  async removeMedicineRow(index: number) {
      if (this.isReadonly) return;
    const med = this.prescriptions[index];

    if (!med.prescribedMedicineId) {
      // New unsaved row — just remove from UI and re-save draft
      this.prescriptions.splice(index, 1);
      this.saveDraft(); // ✅ update draft
      return;
    }

    this.isDeletingPrescription = true;
    try {
      await firstValueFrom(
        this.api.deletePrescription(med.prescribedMedicineId),
      );
      console.log('✅ Prescription deleted from DB:', med.prescribedMedicineId);

      this.prescriptions.splice(index, 1); // remove from UI array
      this.saveDraft(); // ✅ re-save draft WITHOUT this medicine

      this.showToast('Medicine removed.');
    } catch (err: any) {
      console.error('DELETE API failed:', err);
      this.showToast(getErrorMessage(err, 'Failed to delete prescription.'));
      // ❌ Do NOT splice or update draft — medicine stays
    } finally {
      this.isDeletingPrescription = false;
    }
  }

  goToMedical() {
    this.router.navigate(['/patients/medical'], {
      queryParams: {
        patientId: this.patientId,
        appointmentId: this.currentAppointmentId,
        tab: 'medical',
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD STATUS RECORDS FOR FOLLOW-UP ENTRY
  // Maps symptom values to their status ratings
  // ─────────────────────────────────────────────────────────────────────────

  buildStatusRecords() {
    console.log('SYMPTOMS ARRAY:', this.symptomsArray);
    console.log('SYMPTOM STATUS:', this.symptomStatus);
    console.log('SAVED STATUS RECORDS:', this.savedStatusRecords);

    const records: any[] = [];

    this.symptomsArray.forEach((sym) => {
      if (!sym.criteriaId) return;

      // Look up existing status record to get the real patientFollowUpStatusId
      const existing = this.savedStatusRecords.find(
        (r: any) => r.patientFollowUpCriteriaId === sym.criteriaId,
      );

      records.push({
        patientFollowUpStatusId: existing?.patientFollowUpStatusId ?? 0,
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
    if (this.isReadonly) return;
    const value = event.target.value;
    this.symptomStatus[index] = value;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WAVE OFF CHANGE
  // ─────────────────────────────────────────────────────────────────────────

  onWaveOffChange(value: string) {
    if (this.isReadonly) return;
    if (value === 'yes') {
      this.waveOffSelected = true;

      if (!this.waveOffVerified) {
        this.showPasswordModal = true;
        this.adminPassword = '';
      }
    } else {
      this.waveOffSelected = false;
      this.waveOffVerified = false;
      this.waveOffAmount = 0;
      this.adminPassword = '';
    }
    this.triggerAutosave();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASSWORD MODAL
  // ─────────────────────────────────────────────────────────────────────────

  // closePasswordModal() {
  //   this.showPasswordModal = false;
  //   this.adminPassword = '';
  // }

  // AFTER
  closePasswordModal() {
    this.showPasswordModal = false;
    this.adminPassword = '';

    // If password not verified, revert wave-off selection back to No
    if (!this.waveOffVerified) {
      this.waveOffSelected = false;
      this.waveOffAmount = 0;
    }
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

      this.adminPassword = '';
      this.showToast(getErrorMessage(err, 'Invalid password'));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK IF FOLLOW-UP FORM IS VALID
  // Used to enable/disable save button
  // ─────────────────────────────────────────────────────────────────────────

  // isFollowUpFormValid(): boolean {
  //   // Check if at least one symptom exists
  //   if (this.symptomsArray.length === 0) {
  //     return false;
  //   }

  //   // Check if all symptoms have a status rating (1-10)
  //   let hasEmptyStatus = false;
  //   this.symptomsArray.forEach((sym) => {
  //     const status = this.symptomStatus[sym.index];
  //     if (!status || status.toString().trim() === '') {
  //       hasEmptyStatus = true;
  //     }
  //   });

  //   if (hasEmptyStatus) {
  //     return false;
  //   }

  //   // Check if interpretation is filled
  //   if (!this.interpretation || this.interpretation.trim() === '') {
  //     return false;
  //   }

  //   return true;
  // }

  isFollowUpFormValid(): boolean {
    // ❌ Consultation charge cannot be 0 or empty
    if (!this.consultationCharge || this.consultationCharge <= 0) {
      return false;
    }

    console.log('isFollowUpFormValid', this);

    // ✅ Check if at least ONE symptom has status
    const hasAtLeastOneStatus = this.symptomsArray.some((sym) => {
      const status = this.symptomStatus[sym.index];
      return status && status.toString().trim() !== '';
    });

    console.log('hasAtLeastOneStatus', hasAtLeastOneStatus);
    console.log('this.symptomStatus.length', this.symptomStatus.length);
    if (!hasAtLeastOneStatus && this.symptomStatus.length != 0) {
      return false;
    }

    return true;
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
    if (this.isReadonly) return;
    console.log('===== SAVE FOLLOW-UP STARTED =====');
    console.log('PATIENT ID:', this.patientId);
    console.log('APPOINTMENT ID:', this.currentAppointmentId);

    // ═════════════════════════════════════════════════════════════════════
    // VALIDATION: Check that all required fields are filled
    // ═════════════════════════════════════════════════════════════════════
    if (!this.isFollowUpFormValid()) {
      console.log('❌ VALIDATION FAILED - Form incomplete');

      if (this.symptomsArray.length === 0) {
        this.showToast('Please add at least one symptom');
      } else if (
        !this.symptomsArray.some((sym) => {
          const status = this.symptomStatus[sym.index];
          return status && status.toString().trim() !== '';
        })
      ) {
        this.showToast('Please rate at least one symptom (1-10)');
      } else if (!this.interpretation || this.interpretation.trim() === '') {
        this.showToast('Please provide interpretation');
      }

      return;
    }

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
        observationsAndSymptoms: this.observationsAndSymptoms,
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
      const overallCharges = consultation + this.pendingBalance;

      console.log('CONSULTATION INPUT:', consultation);
      console.log('WAVE OFF INPUT:', waveOff);

      if (waveOff > overallCharges) {
        this.showToast('Wave off cannot exceed overall charges');
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
        consultationCharges: consultation,
        waveOffAmount: waveOff,
        waveOffPassword: this.adminPassword,
      };

      console.log('Payment payload:', paymentPayload);

      await firstValueFrom(this.api.createPayment(paymentPayload));

      console.log('✓ Payment created');

      // ═════════════════════════════════════════════════════════════════════
      // 5️⃣ CREATE NEXT APPOINTMENT (Optional)
      // ═════════════════════════════════════════════════════════════════════

      console.log('\n🔔 STEP 5: SCHEDULE NEXT APPOINTMENT');
      if (this.nextAppointmentDate) {
        const appointmentPayload: any = {
          patientId: this.patientId,
          appointmentDate: this.nextAppointmentDate,
          remark: 'Follow up',
        };

        if (this.nextAppointmentTime) {
          appointmentPayload.appointmentTime = this.nextAppointmentTime;
        }

        await firstValueFrom(this.api.createAppointment(appointmentPayload));

        console.log('✓ Next appointment scheduled');
      } else {
        console.log('⊘ No next appointment scheduled');
      }

      // ═════════════════════════════════════════════════════════════════════
      // SUCCESS
      // ═════════════════════════════════════════════════════════════════════

      this.showToast('Follow-Up saved successfully');
      this.clearDraft();
      console.log('===== SAVE FOLLOW-UP COMPLETED SUCCESSFULLY =====');

      // Navigate to payment page
      this.router.navigate(['/patients/payment'], {
        queryParams: {
          patientId: this.patientId,
          appointmentId: this.currentAppointmentId,
          tab: 'payment',
        },
      });
    } catch (err: any) {
      console.error('===== SAVE FOLLOW-UP ERROR =====', err);
      this.showToast(getErrorMessage(err, 'Something went wrong'));
    }
  }

  onConsultationChange(value: any) {
      if (this.isReadonly) return; 
    const num = parseFloat(value);
    this.consultationCharge = isNaN(num) ? 0 : num;
  }

  onWaveOffAmountChange(value: any) {
      if (this.isReadonly) return; 
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

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD PATIENT APPOINTMENT SUMMARY (History list with pagination)
  // GET /api/Appointment/patient/{patientId}/summary
  // ─────────────────────────────────────────────────────────────────────────

  async loadPatientSummary(page: number = 1) {
    this.summaryLoading = true;
    try {
      const res: any = await firstValueFrom(
        this.api.getPatientAppointmentSummary(
          this.patientId,
          page,
          this.summaryPageSize,
        ),
      );

      console.log('PATIENT SUMMARY HISTORY:', res);

      this.summaryHistory = res?.appointments || [];
      this.summaryPage = res?.page || 1;
      this.summaryTotalPages = res?.totalPages || 0;
      // this.summaryTotalCount = res?.totalCount || 0;

      this.summaryHistory = res?.appointments || [];
      this.summaryTotalCount = this.summaryHistory.length;

      console.log(this.currentAppointmentId);
      console.log(this.summaryHistory);
      console.log('Follow-up already saved:', this.isFollowUpAlreadySaved);
    } catch (err) {
      console.error('Patient summary load error:', err);
      this.showToast(getErrorMessage(err, 'Failed to load appointment history'));
    } finally {
      this.summaryLoading = false;
    }
  }

  onSummaryPageChange(page: number) {
    if (page < 1 || page > this.summaryTotalPages) return;
    this.loadPatientSummary(page);
  }
  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-SAVE: SETUP
  // ─────────────────────────────────────────────────────────────────────────
  private setupAutosave() {
    this.autosaveKey = `draft_followup_${this.patientId}_${this.currentAppointmentId}`;

    // Load draft first
    this.loadDraft();

    // Save on every trigger with 1 second debounce
    this.autosave$
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => this.saveDraft());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-SAVE: SAVE DRAFT TO LOCALSTORAGE
  // ─────────────────────────────────────────────────────────────────────────
  private saveDraft() {
    const draft = {
      interpretation: this.interpretation,
      observationsAndSymptoms: this.observationsAndSymptoms,
      consultationCharge: this.consultationCharge,
      waveOffAmount: this.waveOffAmount,
      waveOffSelected: this.waveOffSelected,
      waveOffVerified: this.waveOffVerified,
      nextAppointmentDate: this.nextAppointmentDate,
      nextAppointmentTime: this.nextAppointmentTime,
      prescriptions: this.prescriptions,
      symptomStatus: this.symptomStatus,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(this.autosaveKey, JSON.stringify(draft));
      console.log('Draft saved silently at', draft.savedAt);
    } catch (err) {
      console.error('Draft save failed:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-SAVE: LOAD DRAFT FROM LOCALSTORAGE
  // ─────────────────────────────────────────────────────────────────────────
  private loadDraft() {
    const raw = localStorage.getItem(this.autosaveKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      this.interpretation = draft.interpretation ?? this.interpretation;
      this.observationsAndSymptoms =
        draft.observationsAndSymptoms ?? this.observationsAndSymptoms;
      this.consultationCharge =
        draft.consultationCharge ?? this.consultationCharge;
      this.waveOffAmount = draft.waveOffAmount ?? this.waveOffAmount;
      this.waveOffSelected = draft.waveOffSelected ?? false;
      this.waveOffVerified = draft.waveOffVerified ?? false;
      this.nextAppointmentDate = draft.nextAppointmentDate ?? null;
      this.nextAppointmentTime = draft.nextAppointmentTime ?? null;
      this.symptomStatus = draft.symptomStatus ?? this.symptomStatus;

      // ✅ SMART MERGE — preserve new unsaved rows, but always use prescribedMedicineId from API
      if (draft.prescriptions?.length) {
        const apiPrescriptions = this.prescriptions ?? []; // already loaded by loadSummary()

        this.prescriptions = draft.prescriptions.map((draftMed: any) => {
          // Try to find a matching row in API data by medicineId
          const apiMatch = apiPrescriptions.find(
            (apiMed: any) =>
              Number(apiMed.medicineId) === Number(draftMed.medicineId),
          );

          return {
            ...draftMed,
            // If API has this medicine, use its real prescribedMedicineId
            // If it's a new unsaved row, prescribedMedicineId stays null
            prescribedMedicineId: apiMatch?.prescribedMedicineId ?? null,
          };
        });
      }

      console.log('Draft restored:', draft.savedAt);
      console.log('Merged prescriptions:', this.prescriptions);
    } catch {
      localStorage.removeItem(this.autosaveKey);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-SAVE: CLEAR DRAFT FROM LOCALSTORAGE
  // ─────────────────────────────────────────────────────────────────────────
  private clearDraft() {
    localStorage.removeItem(this.autosaveKey);
    this.formDirty = false;
    console.log('Draft cleared from localStorage');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-SAVE: TRIGGER
  // Call this from every field change
  // ─────────────────────────────────────────────────────────────────────────
  triggerAutosave() {
    this.formDirty = true;
    this.autosave$.next();
  }
  onInterpretationChange(value: string) {
    if (!value) {
      this.interpretation = '';
      return;
    }

    // 1. Collapse blank lines (keeps single line breaks between medicines intact)
    let cleaned = value.replace(/\n[ \t]*\n/g, '\n');

    // 2. Replace repeated spaces/tabs within a line with a single space
    cleaned = cleaned.replace(/[ \t]+/g, ' ');

    // 3. Trim trailing spaces at end of each line, then trim start/end
    cleaned = cleaned
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n')
      .trim();

    // 4. Enforce max length (extra safety)
    if (cleaned.length > 2000) {
      cleaned = cleaned.substring(0, 2000);
    }

    this.interpretation = cleaned;
    this.triggerAutosave();
  }

  onObservationsChange(value: string) {
    if (this.isReadonly) return;
    let cleaned = (value || '').replace(/[ \t]+$/gm, '');
    if (cleaned.length > 2000) {
      cleaned = cleaned.substring(0, 2000);
    }
    this.observationsAndSymptoms = cleaned;
    this.triggerAutosave();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MEDICINE & INTERPRETATION — AUTO NUMBERING
  // Pressing Enter continues the numbered list (1. 2. 3. …); pressing Enter
  // on an empty numbered line exits the list instead of adding another number.
  // ─────────────────────────────────────────────────────────────────────────

  onInterpretationFocus(event: FocusEvent) {
    if (this.isReadonly) return;
    const textarea = event.target as HTMLTextAreaElement;
    if (textarea.disabled) return;

    if (!this.interpretation || !this.interpretation.trim()) {
      // Update the DOM synchronously (not via setTimeout) so the cursor lands
      // in the right place before any further keystrokes can arrive — relying
      // on Angular's async change detection alone here races with fast typing.
      const seed = '1. ';
      textarea.value = seed;
      textarea.setSelectionRange(seed.length, seed.length);
      this.interpretation = seed;
    }
  }

  onInterpretationKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || this.isReadonly) return;
    const textarea = event.target as HTMLTextAreaElement;
    if (textarea.disabled) return;

    event.preventDefault();

    const cursorPos = textarea.selectionStart ?? textarea.value.length;
    const value = textarea.value;
    const before = value.slice(0, cursorPos);
    const after = value.slice(cursorPos);

    const lastNewline = before.lastIndexOf('\n');
    const lineStart = lastNewline + 1;
    const currentLine = before.slice(lineStart);
    const match = currentLine.match(/^(\d+)\.\s?(.*)$/);

    let newValue: string;
    let newCursorPos: number;

    if (match && match[2].trim() === '') {
      // Empty numbered line — exit the list instead of adding another number
      newValue = value.slice(0, lineStart) + after;
      newCursorPos = lineStart;
    } else if (match) {
      const nextNumber = parseInt(match[1], 10) + 1;
      const insertion = `\n${nextNumber}. `;
      newValue = before + insertion + after;
      newCursorPos = before.length + insertion.length;
    } else if (currentLine.trim() === '') {
      newValue = before + '\n' + after;
      newCursorPos = before.length + 1;
    } else {
      const insertion = '\n1. ';
      newValue = before + insertion + after;
      newCursorPos = before.length + insertion.length;
    }

    if (newValue.length > 2000) {
      newValue = newValue.slice(0, 2000);
      newCursorPos = Math.min(newCursorPos, newValue.length);
    }

    // Update the DOM synchronously so the value + cursor are correct before
    // any further keystrokes can arrive (see onInterpretationFocus for why).
    textarea.value = newValue;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    this.interpretation = newValue;
    this.triggerAutosave();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MEDICINE & INTERPRETATION — PASTE AS NUMBERED LIST
  // Pasted text (already numbered, or one note per line) is normalized into
  // a clean sequential 1. 2. 3. … list instead of dumping raw clipboard text.
  // ─────────────────────────────────────────────────────────────────────────

  onInterpretationPaste(event: ClipboardEvent) {
    if (this.isReadonly) return;
    const textarea = event.target as HTMLTextAreaElement;
    if (textarea.disabled) return;

    const pasted = event.clipboardData?.getData('text/plain');
    if (!pasted || !pasted.trim()) return;

    const items = this.splitIntoListItems(pasted);
    if (!items.length) return;

    event.preventDefault();

    const value = textarea.value;
    const isEmptyPlaceholder = value.trim() === '1.';

    const cursorPos = isEmptyPlaceholder
      ? 0
      : (textarea.selectionStart ?? value.length);
    const selEnd = isEmptyPlaceholder
      ? 0
      : (textarea.selectionEnd ?? cursorPos);

    const before = isEmptyPlaceholder ? '' : value.slice(0, cursorPos);
    const after = isEmptyPlaceholder ? '' : value.slice(selEnd);

    // Continue numbering from the last numbered line before the cursor
    const numberedLineRe = /^(\d+)\.\s/gm;
    let lastNumber: number | null = null;
    let lineMatch: RegExpExecArray | null;
    while ((lineMatch = numberedLineRe.exec(before))) {
      lastNumber = parseInt(lineMatch[1], 10);
    }
    const startNumber = lastNumber !== null ? lastNumber + 1 : 1;

    const formatted = items
      .map((item, i) => `${startNumber + i}. ${item}`)
      .join('\n');

    const needsLeadingBreak = before.length > 0 && !before.endsWith('\n');
    const needsTrailingBreak = after.length > 0 && !after.startsWith('\n');

    let newValue =
      before +
      (needsLeadingBreak ? '\n' : '') +
      formatted +
      (needsTrailingBreak ? '\n' : '') +
      after;

    let newCursorPos = (
      before +
      (needsLeadingBreak ? '\n' : '') +
      formatted
    ).length;

    if (newValue.length > 2000) {
      newValue = newValue.slice(0, 2000);
      newCursorPos = Math.min(newCursorPos, newValue.length);
    }

    textarea.value = newValue;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    this.interpretation = newValue;
    this.triggerAutosave();
  }

  // Splits pasted clipboard text into individual list items: prefers existing
  // "1. " / "1) " numbering, falls back to one item per non-empty line.
  private splitIntoListItems(text: string): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const numberedSplit = normalized
      .split(/\s*\d+[.)]\s+/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (numberedSplit.length > 1) {
      return numberedSplit;
    }

    const lineSplit = normalized
      .split('\n')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    return lineSplit.length
      ? lineSplit
      : [normalized.replace(/\s+/g, ' ').trim()];
  }

  openMedicineModal(index?: number) {
    if (this.isReadonly) return;
    this.selectedMedicineIndex = index ?? null;
    this.newMedicineName = '';
    this.showMedicineModal = true;
  }

  // closeMedicineModal() {
  //   this.showMedicineModal = false;
  //   this.newMedicineName = '';
  // }

  closeMedicineModal() {
    this.showMedicineModal = false;
    this.newMedicineName = '';

    // Reset dropdown to null only if opened from a dropdown row
    if (
      this.selectedMedicineIndex !== null &&
      this.selectedMedicineIndex >= 0
    ) {
      this.prescriptions[this.selectedMedicineIndex].medicineId = null;
    }

    this.selectedMedicineIndex = null;
  }

  async saveNewMedicine() {
    if(this.isReadonly) return;
    if (!this.newMedicineName || !this.newMedicineName.trim()) {
      this.showToast('Medicine name cannot be empty');
      return;
    }

    try {
      const payload = {
        name: this.newMedicineName.trim(),
        notes: 'Added from prescription',
      };

      const res: any = await firstValueFrom(this.api.createMedicine(payload));
      const newMed = res?.data || res;

      // list me add karo
      this.medicines.unshift(newMed);

      // auto select in row
      if (this.selectedMedicineIndex !== null) {
        this.prescriptions[this.selectedMedicineIndex].medicineId =
          newMed.medicineId;
      }

      this.showToast('Medicine added successfully');
      this.closeMedicineModal();
    } catch (err) {
      console.error(err);
      this.showToast(getErrorMessage(err, 'Failed to add medicine'));
    }
  }
  private loadRole() {
    const raw = (localStorage.getItem('mhc_role') || '').toLowerCase();
    this.role = raw === 'doctor' ? 'Doctor' : 'Receptionist';

    this.isReadonly = this.role === 'Receptionist';
  }
}
