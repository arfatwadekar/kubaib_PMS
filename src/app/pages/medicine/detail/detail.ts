// import { Component, OnInit, OnDestroy } from '@angular/core';
// import { FormBuilder, FormGroup, Validators } from '@angular/forms';
// import { ActivatedRoute, Router } from '@angular/router';
// import { AlertController, ToastController } from '@ionic/angular';
// import { Subject, takeUntil } from 'rxjs';
// import { MedicineService, Medicine } from 'src/app/services/medicine.service';
// import { NotificationService } from 'src/app/services/notification.service';

// type PageMode = 'create' | 'edit' | 'view';

// @Component({
//   selector: 'app-medicine-detail',
//   templateUrl: './detail.html',
//   styleUrls: ['./detail.scss'],
//   standalone: false,
// })
// export class DetailPage implements OnInit, OnDestroy {

//   form!: FormGroup;

//   mode: PageMode = 'create';
//   id!: number;

//   loading = false;
//   existingMedicines: Medicine[] = [];

//   private destroy$ = new Subject<void>();

//   constructor(
//     private fb: FormBuilder,
//     private route: ActivatedRoute,
//     private router: Router,
//     private medicineService: MedicineService,
//     private toastCtrl: ToastController,
//     private alertCtrl: AlertController,
//          private notificationService: NotificationService,
//   ) {}

//   // ============================================================
//   // INIT
//   // ============================================================

//   // ngOnInit(): void {

//   //   this.initializeForm();
//   //   this.resolveMode();
//   // }

//   ngOnInit(): void {

//   this.initializeForm();

//   this.route.paramMap
//     .pipe(takeUntil(this.destroy$))
//     .subscribe(params => {

//       const idParam = params.get('id');
//       const currentUrl = this.router.url;

//       // 🧹 Always Reset Form First (IMPORTANT)
//       this.form.reset({
//         name: '',
//         strength: '',
//         dosageForm: '',
//         stockQuantity: 0,
//         unit: '',
//         batchNumber: '',
//         expiryDate: '',
//         notes: ''
//       });

//       this.form.enable();
//       this.loading = false;

//       // 🔍 Resolve Mode Properly
//       if (currentUrl.includes('/view/')) {
//         this.mode = 'view';
//         this.id = +idParam!;
//         this.loadMedicine();
//       }
//       else if (idParam) {
//         this.mode = 'edit';
//         this.id = +idParam;
//         this.loadMedicine();
//       }
//       else {
//         this.mode = 'create';
//         this.loadAllMedicines();
//       }

//     });

//      this.loadNotifications();
// }

//   private resolveMode(): void {

//     const paramId = this.route.snapshot.paramMap.get('id');
//     const url = this.router.url;

//     if (url.includes('/view/')) {
//       this.mode = 'view';
//     } else if (paramId) {
//       this.mode = 'edit';
//       this.id = +paramId;
//     } else {
//       this.mode = 'create';
//     }

//     if (this.mode === 'create') {
//       this.loadAllMedicines();
//     }

//     if (this.mode === 'edit' || this.mode === 'view') {
//       this.id = +paramId!;
//       this.loadMedicine();
//     }
//   }

//   // ============================================================
//   // FORM INIT
//   // ============================================================

//   private initializeForm(): void {

//     this.form = this.fb.group({
//       name: ['', Validators.required],
//       strength: ['', Validators.required],
//       dosageForm: ['', Validators.required],
//       stockQuantity: [0, [Validators.required, Validators.min(0)]],
//       unit: ['', Validators.required],
//       batchNumber: [''],
//       expiryDate: [''],
//       notes: ['']
//     });
//   }

//   // ============================================================
//   // LOAD SINGLE
//   // ============================================================

//   private loadMedicine(): void {

//     this.loading = true;

//     this.medicineService.getById(this.id)
//       .pipe(takeUntil(this.destroy$))
//       .subscribe({
//         next: (res) => {

