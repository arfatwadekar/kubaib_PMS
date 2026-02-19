import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';

import {
  PaymentService,
  CreatePaymentPayload,
} from 'src/app/services/payment.service';

// =====================
// Helpers
// =====================
function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function safeStr(v: any): string {
  return (v ?? '').toString().trim();
}
function toUiDate(isoOrDate: string): string {
  const s = (isoOrDate || '').toString().trim();
  if (!s) return '';
  const iso = s.includes('T') ? s : `${s}T00:00:00.000Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

@Component({
  selector: 'app-payment',
  templateUrl: './payment.page.html',
  styleUrls: ['./payment.page.scss'],
  standalone: false,
})
export class PaymentPage implements OnInit, OnDestroy {
  // =====================
  // STATE
  // =====================
  patientId: number | null = null;
  loading = false;

  payPendingAmount = 0;
  payTotalCharges = 0;
  payTotalPaid = 0;
  payHistory: Array<{
    date: string;
    amount: number;
    remark?: string;
    mode?: string;
  }> = [];

  private sub = new Subscription();

  constructor(
    private paymentApi: PaymentService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  // =====================
  // INIT / DESTROY
  // =====================
  ngOnInit(): void {
    this.sub.add(
      this.route.queryParams.subscribe((qp) => {
        const id = safeNum(qp?.['patientId']);

        if (id > 0) {
          this.patientId = id;
          void this.loadPaymentData();
        } else {
          this.patientId = null;
          this.resetPaymentView();
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // =====================
  // LOAD DATA
  // GET /api/Payment/patient/{patientId}
  // GET /api/Payment/patient/{patientId}/balance
  // =====================
  async loadPaymentData() {
    if (!this.patientId) return;
    this.loading = true;

    try {
      // Load history + balance in parallel
      const [historyRes, balanceRes] = await Promise.all([
        firstValueFrom(this.paymentApi.getByPatient(this.patientId)),
        firstValueFrom(this.paymentApi.getBalance(this.patientId)),
      ]);

      // --- Balance ---
      const bal = balanceRes?.data ?? balanceRes;
      this.payPendingAmount = safeNum(bal?.pendingAmount ?? bal?.pending ?? 0);
      this.payTotalCharges = safeNum(
        bal?.totalConsultationCharges ?? bal?.totalCharges ?? 0,
      );
      this.payTotalPaid = safeNum(bal?.totalAmountPaid ?? bal?.totalPaid ?? 0);

      // --- History ---
      const list = this.extractArray(historyRes);
      this.payHistory = list.map((p: any) => ({
        date: toUiDate(safeStr(p?.paymentDate ?? p?.date)),
        amount: safeNum(p?.amountPaid ?? p?.amount ?? 0),
        remark: safeStr(p?.remark ?? p?.remarks ?? ''),
        mode: safeStr(p?.paymentMode ?? p?.mode ?? ''),
      }));
    } catch (e: any) {
      await this.toast(
        e?.error?.message || e?.message || 'Failed to load payment data',
      );
    } finally {
      this.loading = false;
    }
  }

  // =====================
  // ADD NEW PAYMENT
  // POST /api/Payment
  // =====================
  async openAddPayment() {
    if (!this.patientId) {
      await this.toast('PatientId missing. Open patient in edit mode.');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Add New Payment',
      inputs: [
        {
          name: 'consultationCharges',
          type: 'number',
          placeholder: 'Consultation Charges (₹)',
        },
        {
          name: 'waveOffAmount',
          type: 'number',
          placeholder: 'Wave Off Amount (₹) — optional',
        },
        {
          name: 'amountPaid',
          type: 'number',
          placeholder: 'Amount Paid (₹)',
        },
        {
          name: 'paymentMode',
          type: 'text',
          placeholder: 'Payment Mode: Cash / Online',
          value: 'Cash',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: async (data) => {
            const consultationCharges = safeNum(data?.consultationCharges);
            const amountPaid = safeNum(data?.amountPaid);
            const waveOffAmount = safeNum(data?.waveOffAmount ?? 0);
            const paymentMode = safeStr(data?.paymentMode) || 'Cash';

            if (consultationCharges <= 0) {
              await this.toast('Enter valid consultation charges');
              return false;
            }
            if (amountPaid < 0) {
              await this.toast('Amount paid cannot be negative');
              return false;
            }

            await this.savePayment({
              patientId: this.patientId!,
              consultationCharges,
              waveOffAmount,
              amountPaid,
              paymentMode,
              paymentDate: new Date().toISOString(),
            });

            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  private async savePayment(payload: CreatePaymentPayload) {
    this.loading = true;

    try {
      await firstValueFrom(this.paymentApi.createPayment(payload));
      await this.toast('Payment saved successfully');
      await this.loadPaymentData();
    } catch (e: any) {
      await this.presentSimpleAlert(
        'Save Failed',
        e?.error?.message || e?.message || 'Failed to save payment',
      );
    } finally {
      this.loading = false;
    }
  }

  // =====================
  // RESET
  // =====================
  private resetPaymentView() {
    this.payPendingAmount = 0;
    this.payTotalCharges = 0;
    this.payTotalPaid = 0;
    this.payHistory = [];
  }

  // =====================
  // NAVIGATION
  // =====================
  goPrevFollowUp() {
    this.router.navigate([], {
      queryParams: { tab: 'followup', patientId: this.patientId },
      queryParamsHandling: 'merge',
    });
  }

  // =====================
  // UTIL
  // =====================
  private extractArray(res: any): any[] {
    const list =
      res?.data ?? res?.list ?? res?.result ?? res?.items ?? res ?? [];
    return Array.isArray(list) ? list : [];
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
    });
    await t.present();
  }

  private async presentSimpleAlert(header: string, message: string) {
    const a = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await a.present();
  }

  trackByIndex(index: number) {
    return index;
  }
}
