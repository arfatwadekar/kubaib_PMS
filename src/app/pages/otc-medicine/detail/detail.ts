import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';

import {
  OtcMedicine,
  OtcMedicineService,
} from 'src/app/services/otc-medicine.service';

import { NotificationService } from 'src/app/services/notification.service';

type PageMode = 'create' | 'edit' | 'view';

@Component({
  selector: 'app-otc-medicine-detail',
  templateUrl: './detail.html',
  styleUrls: ['./detail.scss'],
  standalone: false,
})
export class DetailPage implements OnInit, OnDestroy {
  form!: FormGroup;

  mode: PageMode = 'create';
  id!: string;

  loading = false;

  unreadCount = 0;
  notifications: any[] = [];

  // Holds the total amount already paid for the record (used during edit)
  private originalTotalPaid = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private otcMedicineService: OtcMedicineService,
    private toastCtrl: ToastController,
    private notificationService: NotificationService,
  ) {}

  // ================= INIT =================

  ngOnInit(): void {
    this.initializeForm();

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const idParam = params.get('id');
      const currentUrl = this.router.url;

      this.resetForm();

      if (currentUrl.includes('/view/')) {
        this.mode = 'view';
        this.id = idParam!;
        this.loadRecord();
      } else if (idParam) {
        this.mode = 'edit';
        this.id = idParam;
        this.loadRecord();
      } else {
        this.mode = 'create';
      }
    });

    this.loadNotifications();
  }

  // ================= FORM =================

  private initializeForm(): void {
    this.form = this.fb.group({
      id: [''],

      nameOfMedicine: ['', [Validators.maxLength(100)]],

      amountOfMedicine: [null, [Validators.required, Validators.min(0)]],

      amountPaid: [null, [Validators.min(0)]],

      pendingBalance: [{ value: 0, disabled: true }],

      patientName: [''],

      dateOfPurchase: [new Date().toISOString().split('T')[0]],

      paymentNotes: [''],
    });

    this.registerCalculationListeners();
  }

  private resetForm(): void {
    this.form.reset({
      id: '',
      nameOfMedicine: '',
      amountOfMedicine: null,
      amountPaid: null,
      pendingBalance: 0,
      patientName: '',
      dateOfPurchase: new Date().toISOString().split('T')[0],
      paymentNotes: '',
    });

    this.form.enable();
  }

  // ================= CALCULATIONS =================

  private registerCalculationListeners(): void {
    this.form
      .get('amountOfMedicine')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        // Auto-populate Amount Paid with Amount of Medicine (default to full payment)
        const currentAmountPaid = this.form.get('amountPaid')?.value;
        if (!currentAmountPaid || currentAmountPaid === 0 || currentAmountPaid === null) {
          this.form.patchValue(
            {
              amountPaid: value,
            },
            { emitEvent: false }
          );
        }
        this.calculatePending();
      });

    this.form
      .get('amountPaid')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.calculatePending();
      });
  }

  private calculatePending(): void {
    const amount = Number(this.form.get('amountOfMedicine')?.value) || 0;

    const paid = Number(this.form.get('amountPaid')?.value) || 0;

    this.form.patchValue(
      {
        pendingBalance: amount - paid,
      },
      { emitEvent: false },
    );
  }

  // ================= LOAD =================

  private loadRecord(): void {
    this.loading = true;

    this.otcMedicineService
      .getById(this.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: OtcMedicine) => {
          this.form.patchValue({
            id: res.id,
            nameOfMedicine: res.nameOfMedicine,
            amountOfMedicine: res.amountOfMedicine,
            // Prefill `amountPaid` with total paid so far for visibility during edit.
            amountPaid: res.totalAmountPaid ?? 0,
            pendingBalance: res.pendingBalance,
            patientName: res.patientName,
            dateOfPurchase: res.dateOfPurchase?.split('T')[0],
            paymentNotes: '',
          });

          if (this.mode === 'view') {
            this.form.disable();
          }

          // store original total paid for later delta calculation when saving edits
          this.originalTotalPaid = res.totalAmountPaid ?? 0;

          this.loading = false;
        },
        error: () => {
          this.loading = false;

          this.showToast('Failed to load OTC medicine.', 'danger');
        },
      });
  }

  // ================= SAVE =================

  save(): void {
    this.performSave(false);
  }

  saveAndNew(): void {
    if (this.mode !== 'create') {
      this.showToast('Save & New is only available in Create mode.', 'warning');
      return;
    }
    this.performSave(true);
  }

  private performSave(saveAndNew: boolean = false): void {
    if (this.mode === 'view') {
      return;
    }

    if (this.form.invalid) {
      this.showToast('Please fill all mandatory fields.', 'warning');

      return;
    }

    const data = this.form.getRawValue();

    const amountOfMedicineNum = Number(data.amountOfMedicine);
    const amountPaidNum = Number(data.amountPaid ?? 0);

    if (amountPaidNum > amountOfMedicineNum) {
      this.showToast('Amount Paid cannot exceed Amount Of Medicine.', 'danger');

      return;
    }

    const payload: any = {
      amountOfMedicine: amountOfMedicineNum,
      ...(data.nameOfMedicine?.trim()
        ? { nameOfMedicine: data.nameOfMedicine.trim() }
        : {}),
      ...(data.patientName?.trim()
        ? { patientName: data.patientName.trim() }
        : {}),
      ...(data.dateOfPurchase
        ? { dateOfPurchase: new Date(data.dateOfPurchase).toISOString() }
        : {}),
      ...(data.paymentNotes?.trim()
        ? { paymentNotes: data.paymentNotes.trim() }
        : {}),
    };

    // Handle amountPaid differently for create vs edit:
    if (this.mode === 'create') {
      // On create, amountPaid is the initial payment (can be 0)
      if (amountPaidNum > 0) {
        payload.amountPaid = amountPaidNum;
        payload.paymentDate = new Date().toISOString();
      }
    } else if (this.mode === 'edit') {
      // On edit, the form shows total paid so far. Only send the delta (new payment)
      if (amountPaidNum < this.originalTotalPaid) {
        this.showToast(
          'Amount Paid cannot be less than already recorded payments.',
          'danger',
        );

        return;
      }

      const newPayment = amountPaidNum - this.originalTotalPaid;

      if (newPayment > 0) {
        payload.amountPaid = newPayment;
        payload.paymentDate = new Date().toISOString();
        if (data.paymentNotes?.trim()) {
          payload.paymentNotes = data.paymentNotes.trim();
        }
      }
    }

    if (this.mode === 'edit') {
      payload.id = this.id;
    }

    this.loading = true;

    const request$ =
      this.mode === 'edit'
        ? this.otcMedicineService.update(payload)
        : this.otcMedicineService.create(payload);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loading = false;

        this.showToast(
          this.mode === 'edit'
            ? 'OTC medicine updated successfully.'
            : 'OTC medicine created successfully.',
          'success',
        );

        if (saveAndNew) {
          // Reset form for next entry
          this.resetForm();
        } else {
          this.router.navigate(['/otc-medicine']);
        }
      },
      error: () => {
        this.loading = false;

        this.showToast('Operation failed.', 'danger');
      },
    });
  }

  // ================= NAV =================

  cancel(): void {
    this.router.navigate(['/otc-medicine']);
  }

  editCurrentRecord(): void {
    if (this.mode === 'view' && this.id) {
      this.router.navigate(['/otc-medicine/edit', this.id]);
    }
  }

  openNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  // ================= NOTIFICATIONS =================

  async loadNotifications() {
    const res: any = await this.notificationService
      .getNotifications()
      .toPromise();

    this.notifications = res || [];

    this.unreadCount = this.notifications.filter((x: any) => !x.isRead).length;
  }

  // ================= TOAST =================

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top',
    });

    await toast.present();
  }

  // ================= DESTROY =================

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
