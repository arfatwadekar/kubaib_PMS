// import { Component, OnInit, OnDestroy } from "@angular/core";
// import { FormBuilder, FormArray, FormControl } from "@angular/forms";
// import { ActivatedRoute } from "@angular/router";
// import { firstValueFrom, Subject } from "rxjs";
// import { takeUntil } from "rxjs/operators";
// import { ToastController } from "@ionic/angular";
// import { FollowUpService } from "src/app/services/follow-up.service";

// const INIT_ROWS = 10;
// const MAX_ROWS = 30;
// const AUTO_ADD_ROWS = 2;

// @Component({
//   selector: "app-followup",
//   templateUrl: "./followup.page.html",
//   styleUrls: ["./followup.page.scss"],
//   standalone: false,
// })
// export class FollowupPage implements OnInit, OnDestroy {
//   // ─────────────────────────────────────────────────────────────────────────
//   // LIFECYCLE PROPERTIES
//   // ─────────────────────────────────────────────────────────────────────────
// medicines: any[] = [];

//   patientId!: number;

//   isFirstVisit = true;
//   isSaved = false;
//   isEditMode = false;
//   criteriaLoading = false;

//   existingCriteria: any[] = [];

//   private destroy$ = new Subject<void>();

//   // ─────────────────────────────────────────────────────────────────────────
//   // FORM DEFINITION
//   // ─────────────────────────────────────────────────────────────────────────

//   fuCriteriaForm = this.fb.group({
//     symptoms: this.fb.array<FormControl<string>>([]),
//   });

//   // ─────────────────────────────────────────────────────────────────────────
//   // CONSTRUCTOR & DEPENDENCY INJECTION
//   // ─────────────────────────────────────────────────────────────────────────

//   constructor(
//     private fb: FormBuilder,
//     private route: ActivatedRoute,
//     private api: FollowUpService,
//     private toastCtrl: ToastController
//   ) {}

//   // ─────────────────────────────────────────────────────────────────────────
//   // GETTERS
//   // ─────────────────────────────────────────────────────────────────────────

//   get fuSymptomsArr(): FormArray<FormControl<string>> {
//     return this.fuCriteriaForm.get("symptoms") as FormArray<FormControl<string>>;
//   }

//   // Dynamically return number of symptoms for Follow-Up table columns
//   get symptomCount(): number {
//     return this.fuSymptomsArr.length;
//   }

//   // Create array of symptom numbers [1, 2, 3, ...] for *ngFor in template
//   get symptomsArray(): number[] {
//     return Array.from({ length: this.symptomCount }, (_, i) => i + 1);
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // LIFECYCLE HOOKS
//   // ─────────────────────────────────────────────────────────────────────────

//   ngOnInit() {
//     this.patientId = Number(
//       this.route.snapshot.queryParamMap.get("patientId")
//     );

//     if (!this.patientId || isNaN(this.patientId)) {
//       this.showToast("Invalid patient ID");
//       return;
//     }

//     this.initRows();
//     this.listenExpansion();
//     this.loadCriteria();
//       this.loadMedicines();
//   }

//   ngOnDestroy() {
//     this.destroy$.next();
//     this.destroy$.complete();
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // INITIALIZE FORM ROWS
//   // ─────────────────────────────────────────────────────────────────────────

//   private initRows() {
//     for (let i = 0; i < INIT_ROWS; i++) {
//       this.fuSymptomsArr.push(this.fb.control("", { nonNullable: true }));
//     }
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // AUTO-EXPANSION LISTENER
//   // When last row is filled, auto-add rows until MAX_ROWS
//   // ─────────────────────────────────────────────────────────────────────────

//   private listenExpansion() {
//     this.fuSymptomsArr.valueChanges
//       .pipe(takeUntil(this.destroy$))
//       .subscribe((values) => {
//         // Only expand if:
//         // 1. Data is not saved, OR
//         // 2. In edit mode (after loading criteria)
//         if (this.isSaved && !this.isEditMode) return;

//         const lastValue = values[this.fuSymptomsArr.length - 1];

//         // If last row has content and we haven't reached MAX_ROWS, add more rows
//         if (lastValue && this.fuSymptomsArr.length < MAX_ROWS) {
//           this.addRows(AUTO_ADD_ROWS);
//         }
//       });
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // ADD MORE ROWS
//   // ─────────────────────────────────────────────────────────────────────────

