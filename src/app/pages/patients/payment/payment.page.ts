import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom, Subscription } from 'rxjs';
import { PaymentService } from 'src/app/services/payment.service';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.page.html',
  styleUrls: ['./payment.page.scss'],
  standalone: false
})
export class PaymentPage implements OnInit, OnDestroy {

  /* ================= BASIC INFO ================= */

  paymentId!: number;
  patientId!: number;
  appointmentId!: number;

  loading = false;

  /* ================= PAYMENT HISTORY ================= */

  paymentHistory: any[] = [];
  currentPage = 1;
  pageSize = 5;

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

  /* ================= PAYMENT STATUS ================= */
  isPaymentDone = false;
  private sub = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentApi: PaymentService,
    private toastCtrl: ToastController
  ) {}

  /* ================================================= */
  /* INIT */
  /* ================================================= */

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
        this.loadPaymentHistory();

      })
    );

  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /* ================================================= */
  /* LOAD PAYMENT DATA */
  /* ================================================= */

  // async loadPaymentData() {

  //   this.loading = true;

  //   try {

  //     const res: any = await firstValueFrom(
  //       this.paymentApi.getAppointmentSummary(this.appointmentId)
  //     );

  //     const summary = res?.data ?? res;
  //     const payment = summary?.payment ?? {};

  //     this.paymentId = payment?.paymentId || payment?.id;
  //     this.waveOffAmount = Number(payment?.waveOffAmount ?? 0);

  //     /* ================= SUMMARY ================= */

  //     this.consultationCharges = Number(payment?.consultationCharges ?? 0);

  //     /* prevent negative pending */

  //     this.pendingBalance = Math.max(
  //       0,
  //       Number(payment?.remainingBalance ?? 0)
  //     );

  //     /* ================= TOTAL PAYABLE ================= */

  //     this.totalPayable =
  //       this.consultationCharges +
  //       this.pendingBalance -
  //       this.waveOffAmount;

  //     if (this.totalPayable < 0) {
  //       this.totalPayable = 0;
  //     }

  //     this.newPendingBalance = this.totalPayable;

  //     /* ================= LOAD MEDICINES ================= */

  //     const medicineRes: any = await firstValueFrom(
  //       this.paymentApi.getPrescriptionsByAppointment(this.appointmentId)
  //     );

  //     const meds = medicineRes?.data ?? medicineRes ?? [];

  //     this.prescriptions = Array.isArray(meds) ? meds : [];

  //   }
  //   catch {

  //     await this.toast('Failed to load payment data');

  //   }
  //   finally {

  //     this.loading = false;

  //   }

  // }
async loadPaymentData() {
  this.loading = true;

  try {
    // ── 1. Appointment summary ────────────────────────────────────────────
    const res: any = await firstValueFrom(
      this.paymentApi.getAppointmentSummary(this.appointmentId)
    );

    const summary = res?.data ?? res;
    const payment = summary?.payment ?? {};
    console.log(payment);

    this.paymentId     = payment?.paymentId;
    this.waveOffAmount = Number(payment?.waveOffAmount ?? 0);

    // ── 2. Check if payment is already done ──────────────────────────────
    const isPaymentDone  = !!payment?.paymentDate;
    this.isPaymentDone   = isPaymentDone;

    // ── 3. Consultation charges for THIS visit ────────────────────────────
    const consultation   = Number(payment?.consultationCharges ?? 0);
    const waveOff        = Number(payment?.waveOffAmount       ?? 0);
    this.consultationCharges = isPaymentDone ? 0 : Math.max(0, consultation - waveOff);

    // ── 4. Always call balance API for pending from previous visits ───────
    let pendingFromApi = 0;
    try {
      const balanceRes: any = await firstValueFrom(
        this.paymentApi.getBalance(this.patientId)
      );
      pendingFromApi = Math.max(0, Number(balanceRes?.pendingBalance ?? 0));
      console.log('Balance API pending:', pendingFromApi);
    } catch {
      console.error('Balance API failed');
    }

    // ── 5. Derive display values ──────────────────────────────────────────
    // Card 1: Consultation Charges (This Visit)
    // Card 2: Pending Balance (from previous visits via balance API)
    // Card 3: Total = Card 1 + Card 2
    this.pendingBalance    = pendingFromApi;
    this.totalPayable      = Math.max(0, this.consultationCharges + pendingFromApi - this.waveOffAmount);
    this.newPendingBalance = this.totalPayable;

    console.log('Payment done:', isPaymentDone);
    console.log('Consultation charges:', this.consultationCharges);
    console.log('Pending balance:', this.pendingBalance);
    console.log('Total payable:', this.totalPayable);

    // ── 6. Medicines ──────────────────────────────────────────────────────
    const medicineRes: any = await firstValueFrom(
      this.paymentApi.getPrescriptionsByAppointment(this.appointmentId)
    );

    const meds = medicineRes?.data ?? medicineRes ?? [];
    this.prescriptions = Array.isArray(meds) ? meds : [];

  } catch {
    await this.toast('Failed to load payment data');
  } finally {
    this.loading = false;
  }
}
  /* ================================================= */
  /* PAYMENT HISTORY */
  /* ================================================= */

  async loadPaymentHistory() {

    try {

      const res: any = await firstValueFrom(
        this.paymentApi.getByPatient(this.patientId)
      );

      const data = res?.data ?? res ?? [];

      this.paymentHistory = Array.isArray(data)
        ? data.sort(
            (a: any, b: any) =>
              new Date(b.paymentDate).getTime() -
              new Date(a.paymentDate).getTime()
          )
        : [];

    }
    catch {

      console.error('Payment history load failed');

    }

  }

  /* ================================================= */
  /* BALANCE CALCULATION */
  /* ================================================= */

  recalculateBalance() {

    const paid = Number(this.amountPaid ?? 0);

    this.newPendingBalance = this.totalPayable - paid;

    if (this.newPendingBalance < 0) {
      this.newPendingBalance = 0;
    }

  }

  /* ================================================= */
  /* FINALIZE PAYMENT */
  /* ================================================= */

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
          notes: ''
        })
      );

      /* ================= AFTER PAYMENT ================= */


        await firstValueFrom(
          this.paymentApi.updateAppointmentStatus(
            this.appointmentId,
            4
          )
        );


      await this.toast('Payment recorded successfully');

      this.router.navigate(['/dashboard']);

    }
    catch {

      await this.toast('Payment failed');

    }

  }

  /* ================================================= */
  /* ADD PAYMENT RESET */
  /* ================================================= */

  addPayment() {

    this.amountPaid = null;
    this.paymentMode = 'Cash';
    this.paymentDate = new Date().toISOString().split('T')[0];

    this.newPendingBalance = this.totalPayable;

  }

  /* ================================================= */
  /* PAGINATION */
  /* ================================================= */

  get paginatedPayments() {

    const start = (this.currentPage - 1) * this.pageSize;

    return this.paymentHistory.slice(
      start,
      start + this.pageSize
    );

  }

  get totalPages() {

    return Math.ceil(
      this.paymentHistory.length / this.pageSize
    );

  }

  nextPage() {

    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }

  }

  prevPage() {

    if (this.currentPage > 1) {
      this.currentPage--;
    }

  }

  /* ================================================= */
  /* NAVIGATION */
  /* ================================================= */

  goBack() {

    this.router.navigate(['/patients/followup'], {
      queryParams: {
        patientId: this.patientId,
        appointmentId: this.appointmentId
      }
    });

  }

  /* ================================================= */
  /* TOAST */
  /* ================================================= */

  private async toast(message: string) {

    const t = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top'
    });

    await t.present();

  }

}