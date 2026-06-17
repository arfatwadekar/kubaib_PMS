//   setTab(tab: string) {
//     this.activeTab = tab;
//   }

//   toggleFilters() {
//     this.showFilters = !this.showFilters;
//   }

//   async loadNotifications() {
//     const res: any = await this.notificationService
//       .getNotifications()
//       .toPromise();

//     this.notifications = res || [];

//     this.unreadCount = this.notifications.filter(
//       (n: any) => !n.isRead
//     ).length;
//   }

//   openNotifications() {
//     this.router.navigate(['/notifications']);
//   }
// }

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
  // LOADING & ERROR STATES
  // ======================================================

  isLoading = false;
  isLoadingHistory = false;
  error: string | null = null;

  // ======================================================
  // FILTER STATE
  // ======================================================

  filterType: 'Daily' | 'Weekly' | 'Monthly' | 'Custom' = 'Monthly';
  fromDate = '05/01/2026';
  toDate = '06/14/2026';
  selectedGender = 'All';
  selectedRetentionStatus = 'All';

  // ======================================================
  // API DATA
  // ======================================================

  analyticsData: AnalyticsSummary | null = null;
  historyData: DailyBreakdown[] = [];

  consultationAmount = 0;
  consultationReceived = 0;
  consultationDue = 0;
  otcAmount = 0;
  otcReceived = 0;
  otcDue = 0;
  grossPool = 0;
  consultationPercent = 0;
  otcPercent = 0;
  averageConsultationFee = 0;
  combinedCheckValue = 0;
  averageRealizationRate = 0;
  totalRealizedDeposits = 0;
  newPatientCount = 0;
  returningPatientCount = 0;
  demographicTotal = 0;

  // =====================================================
  // CHART CONFIGURATIONS
  // =====================================================

  demographicChart: any = {
    series: [0, 0, 0],

    chart: {
      type: 'donut',
      height: 340,
    },

    labels: ['Male', 'Female', 'Other'],

    colors: ['#3B82F6', '#0F8B8D', '#F59E0B'],

    dataLabels: {
      enabled: false,
    },

    legend: {
      show: false,
    },

    plotOptions: {
      pie: {
        expandOnClick: false,

        donut: {
          size: '72%',

          labels: {
            show: false,
          },
        },
      },
    },

    stroke: {
      width: 6,
      colors: ['#ffffff'],
    },

    tooltip: {
      y: {
        formatter: (value: number) => {
          const total = this.demographicChart.series.reduce(
            (acc: number, current: number) => acc + (current || 0),
            0,
          );
          const percent = total > 0 ? ((value / total) * 100).toFixed(0) : '0';

          return `${value} Caseload (${percent}%)`;
        },
      },
    },
  };

  patientChart: any = {
    series: [],

    chart: {
      type: 'bar',
      height: 380,
      stacked: true,
      toolbar: {
        show: false,
      },
    },

    colors: ['#4F46E5', '#10B981'],

    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '18%',
        borderRadius: 4,
      },
    },

    dataLabels: {
      enabled: false,
    },

    stroke: {
      show: false,
    },

    legend: {
      position: 'top',
      horizontalAlign: 'center',
      fontSize: '16px',
      markers: {
        radius: 2,
      },
    },

    grid: {
      borderColor: '#EDF2F7',
      strokeDashArray: 5,
    },

    xaxis: {
      categories: [],
      labels: {
        style: {
          colors: '#8A97B2',
          fontSize: '13px',
        },
      },
    },

    yaxis: {
      min: 0,
      tickAmount: 4,

      labels: {
        style: {
          colors: '#8A97B2',
          fontSize: '13px',
        },
      },
    },

    tooltip: {
      shared: true,
    },
  };

  // ======================================
  // Billing Collection Efficiency Chart
  // ======================================

  billingChart: any = {
    series: [
      {
        name: 'Charges',
        data: [0, 0],
      },
      {
        name: 'Deposits',
        data: [0, 0],
      },
      {
        name: 'Dues',
        data: [0, 0],
      },
    ],

    chart: {
      type: 'bar',
      height: 380,
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
    },

    colors: ['#3B82F6', '#10B981', '#EF4444'],

    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '45%',
        borderRadius: 4,
      },
    },

    dataLabels: {
      enabled: false,
    },

    stroke: {
      show: false,
    },

    legend: {
      position: 'top',
      horizontalAlign: 'center',
      fontSize: '18px',
      markers: {
        radius: 2,
      },
    },

    grid: {
      borderColor: '#EDF2F7',
      strokeDashArray: 5,
    },

    xaxis: {
      categories: ['Practitioner Consult Charge', 'Pharmacy OTC Charge'],
      labels: {
        style: {
          fontSize: '14px',
          colors: ['#8A97B2'],
        },
      },
    },

    yaxis: {
      min: 0,
      tickAmount: 4,
      labels: {
        formatter: (value: number) => {
          return '₹' + value.toLocaleString('en-IN');
        },
        style: {
          colors: ['#8A97B2'],
          fontSize: '13px',
        },
      },
    },

    tooltip: {
      y: {
        formatter: (value: number) => {
          return '₹' + value.toLocaleString('en-IN');
        },
      },
    },
  };

  unreadCount = 0;
  notifications: any[] = [];
  showFilters = false;
  activeTab = 'overview';

  tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: 'pulse-outline',
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: 'card-outline',
    },
    {
      id: 'patient',
      label: 'Patients',
      icon: 'people-outline',
    },
    {
      id: 'history',
      label: 'History',
      icon: 'document-text-outline',
    },
  ];

  kpiCards: any[] = [];

  // ==========================
  // Revenue Progress Line Chart
  // ==========================

  lineChart: any = {
    series: [],

    chart: {
      type: 'line',
      height: 360,
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
    },

    colors: ['#2F5FE3', '#1BA3F7', '#19B66A'],

    stroke: {
      curve: 'smooth',
      width: [4, 2, 4],
      dashArray: [0, 5, 0],
    },

    markers: {
      size: [5, 0, 0],
    },

    dataLabels: {
      enabled: false,
    },

    legend: {
      position: 'top',
      horizontalAlign: 'center',
    },

    grid: {
      borderColor: '#E9EDF5',
      strokeDashArray: 5,
    },

    xaxis: {
      categories: [],
    },

    yaxis: {
      min: 0,
      tickAmount: 4,
      labels: {
        formatter: (value: number) => `₹${value.toLocaleString('en-IN')}`,
      },
    },
  };

  // ==========================
  // Revenue Segmentation Donut
  // ==========================

  donutChart: any = {
    series: [0, 0],

    chart: {
      type: 'donut',
      height: 280,
    },

    labels: ['Consultation Services', 'Pharmacy OTC Orders'],

    colors: ['#2F5FE3', '#19B66A'],

    dataLabels: {
      enabled: false,
    },

    legend: {
      show: false,
    },

    plotOptions: {
      pie: {
        donut: {
          size: '72%',
        },
      },
    },
  };

  constructor(
    private router: Router,
    private notificationService: NotificationService,
    private analyticsService: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.loadAnalyticsData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: string): void {
    this.activeTab = tab;
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  // ======================================================
  // NOTIFICATIONS
  // ======================================================

  async loadNotifications(): Promise<void> {
    try {
      const res: any = await this.notificationService
        .getNotifications()
        .toPromise();

      this.notifications = res || [];

      this.unreadCount = this.notifications.filter(
        (n: any) => !n.isRead,
      ).length;
    } catch (error) {
      console.error('Failed to load notifications', error);
    }
  }

  openNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  // ======================================================
  // ANALYTICS DATA LOADING
  // ======================================================

  loadAnalyticsData(): void {
    this.isLoading = true;
    this.error = null;

    const filterRequest = this.buildFilterRequest();

    this.analyticsService
      .getSummary(filterRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.analyticsData = data;
          this.updateChartsAndKPIs(data);
          this.loadHistoryData(filterRequest);
        },
        error: (err) => {
          this.error = err;
          this.isLoading = false;
          console.error('Failed to load analytics data:', err);
        },
      });
  }

  loadHistoryData(filterRequest: AnalyticsFilterRequest): void {
    this.isLoadingHistory = true;
    this.historyPage = 1;

    this.analyticsService
      .getDailyBreakdown(filterRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.historyData = data;
          this.updateLineChart();
          this.updatePatientChart();
          if (this.analyticsData) {
            this.updateKPICards(this.analyticsData);
          }
          this.isLoading = false;
          this.isLoadingHistory = false;
        },
        error: (err) => {
          console.error('Failed to load history data:', err);
          this.isLoadingHistory = false;
          this.isLoading = false;
        },
      });
  }

  private buildFilterRequest(): AnalyticsFilterRequest {
    return {
      filterType: this.filterType,
      fromDate: this.formatDateForAPI(this.fromDate),
      toDate: this.formatDateForAPI(this.toDate),
      gender: this.selectedGender !== 'All' ? this.selectedGender : undefined,
      retentionStatus:
        this.selectedRetentionStatus !== 'All'
          ? this.selectedRetentionStatus
          : undefined,
    };
  }

  private formatDateForAPI(dateStr: string): string {
    // Convert MM/DD/YYYY to YYYY-MM-DD
    const [month, day, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  }

  private updateChartsAndKPIs(data: AnalyticsSummary): void {
    // Update KPI Cards based on API data
    this.updateKPICards(data);

    // Update Chart Data
    this.updateCharts(data);
  }

  private updateKPICards(data: AnalyticsSummary): void {
    const consultationCharges = data.consultationRevenueTotalAmount || 0;
    const consultationReceived = data.patientPaymentsTotalAmountPaid || 0;
    const consultationDue = consultationCharges - consultationReceived;

    const otcSales = data.otcSalesTotalAmountOfMedicine || 0;
    const otcReceived = otcSales - data.pendingOtcAmount;
    const otcDue = data.pendingOtcAmount || 0;

    const totalCharges = consultationCharges + otcSales;
    const totalReceived = consultationReceived + otcReceived;
    const totalDue = consultationDue + otcDue;

    const intakeCount = this.historyData.reduce(
      (sum, item) => sum + (item.intake || 0),
      0,
    );
    const appointmentCount = this.historyData.reduce(
      (sum, item) => sum + (item.appointmentCount || 0),
      0,
    );
    const returningCount = Math.max(appointmentCount - intakeCount, 0);

    this.newPatientCount = intakeCount;
    this.returningPatientCount = returningCount;

    this.averageConsultationFee =
      consultationCharges && data.consultationRevenueAppointmentCount
        ? consultationCharges / data.consultationRevenueAppointmentCount
        : 0;

    this.combinedCheckValue =
      appointmentCount > 0 ? totalReceived / appointmentCount : 0;

    this.averageRealizationRate =
      totalCharges > 0 ? Math.round((totalReceived / totalCharges) * 100) : 0;

    const collectionRate =
      totalCharges > 0 ? Math.round((totalReceived / totalCharges) * 100) : 0;

    const consultationCollectionRate =
      consultationCharges > 0
        ? Math.round((consultationReceived / consultationCharges) * 100)
        : 0;

    const otcCollectionRate =
      otcSales > 0 ? Math.round((otcReceived / otcSales) * 100) : 0;

    this.kpiCards = [
      {
        title: 'CONSULTATION CHARGES',
        value: '₹' + consultationCharges.toLocaleString('en-IN'),
        icon: 'pulse-outline',
        color: 'blue',
        footerLeft: `${data.consultationRevenueAppointmentCount || 0} Appointments`,
        footerRight: 'Care visits booked',
      },
      {
        title: 'CONSULTATION DEPOSITS',
        value: '₹' + consultationReceived.toLocaleString('en-IN'),
        icon: 'wallet-outline',
        color: 'green',
        footerLeft: 'Realized capital:',
        footerRight: `${consultationCollectionRate}% realized`,
      },
      {
        title: 'CONSULT OUTSTANDING',
        value: '₹' + consultationDue.toLocaleString('en-IN'),
        icon: 'alert-circle-outline',
        color: 'orange',
        footerLeft: 'Patients Pending payment:',
        footerRight: '182 accounts',
      },
      {
        title: 'PHARMACY OTC SALES',
        value: '₹' + otcSales.toLocaleString('en-IN'),
        icon: 'link-outline',
        color: 'cyan',
        footerLeft: 'Direct cash deposits:',
        footerRight: '₹' + otcReceived.toLocaleString('en-IN') + ' received',
      },
      {
        title: 'OTC PHARMACY OUTSTANDING',
        value: '₹' + otcDue.toLocaleString('en-IN'),
        icon: 'document-text-outline',
        color: 'red',
        footerLeft: 'Unrealized credits ratio:',
        footerRight: `${100 - otcCollectionRate}% pending`,
      },
      {
        title: 'NEW PATIENT INTAKE',
        value: `${this.newPatientCount} Patients`,
        icon: 'person-add-outline',
        color: 'indigo',
        footerLeft: 'Total intake:',
        footerRight: `${this.newPatientCount} new`,
      },
      {
        title: 'RETURNING RETENTION CHECKUPS',
        value: `${this.returningPatientCount} Returnees`,
        icon: 'people-outline',
        color: 'emerald',
        footerLeft: 'Returning visits:',
        footerRight: `${this.returningPatientCount} returnees`,
      },
      {
        title: 'COLLECTION RATE (OVERALL)',
        value: `${collectionRate}%`,
        icon: 'percentage-outline',
        color: 'purple',
        stats: [
          {
            value: `${consultationCollectionRate}%`,
            label: 'Consult',
          },
          { value: `${otcCollectionRate}%`, label: 'Pharmacy' },
          { value: `${collectionRate}%`, label: 'Aggregate' },
        ],
      },
    ];
  }

  private updateCharts(data: AnalyticsSummary): void {
    const totalCharges =
      (data.consultationRevenueTotalAmount || 0) +
      (data.otcSalesTotalAmountOfMedicine || 0);
    const consultationAmount = data.consultationRevenueTotalAmount || 0;
    const otcAmount = data.otcSalesTotalAmountOfMedicine || 0;

    // Update Donut Chart for Revenue Segmentation
    this.donutChart.series =
      totalCharges > 0
        ? [
            Math.round((consultationAmount / totalCharges) * 100),
            Math.round((otcAmount / totalCharges) * 100),
          ]
        : [0, 0];

    // Update Billing Chart
    const consultationReceived = data.patientPaymentsTotalAmountPaid || 0;
    const otcReceived = (otcAmount || 0) - (data.pendingOtcAmount || 0);
    const consultationDue = Math.max(
      consultationAmount - consultationReceived,
      0,
    );
    const otcDue = data.pendingOtcAmount || 0;
    const totalReceived = consultationReceived + otcReceived;

    this.billingChart.series = [
      {
        name: 'Charges',
        data: [consultationAmount, otcAmount],
      },
      {
        name: 'Deposits',
        data: [consultationReceived, otcReceived],
      },
      {
        name: 'Dues',
        data: [
          Math.max(consultationAmount - consultationReceived, 0),
          data.pendingOtcAmount || 0,
        ],
      },
    ];

    this.grossPool = totalCharges;
    this.consultationAmount = consultationAmount;
    this.otcAmount = otcAmount;
    this.consultationReceived = consultationReceived;
    this.otcReceived = otcReceived;
    this.consultationDue = consultationDue;
    this.otcDue = otcDue;
    this.consultationPercent =
      totalCharges > 0
        ? Math.round((consultationAmount / totalCharges) * 100)
        : 0;
    this.otcPercent = totalCharges > 0 ? 100 - this.consultationPercent : 0;
    this.totalRealizedDeposits = totalReceived;

    this.updateDemographicChart(data);
  }

  private updateDemographicChart(data: AnalyticsSummary): void {
    const male = (data as any).maleCaseload || 0;
    const female = (data as any).femaleCaseload || 0;
    const other = (data as any).otherCaseload || 0;

    this.demographicChart.series = [male, female, other];
    this.demographicTotal = male + female + other;
  }

  private updateLineChart(): void {
    const categories = this.historyData.map((item) => item.date);
    const consultationSeries = this.historyData.map(
      (item) => item.consultationCharges || 0,
    );
    const otcSeries = this.historyData.map((item) => item.otcSales || 0);
    const realizedSeries = this.historyData.map(
      (item) => item.consultationReceived || 0,
    );

    this.lineChart.series = [
      {
        name: 'Consultation Charges',
        data: consultationSeries,
      },
      {
        name: 'Pharmacy OTC Sales',
        data: otcSeries,
      },
      {
        name: 'Realized Receipts',
        data: realizedSeries,
      },
    ];

    this.lineChart.xaxis.categories = categories;
  }

  private updatePatientChart(): void {
    const categories = this.historyData.map((item) => item.date);
    const intakeSeries = this.historyData.map((item) => item.intake || 0);
    const returningSeries = this.historyData.map((item) =>
      Math.max((item.appointmentCount || 0) - (item.intake || 0), 0),
    );

    this.patientChart.series = [
      {
        name: 'Fresh Registrations',
        data: intakeSeries,
      },
      {
        name: 'Returning Patients',
        data: returningSeries,
      },
    ];

    this.patientChart.xaxis.categories = categories;
  }

  // ======================================================
  // FILTER OPERATIONS
  // ======================================================

  setFilterType(type: 'Daily' | 'Weekly' | 'Monthly' | 'Custom'): void {
    this.filterType = type;
    this.loadAnalyticsData();
  }

  setStartDate(date: string): void {
    this.fromDate = date;
    this.loadAnalyticsData();
  }

  setEndDate(date: string): void {
    this.toDate = date;
    this.loadAnalyticsData();
  }

  setGenderFilter(gender: string): void {
    this.selectedGender = gender;
    this.loadAnalyticsData();
  }

  setRetentionStatusFilter(status: string): void {
    this.selectedRetentionStatus = status;
    this.loadAnalyticsData();
  }

  refreshData(): void {
    this.loadAnalyticsData();
  }

  // ======================================================
  // HISTORY TAB - DYNAMIC
  // ======================================================

  historySearch: string = '';

  get filteredHistoryData(): DailyBreakdown[] {
    if (!this.historySearch) {
      return this.historyData;
    }

    return this.historyData.filter((item) =>
      item.date.toLowerCase().includes(this.historySearch.toLowerCase()),
    );
  }

  // ======================================================
  // PAGINATION
  // ======================================================

  historyPage = 1;
  itemsPerPage = 8;

  get paginatedHistoryData(): DailyBreakdown[] {
    const start = (this.historyPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredHistoryData.slice(start, end);
  }

  get historyTotalPages(): number {
    return Math.ceil(this.filteredHistoryData.length / this.itemsPerPage);
  }

  prevHistoryPage(): void {
    if (this.historyPage > 1) {
      this.historyPage--;
    }
  }

  nextHistoryPage(): void {
    if (this.historyPage < this.historyTotalPages) {
      this.historyPage++;
    }
  }
}