//   private addRows(count: number) {
//     for (let i = 0; i < count; i++) {
//       if (this.fuSymptomsArr.length >= MAX_ROWS) return;

//       this.fuSymptomsArr.push(this.fb.control("", { nonNullable: true }));
//     }
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // TRACK BY INDEX (Performance optimization)
//   // ─────────────────────────────────────────────────────────────────────────

//   trackByIndex(index: number): number {
//     return index;
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // LOAD EXISTING CRITERIA FROM SERVER
//   // ─────────────────────────────────────────────────────────────────────────

//   private async loadCriteria() {
//     try {
//       const res: any = await firstValueFrom(
//         this.api.getCriteriaByPatient(this.patientId)
//       );

//       // Handle various response formats
//       const list = Array.isArray(res) ? res : res?.data || [];

//       // If no criteria exist, this is a first visit
//       if (!list.length) {
//         this.isFirstVisit = true;
//         this.isSaved = false;
//         this.isEditMode = false;
//         return;
//       }

//       // Populate form with existing criteria
//       this.isSaved = true;
//       this.isFirstVisit = false;
//       this.isEditMode = false;

//       // Clear initial rows and load criteria
//       this.fuSymptomsArr.clear();
//       this.existingCriteria = [...list];

//       list.forEach((criteria: any) => {
//         const ctrl = this.fb.control(
//           { value: criteria.criteriaName, disabled: true },
//           { nonNullable: true }
//         );

//         // Store criteria ID on control for later identification
//         (ctrl as any).criteriaId = criteria.patientFollowUpCriteriaId;

//         this.fuSymptomsArr.push(ctrl);
//       });
//     } catch (err) {
//       console.error("Load criteria error:", err);
//       this.showToast("Failed to load symptoms");
//     }
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // SAVE OR UPDATE CRITERIA
//   // Handles both create (new) and update (existing) scenarios
//   // ─────────────────────────────────────────────────────────────────────────

//   async saveCriteria() {
//     const createList: string[] = [];
//     const updateList: any[] = [];

//     // Iterate through all controls and categorize them
//     this.fuSymptomsArr.controls.forEach((ctrl) => {
//       const value = ctrl.getRawValue().trim();

//       // Skip empty values
//       if (!value) return;

//       const criteriaId = (ctrl as any).criteriaId;

//       if (criteriaId) {
//         // Existing criteria - check if changed
//         const existing = this.existingCriteria.find(
//           (x: any) => x.patientFollowUpCriteriaId === criteriaId
//         );

//         if (existing && existing.criteriaName !== value) {
//           updateList.push({
//             patientFollowUpCriteriaId: criteriaId,
//             patientId: this.patientId,
//             criteriaName: value,
//           });
//         }
//       } else {
//         // New criteria
//         createList.push(value);
//       }
//     });

//     // If nothing changed, notify user
//     if (!createList.length && !updateList.length) {
//       this.showToast("No changes to save");
//       return;
//     }

//     this.criteriaLoading = true;

//     try {
//       // Process all updates first
//       for (const updatePayload of updateList) {
//         await firstValueFrom(this.api.updateCriteria(updatePayload));
//       }

//       // Process all creates
//       if (createList.length) {
//         // Remove duplicates from create list
//         const uniqueList = [...new Set(createList)];

//         await firstValueFrom(
//           this.api.createCriteria({
//             patientId: this.patientId,
//             criteriaNames: uniqueList,
//           })
//         );
//       }

//       this.showToast("Symptoms saved successfully");

//       // Reset state and reload
//       this.isSaved = true;
//       this.isEditMode = false;

//       await this.loadCriteria();
//     } catch (err) {
//       console.error("Save criteria error:", err);
//       this.showToast("Save failed. Please try again.");
//     } finally {
//       this.criteriaLoading = false;
//     }
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // ENABLE EDIT MODE
//   // Unlock all disabled controls so user can edit
//   // ─────────────────────────────────────────────────────────────────────────

//   enableEdit() {
//     this.isEditMode = true;

