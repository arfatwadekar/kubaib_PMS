import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from 'src/app/services/notification.service';
import {
  AnalyticsService,
  AnalyticsFilterRequest,
  AnalyticsSummary,
  DailyBreakdown,
} from 'src/app/services/analytics.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.page.html',
  styleUrls: ['./analytics.page.scss'],
  standalone: false,
})
export class AnalyticsPage implements OnInit, OnDestroy {

  // ======================================================
  // LIFECYCLE & CLEANUP
  // ======================================================

  private destroy$ = new Subject<void>();

  // ======================================================
  // LOADING & ERROR
  // ======================================================

  isLoading        = false;
  isLoadingHistory = false;
  error: string | null = null;

  // ======================================================
  // FILTER STATE
  // ======================================================

  filterType: 'Daily' | 'Weekly' | 'Monthly' | 'Custom' = 'Monthly';

  /** ISO yyyy-MM-dd — bound to <input type="date"> */
  fromDateISO = '';
  toDateISO   = '';

  selectedGender = 'All';

  // ======================================================
  // KPI VALUES — derived from /summary
  // ======================================================

  consultationAmount              = 0;
  consultationRevenueAppointmentCount = 0;
  consultationReceived            = 0;
  consultationDue                 = 0;
  consultationCollectionRate      = 0;
  consultationPendingRate         = 0;

  otcAmount         = 0;
  otcReceived       = 0;
  otcDue            = 0;
  otcCollectionRate = 0;
  otcPendingRate    = 0;

  // ======================================================
  // TABLE STATE
  // ======================================================

  historyData: DailyBreakdown[] = [];

  /** Cached result of the search filter — recomputed only on data/search change */
  private _filteredCache: DailyBreakdown[] = [];
  private _lastSearch  = '';
  private _lastDataRef: DailyBreakdown[] = [];

  historySearch = '';
  historyPage   = 1;
  itemsPerPage  = 8;

  // ======================================================
  // NOTIFICATIONS
  // ======================================================

  unreadCount   = 0;
  notifications: any[] = [];

  // ======================================================
  // CONSTRUCTOR
  // ======================================================

  constructor(
    private router: Router,
    private notificationService: NotificationService,
    private analyticsService: AnalyticsService,
  ) {
    // Set default date range for Monthly on construction
    this.applyDateRangeForType('Monthly');
  }

  // ======================================================
  // LIFECYCLE
  // ======================================================

