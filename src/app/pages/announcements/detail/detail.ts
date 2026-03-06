import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormBuilder, FormGroup, Validators,
  AbstractControl, ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { AnnouncementService } from 'src/app/services/announcement.service';

type PageMode = 'create' | 'edit' | 'view';

// ── Cross-field validator ────────────────────────────────────
function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value;
  const end   = group.get('endDate')?.value;
  return start && end && new Date(end) < new Date(start)
    ? { dateRange: true }
    : null;
}

@Component({
  selector:    'app-announcement-detail',
  templateUrl: './detail.html',
  styleUrls:   ['./detail.scss'],
  standalone:  false,
})
export class AnnouncementDetailPage implements OnInit, OnDestroy {

  form!: FormGroup;
  mode: PageMode = 'create';
  id!: number;

  loading = false;
  saving  = false;

  duplicateTitleError = false;

  private destroy$ = new Subject<void>();

  constructor(
    private fb:        FormBuilder,
    private route:     ActivatedRoute,
    private router:    Router,
    private toastCtrl: ToastController,
    private svc:       AnnouncementService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.buildForm();

    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const idParam    = params.get('id');
        const currentUrl = this.router.url;

        // Reset state on route change
        this.form.enable();
        this.loading             = false;
        this.saving              = false;
        this.duplicateTitleError = false;
        this.form.reset({ status: 1 });  // 1=Active, 2=Inactive

        if (currentUrl.includes('/view/')) {
          this.mode = 'view';
          this.id   = +idParam!;
          this.fetchAnnouncement();

        } else if (idParam) {
          this.mode = 'edit';
          this.id   = +idParam;
          this.fetchAnnouncement();

        } else {
          this.mode = 'create';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════
  // FORM BUILD
  // ═══════════════════════════════════════════════════════════

  private buildForm(): void {
    this.form = this.fb.group(
      {
        title:       ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
        description: ['', [Validators.required, Validators.minLength(5)]],
        startDate:   ['', Validators.required],
        endDate:     ['', Validators.required],
        status:      [1,  Validators.required],  // API: 1=Active, 2=Inactive,
      },
      { validators: dateRangeValidator },
    );

    // Clear duplicate flag when user edits title
    this.form.get('title')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.duplicateTitleError) {
          this.duplicateTitleError = false;
          const errs = { ...this.form.get('title')!.errors };
          delete errs['duplicate'];
          this.form.get('title')!.setErrors(Object.keys(errs).length ? errs : null);
        }
      });
  }

  // ═══════════════════════════════════════════════════════════
  // TEMPLATE HELPERS
  // ═══════════════════════════════════════════════════════════

  get f() { return this.form.controls; }

  isError(field: string): boolean {
    const ctrl = this.f[field];
    return ctrl.invalid && ctrl.touched;
  }

  get hasDateRangeError(): boolean {
    return (
      this.form.hasError('dateRange') &&
      !!this.f['startDate'].value &&
      !!this.f['endDate'].value
    );
  }

  // ═══════════════════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════════════════

  private fetchAnnouncement(): void {
    this.loading = true;

    this.svc.getAnnouncementById(this.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any) => {
          this.form.patchValue({
            title:       data.title,
            description: data.description,
            startDate:   data.startDate?.substring(0, 10),
            endDate:     data.endDate?.substring(0, 10),
            status:      typeof data.status === 'number'
                           ? data.status
                           : data.status === 'Active' ? 1 : 2,
          });
          if (this.mode === 'view') this.form.disable();
          this.loading = false;
        },
        error: () => {
          this.toast('Failed to load announcement.', 'danger');
          this.loading = false;
        },
      });
  }

  // ═══════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════

  async save(): Promise<void> {
    if (this.mode === 'view') return;

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.toast('Please fix the highlighted errors before submitting.', 'warning');
      return;
    }

    const payload = {
      ...this.form.value,
      startDate: `${this.form.value.startDate}T00:00:00`,
      endDate:   `${this.form.value.endDate}T00:00:00`,
    };

    this.saving = true;

    const call$ = this.mode === 'create'
      ? this.svc.createAnnouncement(payload)
      : this.svc.updateAnnouncement(this.id, payload);

    const successMsg = this.mode === 'create'
      ? 'Announcement created successfully.'
      : 'Announcement updated successfully.';

    call$.pipe(takeUntil(this.destroy$)).subscribe({
      next: async () => {
        await this.toast(successMsg, 'success');
        this.router.navigate(['/announcements']);
      },
      error: (err: any) => this.handleApiError(err),
    });
  }

  private handleApiError(err: any): void {
    this.saving = false;

    // Safely extract a searchable string from any error shape
    const raw    = err?.error;
    const msg    = typeof raw === 'string'
                     ? raw
                     : raw?.message
                       ?? raw?.title
                       ?? JSON.stringify(raw ?? '');
    const msgLow = msg.toLowerCase();

    const isDuplicate =
      err?.status === 409 ||
      msgLow.includes('duplicate') ||
      msgLow.includes('already exist') ||
      msgLow.includes('title');

    if (isDuplicate) {
      this.duplicateTitleError = true;
      this.form.get('title')!.setErrors({ duplicate: true });
      this.toast('This title already exists. Please use a unique title.', 'warning');
    } else {
      this.toast('Something went wrong. Please try again.', 'danger');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════

  cancel(): void  { this.router.navigate(['/announcements']); }
  goToEdit(): void { this.router.navigate(['/announcements/edit', this.id]); }

  // ═══════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════

  private async toast(message: string, color = 'primary'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2200, color, position: 'top' });
    await t.present();
  }
}