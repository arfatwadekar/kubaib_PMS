import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { BlogService } from 'src/app/services/blog.service';
import { NotificationService } from 'src/app/services/notification.service';

type PageMode = 'create' | 'edit' | 'view';

const MAX_IMAGES    = 4;
const MAX_SIZE_MB   = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

interface ExistingImage {
  imageId: number;
  src: string;   // resolved data URL or path
}

@Component({
  selector: 'app-video-detail',
  templateUrl: './detail.html',
  styleUrls: ['./detail.scss'],
  standalone: false,
})
export class VideoDetailPage implements OnInit, OnDestroy {

  form!: FormGroup;
  mode: PageMode = 'create';
  id!: number;

  loading   = false;
  saving    = false;
  liking    = false;
  viewCount = 0;
  likeCount = 0;

  // Images
  existingImages: ExistingImage[] = [];
  newFiles:    File[]   = [];
  newPreviews: string[] = [];
  imageError = '';

  // YouTube embed
  safeEmbedUrl: SafeResourceUrl | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private blogService: BlogService,
    private notificationService: NotificationService,
  ) {}

  // ═══════════════════════════════════════
  //  LIFECYCLE
  // ═══════════════════════════════════════

  ngOnInit(): void {
    this.form = this.fb.group({
      title:       ['', Validators.required],
      description: ['', Validators.required],
      videoUrl:    ['', Validators.required],
      isActive:    [true],
    });

    // Live YouTube embed preview
    this.form.get('videoUrl')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(url => (this.safeEmbedUrl = this.buildEmbedUrl(url)));

    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const idParam = params.get('id');
        const url     = this.router.url;

        if (url.includes('/view/')) {
          this.mode = 'view';
          this.id   = +idParam!;
          this.loadBlog(true);
        } else if (idParam) {
          this.mode = 'edit';
          this.id   = +idParam;
          this.loadBlog(false);
        } else {
          this.mode = 'create';
        }
      });

       this.loadNotifications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════
  //  LOAD
  // ═══════════════════════════════════════

  private loadBlog(isView: boolean): void {
    this.loading = true;

    this.blogService.getBlogById(this.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.form.patchValue({
            title:       res.title,
            description: res.description,
            videoUrl:    res.youTubeUrl ?? res.videoUrl ?? '',
            isActive:    res.isActive ?? true,
          });

          this.viewCount = res.viewCount ?? 0;
          this.likeCount = res.likeCount ?? 0;

          // ── Map images from API ──────────────────────────────────
          // API shape (from listing response):
          //   thumbnailImage: { blogImageId, imageData, imagePath, displayOrder }
          //   images: [ { blogImageId, imageData, imagePath, displayOrder }, ... ]
          this.existingImages = this.resolveImages(res);

          if (isView) {
            this.form.disable();
            this.blogService.incrementView(this.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe(() => this.viewCount++);
          }

          this.loading = false;
        },
        error: () => (this.loading = false),
      });
  }

  // ═══════════════════════════════════════
  //  IMAGE RESOLVER  (handles all API shapes)
  // ═══════════════════════════════════════

  private resolveImages(res: any): ExistingImage[] {
    const out: ExistingImage[] = [];

    // Helper: convert one image object to ExistingImage
    const toExisting = (img: any, fallbackId: number): ExistingImage | null => {
      if (!img) return null;

      const id  = img.blogImageId ?? img.imageId ?? img.id ?? fallbackId;
      const raw = img.imageData   ?? img.data    ?? img.base64 ?? img.content ?? '';
      const path = img.imagePath  ?? img.imageUrl ?? '';

      let src = '';
      if (raw) {
        src = raw.startsWith('data:') ? raw : 'data:image/png;base64,' + raw;
      } else if (path) {
        src = path;
      }

      return src ? { imageId: id, src } : null;
    };

    // 1. images[] — full list (preferred when present)
    if (Array.isArray(res.images) && res.images.length) {
      res.images.forEach((img: any, i: number) => {
        const mapped = typeof img === 'string'
          ? { imageId: i, src: img.startsWith('data:') ? img : 'data:image/jpeg;base64,' + img }
          : toExisting(img, i);
        if (mapped) out.push(mapped);
      });
      return out;
    }

    // 2. thumbnailImage — single object fallback
    if (res.thumbnailImage) {
      const mapped = toExisting(res.thumbnailImage, 0);
      if (mapped) out.push(mapped);
    }

    return out;
  }

  // ═══════════════════════════════════════
  //  IMAGE SELECTION
  // ═══════════════════════════════════════

  onImagesSelected(event: any): void {
    this.imageError = '';
    const files: File[] = Array.from(event.target.files ?? []);

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        this.imageError = 'Only JPG, PNG, or PDF files are allowed.';
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        this.imageError = `"${file.name}" exceeds the ${MAX_SIZE_MB} MB limit.`;
        return;
      }
      if (this.totalImageCount >= MAX_IMAGES) {
        this.imageError = `Maximum ${MAX_IMAGES} images allowed.`;
        return;
      }

      this.newFiles.push(file);

      const reader = new FileReader();
      reader.onload = () => this.newPreviews.push(reader.result as string);
      reader.readAsDataURL(file);
    }

    event.target.value = ''; // allow re-selection of same file
  }

  get totalImageCount(): number {
    return this.existingImages.length + this.newFiles.length;
  }

  // ═══════════════════════════════════════
  //  REMOVE IMAGE
  // ═══════════════════════════════════════

  removeNewImage(index: number): void {
    this.newFiles.splice(index, 1);
    this.newPreviews.splice(index, 1);
    this.imageError = '';
  }

  removeExistingImage(img: ExistingImage): void {
    if (!confirm('Delete this image permanently?')) return;

    this.blogService.deleteImage(img.imageId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.existingImages = this.existingImages.filter(i => i.imageId !== img.imageId);
          this.imageError = '';
        },
        error: () => alert('Failed to delete image. Please try again.'),
      });
  }

  // ═══════════════════════════════════════
  //  SAVE
  // ═══════════════════════════════════════

  save(): void {
    if (this.mode === 'view') return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const { title, description, videoUrl } = this.form.value;
    this.saving = true;

    const onSuccess = () => this.router.navigate(['/video-testimonials']);
    const onError   = () => (this.saving = false);

    if (this.mode === 'create') {
      this.blogService.createBlog(title, description, videoUrl, this.newFiles)
        .pipe(takeUntil(this.destroy$))
        .subscribe({ next: onSuccess, error: onError });
    } else {
      this.blogService.updateBlog(this.id, this.id, title, description, videoUrl, this.newFiles)
        .pipe(takeUntil(this.destroy$))
        .subscribe({ next: onSuccess, error: onError });
    }
  }

  // ═══════════════════════════════════════
  //  LIKE
  // ═══════════════════════════════════════

  like(): void {
    if (this.liking) return;
    this.liking = true;

    this.blogService.likeBlog(this.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.likeCount++; this.liking = false; },
        error: () => (this.liking = false),
      });
  }

  // ═══════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════

  cancel(): void { this.router.navigate(['/video-testimonials']); }
  edit(id: number): void { this.router.navigate(['/video-testimonials/edit', id]); }

  private buildEmbedUrl(url: string): SafeResourceUrl | null {
    if (!url?.trim()) return null;
    let videoId = '';
    try {
      const u = new URL(url);
      videoId = u.searchParams.get('v') ?? u.pathname.split('/').pop() ?? '';
    } catch {
      videoId = url.split('v=')[1]?.split('&')[0] ?? url.split('/').pop() ?? '';
    }
    if (!videoId) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${videoId}`
    );
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c?.invalid && c?.touched);
  }

  get pageTitle(): string {
    return this.mode === 'create' ? 'Add Testimonial'
         : this.mode === 'edit'   ? 'Edit Testimonial'
         :                          'View Testimonial';
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