//           this.form.patchValue(res);

//           // PRD RULE: Name non-editable in edit mode
//           if (this.mode === 'edit') {
//             this.form.get('name')?.disable();
//           }

//           // View mode: full disable
//           if (this.mode === 'view') {
//             this.form.disable();
//           }

//           this.loading = false;
//         },
//         error: () => {
//           this.loading = false;
//           this.showToast('Failed to load medicine.', 'danger');
//         }
//       });
//   }

//   // ============================================================
//   // LOAD ALL (DUPLICATE CHECK)
//   // ============================================================

//   private loadAllMedicines(): void {

//     this.medicineService.getAll(1, 1000)
//       .pipe(takeUntil(this.destroy$))
//       .subscribe({
//         next: (res) => {
//           this.existingMedicines = res?.data?.items ?? [];
//         },
//         error: () => {
//           this.existingMedicines = [];
//         }
//       });
//   }

//   // ============================================================
//   // SAVE
//   // ============================================================

//   async save(): Promise<void> {

//     if (this.mode === 'view') return;
//     if (this.form.invalid) {
//       this.showToast('Please fill all mandatory fields.', 'warning');
//       return;
//     }

//     const data = this.form.getRawValue();
//     if (!data.expiryDate || data.expiryDate.trim() === '') {
//       delete data.expiryDate;
//     }
//     // Duplicate check (create only)
//     if (this.mode === 'create') {

//       const duplicate = this.existingMedicines.find(m =>
//         m.name?.toLowerCase().trim() === data.name.toLowerCase().trim() &&
//         m.strength?.toLowerCase().trim() === data.strength.toLowerCase().trim() &&
//         m.dosageForm?.toLowerCase().trim() === data.dosageForm.toLowerCase().trim()
//       );

//       if (duplicate) {
//         const confirmed = await this.confirmDuplicate();
//         if (!confirmed) return;
//       }
//     }

//     this.loading = true;

//     const request$ =
//       this.mode === 'edit'
//         ? this.medicineService.update(this.id, data)
//         : this.medicineService.create(data);

//     request$
//       .pipe(takeUntil(this.destroy$))
//       .subscribe({
//         next: () => {
//           this.loading = false;
//           this.showToast(
//             this.mode === 'edit'
//               ? 'Medicine updated successfully.'
//               : 'Medicine created successfully.',
//             'success'
//           );
//           this.router.navigate(['/medicines']);
//         },
//         error: () => {
//           this.loading = false;
//           this.showToast('Operation failed.', 'danger');
//         }
//       });
//   }

//   // ============================================================
//   // STOCK MANAGEMENT (EDIT ONLY)
//   // ============================================================

//   async adjustStock(type: 'add' | 'reduce') {

//     if (this.mode !== 'edit') return;

//     const alert = await this.alertCtrl.create({
//       header: type === 'add' ? 'Add Stock' : 'Reduce Stock',
//       inputs: [
//         {
//           name: 'quantity',
//           type: 'number',
//           placeholder: 'Enter quantity'
//         }
//       ],
//       buttons: [
//         { text: 'Cancel', role: 'cancel' },
//         {
//           text: 'Confirm',
//           handler: (data) => {

//             const qty = Number(data.quantity);

//             if (!qty || qty <= 0) {
//               this.showToast('Enter valid quantity.');
//               return false;
//             }

//             const current = this.form.getRawValue().stockQuantity;

//             const newStock =
//               type === 'add'
//                 ? current + qty
//                 : current - qty;

//             if (newStock < 0) {
//               this.showToast('Stock cannot be negative.');
//               return false;
//             }

//             this.updateStock(newStock);
//             return true;
//           }
//         }
//       ]
//     });

//     await alert.present();
//   }

//   private updateStock(newStock: number): void {

//     const payload = {
//       ...this.form.getRawValue(),
//       stockQuantity: newStock
//     };

