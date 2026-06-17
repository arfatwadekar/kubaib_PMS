import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';

import {
  OtcMedicine,
  OtcMedicineService
} from 'src/app/services/otc-medicine.service';

import { NotificationService } from 'src/app/services/notification.service';

type PageMode = 'create' | 'edit' | 'view';

@Component({
  selector: 'app-otc-medicine-detail',
  templateUrl: './detail.html',
  styleUrls: ['./detail.scss'],
  standalone: false
})
export class DetailPage implements OnInit, OnDestroy {

  form!: FormGroup;

  mode: PageMode = 'create';
  id!: string;

  loading = false;

  unreadCount = 0;
  notifications: any[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private otcMedicineService: OtcMedicineService,
    private toastCtrl: ToastController,
    private notificationService: NotificationService
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

      nameOfMedicine: [
        '',
        [Validators.maxLength(100)]
      ],

      amountOfMedicine: [
        null,
        [Validators.required, Validators.min(0)]
      ],

      amountPaid: [
        null,
        [Validators.required, Validators.min(0)]
      ],

      pendingBalance: [
        { value: 0, disabled: true }
      ],

      patientName: [
        '',
        Validators.required
      ],

      dateOfPurchase: [
        new Date().toISOString().split('T')[0],
        Validators.required
      ],

      paymentNotes: ['']
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
      paymentNotes: ''
    });

    this.form.enable();
  }

  // ================= CALCULATIONS =================

  private registerCalculationListeners(): void {

    this.form.get('amountOfMedicine')
      ?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {

        if (this.mode === 'create') {

          this.form.patchValue(
            {
              amountPaid: value || 0
            },
            { emitEvent: false }
          );
        }

        this.calculatePending();
      });

    this.form.get('amountPaid')
      ?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.calculatePending();
      });
  }

  private calculatePending(): void {

    const amount =
      Number(this.form.get('amountOfMedicine')?.value) || 0;

    const paid =
      Number(this.form.get('amountPaid')?.value) || 0;

    this.form.patchValue(
      {
        pendingBalance: amount - paid
      },
      { emitEvent: false }
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
            amountPaid: res.totalAmountPaid,
            pendingBalance: res.pendingBalance,
            patientName: res.patientName,
            dateOfPurchase:
              res.dateOfPurchase?.split('T')[0],
            paymentNotes: ''
          });

          if (this.mode === 'view') {
            this.form.disable();
          }

          this.loading = false;
        },
        error: () => {

          this.loading = false;

          this.showToast(
            'Failed to load OTC medicine.',
            'danger'
          );
        }
      });
  }

  // ================= SAVE =================

  save(): void {

    if (this.mode === 'view') {
      return;
    }

    if (this.form.invalid) {

      this.showToast(
        'Please fill all mandatory fields.',
        'warning'
      );

      return;
    }

    const data = this.form.getRawValue();

    if (
      Number(data.amountPaid) >
      Number(data.amountOfMedicine)
    ) {

      this.showToast(
        'Amount Paid cannot exceed Amount Of Medicine.',
        'danger'
      );

      return;
    }

    const payload: any = {
      nameOfMedicine: data.nameOfMedicine,
      amountOfMedicine: Number(data.amountOfMedicine),
      patientName: data.patientName,
      dateOfPurchase: new Date(
        data.dateOfPurchase
      ).toISOString(),
      amountPaid: Number(data.amountPaid),
      paymentNotes: data.paymentNotes,
      paymentDate: new Date().toISOString()
    };

    if (this.mode === 'edit') {
      payload.id = this.id;
    }

    this.loading = true;

    const request$ =
      this.mode === 'edit'
        ? this.otcMedicineService.update(payload)
        : this.otcMedicineService.create(payload);

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {

          this.loading = false;

          this.showToast(
            this.mode === 'edit'
              ? 'OTC medicine updated successfully.'
              : 'OTC medicine created successfully.',
            'success'
          );

          this.router.navigate(['/otc-medicine']);
        },
        error: () => {

          this.loading = false;

          this.showToast(
            'Operation failed.',
            'danger'
          );
        }
      });
  }

  // ================= NAV =================

  cancel(): void {
    this.router.navigate(['/otc-medicine']);
  }

  openNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  // ================= NOTIFICATIONS =================

  async loadNotifications() {

    const res: any =
      await this.notificationService
        .getNotifications()
        .toPromise();

    this.notifications = res || [];

    this.unreadCount =
      this.notifications.filter(
        (x: any) => !x.isRead
      ).length;
  }

  // ================= TOAST =================

  private async showToast(
    message: string,
    color: string = 'primary'
  ) {

    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });

    await toast.present();
  }

  // ================= DESTROY =================

  ngOnDestroy(): void {

    this.destroy$.next();
    this.destroy$.complete();
  }
}