//     // Enable all controls for editing
//     this.fuSymptomsArr.controls.forEach((ctrl) => {
//       ctrl.enable();
//     });
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // TOAST NOTIFICATION
//   // ─────────────────────────────────────────────────────────────────────────

//   private async showToast(message: string) {
//     const toast = await this.toastCtrl.create({
//       message,
//       duration: 2500,
//       position: "top",
//       color: "dark",
//     });

//     await toast.present();
//   }

// async loadMedicines() {
//   try {

//     const res: any = await firstValueFrom(
//       this.api.getAllMedicines(1, 100, "")
//     );

//     console.log("MED API RESPONSE:", res);

//     this.medicines = res?.data?.items || [];

//     console.log("MED LIST:", this.medicines);

//   } catch (err) {
//     console.error("Medicine load error", err);
//   }
// }
// }



import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormBuilder, FormArray, FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { ToastController } from "@ionic/angular";
import { FollowUpService } from "src/app/services/follow-up.service";

const INIT_ROWS = 10;
const MAX_ROWS = 30;
const AUTO_ADD_ROWS = 2;

@Component({
  selector: "app-followup",
  templateUrl: "./followup.page.html",
  styleUrls: ["./followup.page.scss"],
  standalone: false,
})
export class FollowupPage implements OnInit, OnDestroy {
  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE PROPERTIES
  // ─────────────────────────────────────────────────────────────────────────
showPasswordModal = false;

adminPassword = "";

waveOffVerified = false;

  medicines: any[] = [];
  patientId!: number;
  creatingMedicine = false;

  isFirstVisit = true;
  isSaved = false;
  isEditMode = false;
  criteriaLoading = false;

  existingCriteria: any[] = [];

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
    private toastCtrl: ToastController
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────────────────────────────────

  get fuSymptomsArr(): FormArray<FormControl<string>> {
    return this.fuCriteriaForm.get("symptoms") as FormArray<FormControl<string>>;
  }