//     this.medicineService.update(this.id, payload)
//       .pipe(takeUntil(this.destroy$))
//       .subscribe({
//         next: () => {
//           this.form.patchValue({ stockQuantity: newStock });
//           this.showToast('Stock updated successfully.', 'success');
//         },
//         error: () => {
//           this.showToast('Stock update failed.', 'danger');
//         }
//       });
//   }

//   // ============================================================
//   // DUPLICATE CONFIRM
//   // ============================================================

//   private async confirmDuplicate(): Promise<boolean> {

//     return new Promise(async (resolve) => {

//       const alert = await this.alertCtrl.create({
//         header: 'Duplicate Medicine',
//         message: 'A similar medicine already exists. Continue?',
//         buttons: [
//           {
//             text: 'Cancel',
//             role: 'cancel',
//             handler: () => resolve(false)
//           },
//           {
//             text: 'Continue',
//             handler: () => resolve(true)
//           }
//         ]
//       });

//       await alert.present();
//     });
//   }

//   // ============================================================
//   // NAVIGATION
//   // ============================================================

//   cancel(): void {
//     this.router.navigate(['/medicines']);
//   }

//   // ============================================================
//   // TOAST
//   // ============================================================

//   private async showToast(message: string, color: string = 'primary') {

//     const toast = await this.toastCtrl.create({
//       message,
//       duration: 2500,
//       color,
//       position: 'top'
//     });

//     await toast.present();
//   }

//   // ============================================================
//   // CLEANUP
//   // ============================================================

//   ngOnDestroy(): void {
//     this.destroy$.next();
//     this.destroy$.complete();
//   }
//   changeQuantity(change: number): void {

//   if (this.mode === 'view') return;

//   const current = this.form.get('stockQuantity')?.value ?? 0;
//   const newValue = current + change;

//   if (newValue < 0) return;

//   this.form.patchValue({
//     stockQuantity: newValue
//   });
// }

//     unreadCount = 0;
// notifications: any[] = [];
// async loadNotifications() {
//   const res: any = await this.notificationService.getNotifications().toPromise();

//   this.notifications = res || [];

//   this.unreadCount = this.notifications.filter(n => !n.isRead).length;
// }

// openNotifications() {
//   this.router.navigate(['/notifications']);
// }
// }


import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { MedicineService, Medicine } from 'src/app/services/medicine.service';
import { NotificationService } from 'src/app/services/notification.service';

type PageMode = 'create' | 'edit' | 'view';

@Component({
  selector: 'app-medicine-detail',
  templateUrl: './detail.html',
  styleUrls: ['./detail.scss'],
  standalone: false,
})
export class DetailPage implements OnInit, OnDestroy {

  form!: FormGroup;

  mode: PageMode = 'create';
  id!: number;

  loading = false;
  existingMedicines: Medicine[] = [];

  unreadCount = 0;
  notifications: any[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private medicineService: MedicineService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private notificationService: NotificationService,
  ) {}

  // ================= INIT =================

  ngOnInit(): void {
    this.initializeForm();

    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {

        const idParam = params.get('id');
        const currentUrl = this.router.url;

        this.resetForm();

        if (currentUrl.includes('/view/')) {
          this.mode = 'view';
          this.id = +idParam!;
          this.loadMedicine();
        }
        else if (idParam) {
          this.mode = 'edit';
          this.id = +idParam;
          this.loadMedicine();
        }
        else {
          this.mode = 'create';
          this.loadAllMedicines();
        }
      });

