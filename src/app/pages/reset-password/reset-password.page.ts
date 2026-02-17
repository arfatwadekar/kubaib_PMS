import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: false
})
export class ResetPasswordPage implements OnInit {

  form!: FormGroup;
  loading = false;
  token = '';

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private auth: AuthService,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  ngOnInit(): void {

    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';

    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });
  }

  async submit() {

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.form.value.newPassword !== this.form.value.confirmPassword) {
      const toast = await this.toastCtrl.create({
        message: 'Passwords do not match.',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
      return;
    }

    if (!this.token) {
      const toast = await this.toastCtrl.create({
        message: 'Invalid or expired token.',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
      return;
    }

    this.loading = true;

    this.auth.resetPassword(this.token, this.form.value.newPassword)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: async () => {
          const toast = await this.toastCtrl.create({
            message: 'Password reset successful.',
            duration: 2500,
            color: 'success'
          });
          await toast.present();

          this.router.navigate(['/auth/login']);
        },
        error: async (err) => {
          const toast = await this.toastCtrl.create({
            message: err?.error?.message || 'Reset failed.',
            duration: 2500,
            color: 'danger'
          });
          await toast.present();
        }
      });
  }
}