  ngOnInit(): void {
    this.loadNotifications();
    this.loadAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ======================================================
  // NOTIFICATIONS
  // ======================================================

  async loadNotifications(): Promise<void> {
    try {
      const res: any = await this.notificationService.getNotifications().toPromise();
      this.notifications = res || [];
      this.unreadCount   = this.notifications.filter((n: any) => !n.isRead).length;
    } catch {
      // silent — notifications are non-critical
    }
  }

  openNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  // ======================================================
  // DATE RANGE HELPERS
  // ======================================================

  /**
   * Auto-sets fromDateISO / toDateISO based on the selected period type.
   * Custom leaves the existing dates untouched.
   */
  private applyDateRangeForType(type: 'Daily' | 'Weekly' | 'Monthly' | 'Custom'): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (type === 'Daily') {
      this.fromDateISO = this.toISO(today);
      this.toDateISO   = this.toISO(today);

    } else if (type === 'Weekly') {
      // Mon–Sun of the current week
      const day  = today.getDay(); // 0 = Sun
      const mon  = new Date(today);
      mon.setDate(today.getDate() - ((day + 6) % 7));
      const sun  = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      this.fromDateISO = this.toISO(mon);
      this.toDateISO   = this.toISO(sun);

    } else if (type === 'Monthly') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      this.fromDateISO = this.toISO(first);
      this.toDateISO   = this.toISO(last);

    }
    // Custom: leave fromDateISO / toDateISO as-is
  }

  /** Date → yyyy-MM-dd */
  private toISO(d: Date): string {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Format a date string from the API (ISO datetime or yyyy-MM-dd)
   * to a readable "01 May 2026" format for customer-facing display.
   * Returns the original string if it cannot be parsed.
   */
  formatDate(raw: string): string {
    if (!raw) return '—';
    try {
      // Handles both "2026-05-01" and "2026-05-01T00:00:00"
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw;
      return d.toLocaleDateString('en-IN', {
        day:   '2-digit',
        month: 'short',
        year:  'numeric',
      });
    } catch {
      return raw;
    }
  }

  /**
   * Safe ₹ formatter — handles undefined / null / NaN gracefully.
   */
  formatINR(value: number | undefined | null): string {
    const n = Number(value);
    if (isNaN(n)) return '₹0';
    return '₹' + n.toLocaleString('en-IN');
  }

  // ======================================================
  // DATA LOADING
  // ======================================================

  loadAll(): void {
    this.isLoading = true;
    this.error     = null;

    const req = this.buildRequest();

    this.analyticsService.getSummary(req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary) => {
          this.applySummary(summary);
          this.loadBreakdown(req);
        },
        error: (err) => {
          this.error     = typeof err === 'string' ? err : 'Failed to load analytics data. Please try again.';
          this.isLoading = false;
        },
      });
  }

  private loadBreakdown(req: AnalyticsFilterRequest): void {
    this.isLoadingHistory = true;
    this.historyPage      = 1;
    this.historySearch    = '';

    this.analyticsService.getDailyBreakdown(req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.historyData      = Array.isArray(data) ? data : [];
          this._lastDataRef     = [];   // invalidate cache
          this.isLoading        = false;
          this.isLoadingHistory = false;
        },
        error: (err) => {
          console.error('Breakdown load failed:', err);
          this.historyData      = [];
          this._lastDataRef     = [];
          this.isLoading        = false;
          this.isLoadingHistory = false;
        },
      });
  }

  // ======================================================
  // KPI CALCULATION — single source of truth
  // ======================================================

  private applySummary(data: AnalyticsSummary): void {
    // ---- Consultation ----
    const consultCharges  = Math.max(0, data.consultationRevenueTotalAmount  || 0);
    const consultReceived = Math.max(0, data.patientPaymentsTotalAmountPaid   || 0);
    // Due cannot be negative — patient may have paid more in edge cases
    const consultDue      = Math.max(0, consultCharges - consultReceived);
    // Collection rate: clamp to [0, 100]
    const consultRate     = consultCharges > 0
      ? Math.min(100, Math.round((consultReceived / consultCharges) * 100))
      : 0;

    this.consultationAmount                  = consultCharges;
    this.consultationRevenueAppointmentCount = Math.max(0, data.consultationRevenueAppointmentCount || 0);
    this.consultationReceived                = consultReceived;
    this.consultationDue                     = consultDue;
    this.consultationCollectionRate          = consultRate;
    this.consultationPendingRate             = 100 - consultRate;

    // ---- OTC ----
    const otcSales    = Math.max(0, data.otcSalesTotalAmountOfMedicine || 0);
    const otcPending  = Math.max(0, data.pendingOtcAmount              || 0);
    // Received = Sales - Pending; cannot exceed sales or go below 0
    const otcReceived = Math.min(otcSales, Math.max(0, otcSales - otcPending));
    const otcRate     = otcSales > 0
      ? Math.min(100, Math.round((otcReceived / otcSales) * 100))
      : 0;

    this.otcAmount         = otcSales;
    this.otcReceived       = otcReceived;
    this.otcDue            = otcPending;
    this.otcCollectionRate = otcRate;
    this.otcPendingRate    = 100 - otcRate;
  }

  // ======================================================
  // FILTER ACTIONS
  // ======================================================

  private buildRequest(): AnalyticsFilterRequest {
    return {
      filterType: this.filterType,
      fromDate:   this.fromDateISO || undefined,
      toDate:     this.toDateISO   || undefined,
      gender:     this.selectedGender !== 'All' ? this.selectedGender : undefined,
    };
  }

  /** Period pill click — auto-sets dates then loads */
  setFilterType(type: 'Daily' | 'Weekly' | 'Monthly' | 'Custom'): void {
    this.filterType = type;
    this.applyDateRangeForType(type);
    // For Custom don't auto-fire — user must click Apply
    if (type !== 'Custom') {
      this.loadAll();
    }
  }

  setStartDate(iso: string): void {
    this.fromDateISO = iso;
  }

  setEndDate(iso: string): void {
    this.toDateISO = iso;
  }

  setGenderFilter(gender: string): void {
    this.selectedGender = gender;
  }

  /** Only fires on button click */
  applyFilters(): void {
    if (this.fromDateISO && this.toDateISO && this.fromDateISO > this.toDateISO) {
      this.error = 'Start date cannot be after end date.';
      return;
    }
    this.loadAll();
  }

  resetFilters(): void {
    this.filterType     = 'Monthly';
    this.selectedGender = 'All';
    this.applyDateRangeForType('Monthly');
    this.loadAll();
  }

  refreshData(): void {
    this.error = null;
    this.loadAll();
  }

  // ======================================================
  // TABLE — SEARCH / FILTER / PAGINATION
  // Memoised: only recomputes when data array ref or search string changes
  // ======================================================

  get filteredHistoryData(): DailyBreakdown[] {
    // Recompute only if data or search changed
    if (
      this._lastDataRef === this.historyData &&
      this._lastSearch  === this.historySearch
    ) {
      return this._filteredCache;
    }

    this._lastDataRef = this.historyData;
    this._lastSearch  = this.historySearch;

    const q = this.historySearch.trim().toLowerCase();
    this._filteredCache = q
      ? this.historyData.filter(i => (i.date || '').toLowerCase().includes(q))
      : this.historyData;

    return this._filteredCache;
  }

  get paginatedHistoryData(): DailyBreakdown[] {
    const start = (this.historyPage - 1) * this.itemsPerPage;
    return this.filteredHistoryData.slice(start, start + this.itemsPerPage);
  }

  get historyTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredHistoryData.length / this.itemsPerPage));
  }

  get filteredCount(): number {
    return this.filteredHistoryData.length;
  }

  prevHistoryPage(): void {
    if (this.historyPage > 1) this.historyPage--;
  }

  nextHistoryPage(): void {
    if (this.historyPage < this.historyTotalPages) this.historyPage++;
  }

  onSearchChange(): void {
    this.historyPage = 1;
  }

  // ======================================================
  // EXPORT
  // ======================================================

  exportExcel(): void {
    const req = this.buildRequest();
    this.analyticsService.exportDailyBreakdownExcel(req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url  = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href  = url;
          link.setAttribute('download', `analytics-${this.fromDateISO}-to-${this.toDateISO}.xlsx`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (err) => console.error('Excel export failed:', err),
      });
  }
}