import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom, Subscription } from 'rxjs';
import { PaymentService } from 'src/app/services/payment.service';

interface PaymentEntry {
  date: string;
  amountPaid: number | null;
  paymentMode: 'Cash' | 'Online';
}

@Component({
  selector: 'app-payment',
  templateUrl: './payment.page.html',
  styleUrls: ['./payment.page.scss'],
  standalone: false,  // Not standalone since we're using Ionic components
})
export class PaymentPage implements OnInit, OnDestroy {

  patientId!: number;
  appointmentId!: number;

  loading = false;

  /* ================= SUMMARY ================= */

  consultationCharges = 0;     // From Doctor Follow-up
  pendingBalance = 0;          // From Backend
  totalAmount = 0;             // CC + PB

  /* ================= PAYMENT ENTRIES ================= */

  paymentEntries: PaymentEntry[] = [];

  /* ================= HISTORY ================= */

  paymentHistory: any[] = [];

  private sub = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentApi: PaymentService,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.route.queryParams.subscribe(params => {
        this.patientId = Number(params['patientId']);
        this.appointmentId = Number(params['appointmentId']);
        this.loadData();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /* ================= LOAD DATA ================= */

  async loadData() {
    this.loading = true;

    try {
      const [balanceRes, historyRes] = await Promise.all([
        firstValueFrom(this.paymentApi.getBalance(this.patientId)),
        firstValueFrom(this.paymentApi.getByPatient(this.patientId)),
      ]);

      const bal = balanceRes?.data ?? balanceRes;

      this.consultationCharges = Number(bal?.currentConsultationCharges ?? 0);
      this.pendingBalance = Number(bal?.pendingAmount ?? 0);
      this.totalAmount = this.consultationCharges + this.pendingBalance;

      const list = historyRes?.data ?? historyRes ?? [];
      this.paymentHistory = Array.isArray(list) ? list.reverse() : [];

    } catch (e: any) {
      await this.toast('Failed to load payment data');
    } finally {
      this.loading = false;
    }
  }

  /* ================= ADD PAYMENT SECTION ================= */

  addPaymentSection() {
    this.paymentEntries.unshift({
      date: new Date().toISOString().split('T')[0],
      amountPaid: null,
      paymentMode: 'Cash'
    });
  }

  /* ================= PREVIEW CALCULATION ================= */

  get previewPendingBalance(): number {

    let remaining = this.pendingBalance + this.consultationCharges;

    this.paymentEntries.forEach(entry => {
      if (entry.amountPaid) {
        remaining -= entry.amountPaid;
      }
    });

    return remaining > 0 ? remaining : 0;
  }

  /* ================= FINALIZE PAYMENT ================= */

  async finalizePayments() {

    for (const entry of this.paymentEntries) {

      if (!entry.amountPaid || entry.amountPaid <= 0) continue;

      await firstValueFrom(
        this.paymentApi.createPayment({
          patientId: this.patientId,
          appointmentId: this.appointmentId,
          consultationCharges: this.consultationCharges,
          waveOffAmount: 0,
          amountPaid: entry.amountPaid,
          paymentMode: entry.paymentMode,
          paymentDate: new Date(entry.date).toISOString(),
        })
      );
    }

    await this.toast('Payments recorded successfully');

    this.paymentEntries = [];
    await this.loadData();
  }

  /* ================= MARK OUT PATIENT ================= */

  async markOutPatient() {

    if (this.previewPendingBalance > 0) {
      await this.toast('Pending balance must be cleared before marking Out Patient');
      return;
    }

    // TODO: Call appointment status API here

    await this.toast('Patient marked as Out Patient');
    this.router.navigate(['/dashboard']);
  }

  /* ================= UTIL ================= */

  private async toast(message: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
    });
    await t.present();
  }
}