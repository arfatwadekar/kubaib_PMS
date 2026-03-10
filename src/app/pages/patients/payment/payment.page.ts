import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom, Subscription } from 'rxjs';
import { PaymentService } from 'src/app/services/payment.service';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.page.html',
  styleUrls: ['./payment.page.scss'],
  standalone:false
})
export class PaymentPage implements OnInit, OnDestroy {
paymentId!: number;
  patientId!: number;
  appointmentId!: number;

  loading = false;

  /* ================= SUMMARY ================= */

  consultationCharges = 0;
  waveOffAmount = 0;
  pendingBalance = 0;
  totalPayable = 0;

  /* ================= MEDICINES ================= */

  prescriptions: any[] = [];

  /* ================= PAYMENT FORM ================= */

  paymentDate = new Date().toISOString().split('T')[0];
  amountPaid: number | null = null;
  paymentMode: 'Cash' | 'Online' = 'Cash';

  /* ================= BALANCE ================= */

  newPendingBalance = 0;

  private sub = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentApi: PaymentService,
    private toastCtrl: ToastController
  ) {}

  /* ================= INIT ================= */

  ngOnInit(): void {

    this.sub.add(
      this.route.queryParams.subscribe(params => {

        this.patientId = Number(params['patientId']);
        this.appointmentId = Number(params['appointmentId']);

        if (!this.appointmentId) {
          this.toast('Invalid appointment');
          return;
        }

        this.loadPaymentData();

      })
    );

  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /* ================= LOAD PAYMENT DATA ================= */

  async loadPaymentData() {

    this.loading = true;

    try {

      /* 1️⃣ GET APPOINTMENT SUMMARY */

      const summaryRes: any = await firstValueFrom(
        this.paymentApi.getAppointmentSummary(this.appointmentId)
      );

      const summary = summaryRes?.data ?? summaryRes;

      const payment = summary?.payment ?? {};
      this.paymentId = payment.paymentId;
this.paymentId = payment?.paymentId || payment?.id;
      this.consultationCharges = Number(payment.consultationCharges ?? 0);
      this.waveOffAmount = Number(payment.waveOffAmount ?? 0);
      this.pendingBalance = Number(payment.remainingBalance ?? 0);

      /* 2️⃣ TOTAL PAYABLE */

      this.totalPayable =
        this.consultationCharges +
        this.pendingBalance -
        this.waveOffAmount;

      this.newPendingBalance = this.totalPayable;

      /* 3️⃣ LOAD PRESCRIBED MEDICINES */

      const medicineRes: any = await firstValueFrom(
        this.paymentApi.getPrescriptionsByAppointment(this.appointmentId)
      );

      const meds = medicineRes?.data ?? medicineRes ?? [];

      this.prescriptions = Array.isArray(meds) ? meds : [];

    }
    catch {

      await this.toast('Failed to load payment data');

    }
    finally {

      this.loading = false;

    }

  }

  /* ================= BALANCE CALCULATION ================= */

  recalculateBalance() {

    const paid = Number(this.amountPaid ?? 0);

    if (paid > this.totalPayable) {

      this.newPendingBalance = 0;
      return;

    }

    this.newPendingBalance =
      this.totalPayable - paid;

  }

  /* ================= FINALIZE PAYMENT ================= */

  // async finalizePayment() {

  //   if (!this.amountPaid || this.amountPaid <= 0) {
  //     await this.toast('Enter valid payment amount');
  //     return;
  //   }

  //   if (this.amountPaid > this.totalPayable) {
  //     await this.toast('Amount cannot exceed payable amount');
  //     return;
  //   }

  //   if (this.loading) return;

  //   this.loading = true;

  //   try {

  //     /* 1️⃣ CREATE PAYMENT */

  //     await firstValueFrom(
  //       this.paymentApi.createPayment({
  //         patientId: this.patientId,
  //         appointmentId: this.appointmentId,
  //         consultationCharges: this.consultationCharges,
  //         waveOffAmount: this.waveOffAmount,
  //         amountPaid: this.amountPaid,
  //         paymentMode: this.paymentMode,
  //         paymentDate: new Date(this.paymentDate).toISOString()
  //       })
  //     );

  //     /* 2️⃣ UPDATE APPOINTMENT STATUS */

  //     await firstValueFrom(
  //       this.paymentApi.updateAppointmentStatus(
  //         this.appointmentId,
  //         'OutPatient'
  //       )
  //     );

  //     await this.toast('Payment completed successfully');

  //     /* 3️⃣ REDIRECT TO DASHBOARD */

  //     this.router.navigate(['/dashboard']);

  //   }
  //   catch {

  //     await this.toast('Payment failed. Please try again.');

  //   }
  //   finally {

  //     this.loading = false;

  //   }

  // }


  /* ================= GO BACK ================= */

  goBack() {

    this.router.navigate(['/followup'], {
      queryParams: {
        patientId: this.patientId,
        appointmentId: this.appointmentId
      }
    });

  }

  /* ================= TOAST ================= */

  private async toast(message: string) {

    const t = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top'
    });

    await t.present();

  }

async finalizePayment() {

  if (!this.amountPaid || this.amountPaid <= 0) {
    await this.toast('Enter payment amount');
    return;
  }

  try {

    await firstValueFrom(
      this.paymentApi.updatePayment(this.paymentId,{
        amountPaid: this.amountPaid,
        paymentMode: this.paymentMode,
        paymentDate: new Date(this.paymentDate).toISOString(),
        notes:''
      })
    );

    await firstValueFrom(
      this.paymentApi.updateAppointmentStatus(
        this.appointmentId,
        4
      )
    );

    await this.toast('Payment completed');

    this.router.navigate(['/dashboard']);

  }
  catch {

    await this.toast('Payment failed');

  }

}

}