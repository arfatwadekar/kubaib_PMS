import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { BlogService } from 'src/app/services/blog.service';

interface BlogCard {
  id: number;
  title: string;
  description: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  isActive: boolean;
  createdAt?: string;
}

@Component({
  selector: 'app-video-listing',
  templateUrl: './listing.html',
  styleUrls: ['./listing.scss'],
  standalone: false,
})
export class VideoListingPage implements OnInit, OnDestroy {

  blogs: BlogCard[] = [];
  search = '';
  loading = false;
  deletingId: number | null = null;
  Math = Math; // expose Math to template

  // ── Pagination ──────────────────────────
  pageNumber = 1;
  pageSize = 10;
  totalPages = 1;
  totalCount = 0;

  // ── Computed stats ──────────────────────
  get activeCount(): number {
    return this.blogs.filter(b => b.isActive).length;
  }

  get totalViews(): number {
    return this.blogs.reduce((sum, b) => sum + (b.viewCount || 0), 0);
  }

  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();

  constructor(private router: Router, private blogService: BlogService) {}

  // ═══════════════════════════════════════
  //  LIFECYCLE
  // ═══════════════════════════════════════

  ngOnInit(): void {
    // Debounced search — fires 350ms after user stops typing
    this.searchSubject$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(term => {
        this.pageNumber = 1;
        term ? this.runSearch(term) : this.loadBlogs();
      });

    this.loadBlogs();
  }

  // Ionic caches pages — ionViewWillEnter fires every time
  // the page becomes visible (including back navigation from detail)
  ionViewWillEnter(): void {
    this.loadBlogs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════
  //  LOAD / SEARCH
  // ═══════════════════════════════════════

  loadBlogs(): void {
    this.loading = true;
    this.blogService.getBlogs(this.pageNumber, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res  => { this.applyResponse(res); this.loading = false; },
        error: _err => { this.loading = false; }
      });
  }

  onSearch(): void {
    this.searchSubject$.next(this.search.trim());
  }

  clearSearch(): void {
    this.search = '';
    this.pageNumber = 1;
    this.loadBlogs();
  }

  private runSearch(term: string): void {
    this.loading = true;
    this.blogService.searchBlogs(term, this.pageNumber, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res   => { this.applyResponse(res); this.loading = false; },
        error: _err  => { this.loading = false; }
      });
  }

  // ═══════════════════════════════════════
  //  RESPONSE MAPPER
  // ═══════════════════════════════════════

  private applyResponse(res: any): void {
    // Support multiple API shapes:
    // { items, totalCount, totalPages }  ← paginated wrapper
    // { data, total }                    ← alternate wrapper
    // BlogCard[]                         ← plain array
    const items: any[] = res?.items ?? res?.data ?? (Array.isArray(res) ? res : []);

    this.totalCount = res?.totalCount ?? res?.total ?? items.length;
    this.totalPages = res?.totalPages ?? (Math.ceil(this.totalCount / this.pageSize) || 1);

    this.blogs = items.map(b => ({
      id:           b.blogId     ?? b.id,
      title:        b.title      ?? '—',
      description:  b.description ?? '',
      viewCount:    b.viewCount  ?? 0,
      likeCount:    b.likeCount  ?? 0,
      isActive:     b.isActive   ?? true,
      createdAt:    b.createdAt  ?? b.createdDate ?? null,
      thumbnailUrl: this.resolveThumbnail(b),
    }));
  }

  private resolveThumbnail(b: any): string {
    // ✅ Case 1: API returns thumbnailImage: { imageData, imagePath }
    if (b.thumbnailImage) {
      const t = b.thumbnailImage;
      if (t.imageData) {
        return t.imageData.startsWith('data:')
          ? t.imageData
          : 'data:image/png;base64,' + t.imageData;
      }
      if (t.imagePath) return t.imagePath; // fallback to file path if no base64
    }

    // Case 2: Direct thumbnail string
    if (b.thumbnail && typeof b.thumbnail === 'string') {
      return b.thumbnail.startsWith('data:') || b.thumbnail.startsWith('http')
        ? b.thumbnail
        : 'data:image/jpeg;base64,' + b.thumbnail;
    }

    // Case 3: images[] of strings or objects
    if (Array.isArray(b.images) && b.images.length) {
      const first = b.images[0];
      if (typeof first === 'string') {
        return first.startsWith('data:') ? first : 'data:image/jpeg;base64,' + first;
      }
      if (typeof first === 'object') {
        const raw = first.imageData ?? first.data ?? first.base64 ?? first.content ?? '';
        if (raw) return 'data:image/jpeg;base64,' + raw;
      }
    }

    // Case 4: imageUrl direct URL
    if (b.imageUrl) return b.imageUrl;

    return 'assets/default-thumbnail.jpg';
  }

  // ═══════════════════════════════════════
  //  PAGINATION
  // ═══════════════════════════════════════

  get pages(): number[] {
    // Show at most 5 pages around current page (sliding window)
    const delta = 2;
    const start = Math.max(1, this.pageNumber - delta);
    const end   = Math.min(this.totalPages, this.pageNumber + delta);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.pageNumber) return;
    this.pageNumber = p;
    this.search.trim() ? this.runSearch(this.search.trim()) : this.loadBlogs();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ═══════════════════════════════════════
  //  NAVIGATION
  // ═══════════════════════════════════════

  create(): void          { this.router.navigate(['/video-testimonials/create']); }
  edit(id: number): void  { this.router.navigate(['/video-testimonials/edit', id]); }
  view(id: number): void  { this.router.navigate(['/video-testimonials/view', id]); }

  // ═══════════════════════════════════════
  //  DELETE
  // ═══════════════════════════════════════

  delete(id: number): void {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;

    this.deletingId = id;

    this.blogService.deleteBlog(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.deletingId = null;
          this.blogs = this.blogs.filter(b => b.id !== id);
          this.totalCount = Math.max(0, this.totalCount - 1);
          // If current page becomes empty, go to previous page
          if (this.blogs.length === 0 && this.pageNumber > 1) {
            this.pageNumber--;
          }
          // Reload to keep pagination accurate
          this.search.trim() ? this.runSearch(this.search.trim()) : this.loadBlogs();
        },
        error: _err => {
          this.deletingId = null;
          // Optionally show a toast/alert here
        }
      });
  }

  // ═══════════════════════════════════════
  //  TRACK BY (performance)
  // ═══════════════════════════════════════

  trackById(_: number, b: BlogCard): number {
    return b.id;
  }
}