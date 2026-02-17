import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import {
  Medicine,
  MedicineService,
  MedicineListResponse
} from 'src/app/services/medicine.service';

@Component({
  selector: 'app-medicine-listing',
  templateUrl: './listing.html',
  styleUrls: ['./listing.scss'],
  standalone: false
})
export class ListingPage implements OnInit, OnDestroy {

  medicines: Medicine[] = [];
  page = 1;
  pageSize = 10;
  totalCount = 0;
  search = '';
  loading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private medicineService: MedicineService,
    private router: Router
  ) {}

  // ================= INIT =================
  ngOnInit(): void {

    this.loadMedicines();

    // 🔥 Auto refresh when coming back from detail page
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (this.router.url.includes('/medicines')) {
          this.loadMedicines();
        }
      });
  }

  // ================= LOAD DATA =================
  loadMedicines(): void {

    this.loading = true;

    this.medicineService
      .getAll(this.page, this.pageSize, this.search)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: MedicineListResponse) => {

          if (res.success) {
            this.medicines = res.data.items;
            this.totalCount = res.data.totalCount;
          } else {
            this.medicines = [];
          }

          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to load medicines', err);
          this.medicines = [];
          this.loading = false;
        }
      });
  }

  // ================= SEARCH =================
  onSearchChange(): void {
    this.page = 1;
    this.loadMedicines();
  }

  // ================= REFRESH =================
  refresh(): void {
    this.search = '';
    this.page = 1;
    this.loadMedicines();
  }

  // ================= NAVIGATION =================
  create(): void {
    this.router.navigate(['/medicines/create']);
  }

  edit(id: number): void {
    this.router.navigate(['/medicines/edit', id]);
  }

  // ================= DELETE =================
  delete(id: number): void {
    if (!confirm('Delete this medicine?')) return;

    this.medicineService.delete(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadMedicines());
  }

  // ================= STOCK BADGE =================
  getStockClass(stock: number): string {

    if (stock <= 50) return 'badge-red';
    if (stock <= 100) return 'badge-orange';
    return 'badge-green';
  }

  // ================= CLEANUP =================
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