  // Get only non-empty symptoms for Follow-Up rating table
  get symptomsArray(): any[] {
    return this.fuSymptomsArr.controls
      .map((ctrl, i) => ({ index: i, value: ctrl.value }))
      .filter(item => item.value && item.value.trim() !== "");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE HOOKS
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit() {
    this.patientId = Number(
      this.route.snapshot.queryParamMap.get("patientId")
    );

    if (!this.patientId || isNaN(this.patientId)) {
      this.showToast("Invalid patient ID");
      return;
    }

    this.initRows();
    this.listenExpansion();
    this.loadCriteria();
    this.loadMedicines();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZE FORM ROWS
  // ─────────────────────────────────────────────────────────────────────────

  private initRows() {
    for (let i = 0; i < INIT_ROWS; i++) {
      this.fuSymptomsArr.push(this.fb.control("", { nonNullable: true }));
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

      this.fuSymptomsArr.push(this.fb.control("", { nonNullable: true }));
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
  // ─────────────────────────────────────────────────────────────────────────

  private async loadCriteria() {
    try {
      const res: any = await firstValueFrom(
        this.api.getCriteriaByPatient(this.patientId)
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

      // Populate form with existing criteria
      this.isSaved = true;
      this.isFirstVisit = false;
      this.isEditMode = false;

      // Clear initial rows and load criteria
      this.fuSymptomsArr.clear();
      this.existingCriteria = [...list];

      list.forEach((criteria: any) => {
        const ctrl = this.fb.control(
          { value: criteria.criteriaName, disabled: true },
          { nonNullable: true }
        );

        // Store criteria ID on control for later identification
        (ctrl as any).criteriaId = criteria.patientFollowUpCriteriaId;

        this.fuSymptomsArr.push(ctrl);
      });
    } catch (err) {
      console.error("Load criteria error:", err);
      this.showToast("Failed to load symptoms");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE OR UPDATE CRITERIA
  // Handles both create (new) and update (existing) scenarios
  // ─────────────────────────────────────────────────────────────────────────

  async saveCriteria() {
    const createList: string[] = [];
    const updateList: any[] = [];

    // Iterate through all controls and categorize them
    this.fuSymptomsArr.controls.forEach((ctrl) => {
      const value = ctrl.getRawValue().trim();

      // Skip empty values
      if (!value) return;

      const criteriaId = (ctrl as any).criteriaId;

      if (criteriaId) {
        // Existing criteria - check if changed
        const existing = this.existingCriteria.find(
          (x: any) => x.patientFollowUpCriteriaId === criteriaId
        );

        if (existing && existing.criteriaName !== value) {
          updateList.push({
            patientFollowUpCriteriaId: criteriaId,
            patientId: this.patientId,
            criteriaName: value,
          });
        }
      } else {
        // New criteria
        createList.push(value);
      }
    });

    // If nothing changed, notify user
    if (!createList.length && !updateList.length) {
      this.showToast("No changes to save");
      return;
    }

    this.criteriaLoading = true;

    try {
      // Process all updates first
      for (const updatePayload of updateList) {
        await firstValueFrom(this.api.updateCriteria(updatePayload));
      }

      // Process all creates
      if (createList.length) {
        // Remove duplicates from create list
        const uniqueList = [...new Set(createList)];

        await firstValueFrom(
          this.api.createCriteria({
            patientId: this.patientId,
            criteriaNames: uniqueList,
          })
        );
      }

      this.showToast("Symptoms saved successfully");

      // Reset state and reload
      this.isSaved = true;
      this.isEditMode = false;

      await this.loadCriteria();
    } catch (err) {
      console.error("Save criteria error:", err);
      this.showToast("Save failed. Please try again.");
    } finally {
      this.criteriaLoading = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ENABLE EDIT MODE
  // Unlock all disabled controls so user can edit
  // ─────────────────────────────────────────────────────────────────────────

  enableEdit() {
    this.isEditMode = true;

    // Enable all controls for editing
    this.fuSymptomsArr.controls.forEach((ctrl) => {
      ctrl.enable();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD MEDICINES
  // ─────────────────────────────────────────────────────────────────────────

  async loadMedicines() {
    try {
      const res: any = await firstValueFrom(
        this.api.getAllMedicines(1, 100, "")
      );

      console.log("MED API RESPONSE:", res);

      this.medicines = res?.data?.items || [];

      console.log("MED LIST:", this.medicines);
    } catch (err) {
      console.error("Medicine load error", err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADD NEW MEDICINE
  // ─────────────────────────────────────────────────────────────────────────

  async addNewMedicine() {
    // Prompt user for medicine name
    const medicineName = prompt("Enter medicine name:");

    if (!medicineName || !medicineName.trim()) {
      this.showToast("Medicine name cannot be empty");
      return;
    }

    this.creatingMedicine = true;

    try {
      const payload = {
        name: medicineName.trim(),
        strength: "",
        dosageForm: "Tablet",
        stockQuantity: 0,
        unit: "Piece",
        batchNumber: "",
        expiryDate: new Date().toISOString(),
        notes: "Added from prescription",
      };

      console.log("Creating medicine:", payload);

      const res: any = await firstValueFrom(this.api.createMedicine(payload));

      console.log("Medicine created:", res);

      const newMedicine = res?.data || res;

      // Add to medicines list
      this.medicines.unshift(newMedicine);

      this.showToast("Medicine created successfully!");

      // Reload medicines to be sure
      await this.loadMedicines();
    } catch (err) {
      console.error("Create medicine error:", err);
      this.showToast("Failed to create medicine. Please try again.");
    } finally {
      this.creatingMedicine = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOAST NOTIFICATION
  // ─────────────────────────────────────────────────────────────────────────

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: "top",
      color: "dark",
    });

    await toast.present();
  }

  onWaveOffChange(value: string) {

  if(value === "yes"){

    if(!this.waveOffVerified){
      this.showPasswordModal = true;
    }

  }else{

    this.waveOffVerified = false;

  }

}

closePasswordModal(){

  this.showPasswordModal = false;
  this.adminPassword = "";

}

async verifyAdminPassword(){

  if(!this.adminPassword){
    this.showToast("Password required");
    return;
  }

  try{

    await firstValueFrom(
      this.api.verifyAdminPassword({
        password: this.adminPassword
      })
    );

    this.waveOffVerified = true;

    this.showPasswordModal = false;

    this.showToast("Password verified");

  }catch(err){

    console.error(err);

    this.showToast("Invalid password");

  }

}
}