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

  isFullyPaid = false; // ⭐ IMPORTANT FLAG

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private otcMedicineService: OtcMedicineService,
    private toastCtrl: ToastController,
    private notificationService: NotificationService,
  ) {}

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
      amountPaid: [0, [Validators.min(0)]],
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
      amountPaid: 0,
      pendingBalance: 0,
      patientName: '',
      dateOfPurchase: new Date().toISOString().split('T')[0],
      paymentNotes: '',
    });

    this.form.enable();
    this.isFullyPaid = false;
  }

  private registerCalculationListeners(): void {
    this.form
      .get('amountOfMedicine')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.calculatePending());

    this.form
      .get('amountPaid')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.calculatePending());
  }

  private calculatePending(): void {
    const amount = Number(this.form.get('amountOfMedicine')?.value) || 0;
    const paid = Number(this.form.get('amountPaid')?.value) || 0;

    this.form.patchValue(
      { pendingBalance: amount - paid },
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
          const totalPaid = res.totalAmountPaid ?? 0;

          this.isFullyPaid = totalPaid >= (res.amountOfMedicine ?? 0); // ⭐ KEY FIX

          this.form.patchValue({
            id: res.id,
            nameOfMedicine: res.nameOfMedicine,
            amountOfMedicine: res.amountOfMedicine,
            amountPaid: totalPaid,
            pendingBalance: res.pendingBalance,
            patientName: res.patientName,
            dateOfPurchase: res.dateOfPurchase?.split('T')[0],
            paymentNotes: '',
          });

          // ⭐ LOCK PAYMENT FIELD IF FULLY PAID
          if (this.isFullyPaid) {
            this.form.get('amountPaid')?.disable();
          }

          if (this.mode === 'view') {
            this.form.disable();
          }

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

  private performSave(saveAndNew: boolean): void {
    if (this.mode === 'view') return;

    if (this.form.invalid) {
      this.showToast('Please fill all mandatory fields.', 'warning');
      return;
    }

    const data = this.form.getRawValue();

    const payload: any = {
      amountOfMedicine: Number(data.amountOfMedicine),
      nameOfMedicine: data.nameOfMedicine,
      patientName: data.patientName,
      dateOfPurchase: data.dateOfPurchase
        ? new Date(data.dateOfPurchase).toISOString()
        : undefined,
      paymentNotes: data.paymentNotes,
    };

    // ⭐ IMPORTANT RULE
    // If fully paid → DO NOT TOUCH PAYMENT
    if (!this.isFullyPaid) {
      const amountPaidNum = Number(data.amountPaid);

      if (amountPaidNum > 0) {
        payload.amountPaid = amountPaidNum;
        payload.paymentDate = new Date().toISOString();
      }
    }

    const request$ =
      this.mode === 'edit'
        ? this.otcMedicineService.update({ ...payload, id: this.id })
        : this.otcMedicineService.create(payload);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showToast('Saved successfully', 'success');
        this.router.navigate(['/otc-medicine']);
      },
      error: () => {
        this.showToast('Save failed', 'danger');
      },
    });
  }

  // ================= NAV =================

  cancel(): void {
    this.router.navigate(['/otc-medicine']);
  }

  editCurrentRecord(): void {
    this.router.navigate(['/otc-medicine/edit', this.id]);
  }

  openNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  async loadNotifications() {
    const res: any = await this.notificationService
      .getNotifications()
      .toPromise();
    this.notifications = res || [];
    this.unreadCount = this.notifications.filter((x: any) => !x.isRead).length;
  }

  private async showToast(message: string, color: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'top',
    });
    t.present();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