    this.loadNotifications();
  }

  // ================= FORM =================

  private initializeForm(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      strength: ['', Validators.required],
      dosageForm: ['', Validators.required],
      stockQuantity: [0, [Validators.required, Validators.min(0)]],
      unit: ['', Validators.required],
      batchNumber: [''],
      expiryDate: [''],
      notes: ['']
    });
  }

  private resetForm(): void {
    this.form.reset({
      name: '',
      strength: '',
      dosageForm: '',
      stockQuantity: 0,
      unit: '',
      batchNumber: '',
      expiryDate: '',
      notes: ''
    });

    this.form.enable();
    this.loading = false;
  }

  // ================= LOAD SINGLE =================

  private loadMedicine(): void {

    this.loading = true;

    this.medicineService.getById(this.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {

          this.form.patchValue({
            name: res.name || '',
            strength: res.strength || '',
            dosageForm: res.dosageForm || '',
            stockQuantity: res.stockQuantity ?? 0,
            unit: res.unit || '',
            batchNumber: res.batchNumber || '',
            expiryDate: res.expiryDate ? res.expiryDate.split('T')[0] : '',
            notes: res.notes || ''
          });

          // ✅ ONLY VIEW MODE DISABLE
          if (this.mode === 'view') {
            this.form.disable();
          }

          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.showToast('Failed to load medicine.', 'danger');
        }
      });
  }

  // ================= LOAD ALL =================

  private loadAllMedicines(): void {
    this.medicineService.getAll(1, 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.existingMedicines = res?.data?.items ?? [];
        },
        error: () => {
          this.existingMedicines = [];
        }
      });
  }

  // ================= SAVE =================

  async save(): Promise<void> {

    if (this.mode === 'view') return;

    if (this.form.invalid) {
      this.showToast('Please fill all mandatory fields.', 'warning');
      return;
    }

    const data = this.form.getRawValue();

    if (data.expiryDate && data.expiryDate.trim() !== '') {
      data.expiryDate = new Date(data.expiryDate).toISOString();
    } else {
      delete data.expiryDate;
    }

    if (this.mode === 'create') {
      const duplicate = this.existingMedicines.find(m =>
        m.name?.toLowerCase().trim() === data.name.toLowerCase().trim() &&
        m.strength?.toLowerCase().trim() === data.strength.toLowerCase().trim() &&
        m.dosageForm?.toLowerCase().trim() === data.dosageForm.toLowerCase().trim()
      );

      if (duplicate) {
        const confirmed = await this.confirmDuplicate();
        if (!confirmed) return;
      }
    }

    this.loading = true;

    const request$ =
      this.mode === 'edit'
        ? this.medicineService.update(this.id, data)
        : this.medicineService.create(data);

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.showToast(
            this.mode === 'edit'
              ? 'Medicine updated successfully.'
              : 'Medicine created successfully.',
            'success'
          );
          this.router.navigate(['/medicines']);
        },
        error: () => {
          this.loading = false;
          this.showToast('Operation failed.', 'danger');
        }
      });
  }

  // ================= STOCK =================

  changeQuantity(change: number): void {

    if (this.mode === 'view') return;

    const current = this.form.get('stockQuantity')?.value ?? 0;
    const newValue = current + change;

    if (newValue < 0) return;

    this.form.patchValue({ stockQuantity: newValue });
  }

  // ================= DUPLICATE =================

  private async confirmDuplicate(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: 'Duplicate Medicine',
        message: 'A similar medicine already exists. Continue?',
        buttons: [
          { text: 'Cancel', role: 'cancel', handler: () => resolve(false) },
          { text: 'Continue', handler: () => resolve(true) }
        ]
      });

      await alert.present();
    });
  }

  // ================= NAV =================

  cancel(): void {
    this.router.navigate(['/medicines']);
  }

  openNotifications() {
    this.router.navigate(['/notifications']);
  }

  // ================= NOTIFICATIONS =================

  async loadNotifications() {
    const res: any = await this.notificationService.getNotifications().toPromise();
    this.notifications = res || [];
    this.unreadCount = this.notifications.filter(n => !n.isRead).length;
  }

  // ================= TOAST =================

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });
    await toast.present();
  }

  // ================= CLEANUP =================

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}