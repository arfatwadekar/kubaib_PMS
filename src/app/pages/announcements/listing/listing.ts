import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AnnouncementService } from 'src/app/services/announcement.service';
import { NotificationService } from 'src/app/services/notification.service';

export interface Announcement {
  id:             number;
  announcementId?: number;   // API may return this instead of id
  title:          string;
  description:    string;
  startDate:      string;
  endDate:        string;
  status:         number;    // 1 = Active | 0 = Inactive
  createdDate?:   string;
  createdOn?:     string;
}

@Component({
  selector:    'app-announcement-listing',
  templateUrl: './listing.html',
  styleUrls:   ['./listing.scss'],
  standalone:  false,
})
export class AnnouncementListingPage implements OnInit, OnDestroy {

  announcements: Announcement[] = [];
  loading = false;

  // ── Search & filter ──────────────────────────────────────────
  search       = '';
  statusFilter = '';          // '' | '1' | '2'  (API: 1=Active, 2=Inactive)

  // ── Pagination ───────────────────────────────────────────────
  pageNumber = 1;
  pageSize   = 2;
  totalCount = 0;

  private destroy$       = new Subject<void>();
  private searchSubject$ = new Subject<string>();
  private isSearchMode   = false;

  constructor(
    private svc:       AnnouncementService,
    private router:    Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
     private notificationService: NotificationService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.load();

    this.searchSubject$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.pageNumber = 1;
      this.runSearch();
    });
     this.loadNotifications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════════════════

  load(): void {
    this.loading      = true;
    this.isSearchMode = false;

    // Use search endpoint with no filters to get ALL announcements (active + inactive)
    // Plain GET /api/Announcement may return only active records by default
    this.svc.searchAnnouncements(undefined, undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next:  res  => this.handleResponse(res),
        error: ()   => {
          // Fallback to plain paginated endpoint if search fails
          this.svc.getAnnouncements(this.pageNumber, this.pageSize)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next:  res => this.handleResponse(res),
              error: ()  => this.handleError('Failed to load announcements.'),
            });
        },
      });
  }

  private handleResponse(res: any): void {
    const raw: any[] = res?.data ?? (Array.isArray(res) ? res : []);
    this.announcements = raw.map((a: any) => ({
      ...a,
      id:     a.id ?? a.announcementId,
      // API returns status as string ('Active'/'Inactive') or number (1/2)
      status: typeof a.status === 'number'
                ? a.status
                : a.status === 'Active' ? 1 : 2,
    }));
    this.totalCount = res?.totalCount ?? this.announcements.length;
    this.loading = false;
  }

  private handleError(msg: string): void {
    this.toast(msg, 'danger');
    this.loading = false;
  }

  // ═══════════════════════════════════════════════════════════
  // SEARCH / FILTER
  // ═══════════════════════════════════════════════════════════

  onSearchInput(): void {
    this.searchSubject$.next(this.search);
  }

  setStatus(val: string): void {
    this.statusFilter = val;
    this.pageNumber   = 1;
    if (val === '' && !this.search.trim()) {
      // All + no search → straight load, clears search mode
      this.load();
    } else {
      this.runSearch();
    }
  }

  private runSearch(): void {
    const title  = this.search.trim();
    const status = this.statusFilter;

    // No filters at all → use plain paginated load
    if (!title && status === '') {
      this.load();
      return;
    }

    this.loading      = true;
    this.isSearchMode = true;

    // Pass status=undefined when 'All' is selected so API returns every record
    this.svc.searchAnnouncements(
      title  || undefined,
      status !== '' ? +status : undefined,
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next:  res => this.handleResponse(res),
        error: ()  => this.handleError('Search failed.'),
      });
  }

  clearSearch(): void {
    this.search       = '';
    this.statusFilter = '';
    this.pageNumber   = 1;
    this.load();
  }

  get hasActiveFilters(): boolean {
    return !!(this.search.trim() || this.statusFilter);
  }

  // ═══════════════════════════════════════════════════════════
  // PAGINATION
  // ═══════════════════════════════════════════════════════════

  get totalPages(): number {
    return Math.ceil(this.totalCount / this.pageSize) || 1;
  }

  /** Returns page numbers to render, max 5 visible */
get pageRange(): number[] {

  const total = this.totalPages;
  const cur   = this.pageNumber;
  const delta = 2;

  const pages: number[] = [];

  if (total <= 7) {
    // small pages → show all
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {

    const start = Math.max(2, cur - delta);
    const end   = Math.min(total - 1, cur + delta);

    // first page
    pages.push(1);

    // left dots
    if (start > 2) {
      pages.push(-1);
    }

    // middle pages
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // right dots
    if (end < total - 1) {
      pages.push(-2);
    }

    // last page
    pages.push(total);
  }

  return pages;
}

  goToPage(p: number): void {
    if (p === this.pageNumber) return;
    this.pageNumber = p;
    this.isSearchMode ? this.runSearch() : this.load();
  }

  prevPage(): void {
    if (this.pageNumber > 1) this.goToPage(this.pageNumber - 1);
  }

  nextPage(): void {
    if (this.pageNumber < this.totalPages) this.goToPage(this.pageNumber + 1);
  }

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════

  create(): void          { this.router.navigate(['/announcements/create']); }
  edit(id: number): void  { this.router.navigate(['/announcements/edit', id]); }

  // ═══════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════

  async delete(id: number): Promise<void> {
    const item = this.announcements.find(a => a.id === id);

    const alert = await this.alertCtrl.create({
      header:   'Delete Announcement',
      message:  `Are you sure you want to delete <strong>"${item?.title ?? 'this announcement'}"</strong>? This cannot be undone.`,
      cssClass: 'custom-alert',
      buttons: [
        { text: 'Cancel',  role: 'cancel' },
        {
          text:     'Delete',
          role:     'destructive',
          cssClass: 'alert-btn-delete',
          handler:  () => this.confirmDelete(id),
        },
      ],
    });

    await alert.present();
  }

  private confirmDelete(id: number): void {
    this.svc.deleteAnnouncement(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          await this.toast('Announcement deleted.', 'success');
          this.pageNumber = 1;
          this.load();
        },
        error: () => this.toast('Failed to delete.', 'danger'),
      });
  }

  // ═══════════════════════════════════════════════════════════
  // TOGGLE STATUS
  // ═══════════════════════════════════════════════════════════

  toggleStatus(a: Announcement): void {
    const newStatus = a.status === 1 ? 2 : 1;
    const label     = newStatus === 1 ? 'Active' : 'Inactive';

    // Optimistic UI update
    a.status = newStatus;

    this.svc.updateAnnouncement(a.id, {
      title:       a.title,
      description: a.description,
      startDate:   a.startDate,
      endDate:     a.endDate,
      status:      newStatus,
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next:  () => this.toast(`Marked as ${label}.`, 'success'),
        error: () => {
          // Rollback on failure
          a.status = a.status === 1 ? 2 : 1;
          this.toast('Failed to update status.', 'danger');
        },
      });
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  statusLabel(status: number): string { return status === 1 ? 'Active' : 'Inactive'; }

  private async toast(message: string, color = 'primary'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2200, color, position: 'top' });
    await t.present();
  }

      unreadCount = 0;
notifications: any[] = [];
async loadNotifications() {
  const res: any = await this.notificationService.getNotifications().toPromise();

  this.notifications = res || [];

  this.unreadCount = this.notifications.filter(n => !n.isRead).length;
}

openNotifications() {
  this.router.navigate(['/notifications']);
}

}