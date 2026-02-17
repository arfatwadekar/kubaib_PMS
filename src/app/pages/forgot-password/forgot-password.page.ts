import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: false
})
export class ForgotPasswordPage implements OnInit {

  form!: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    this.auth.forgotPassword(this.form.value.email)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: async () => {
          const toast = await this.toastCtrl.create({
            message: 'Password reset link sent to your email.',
            duration: 2500,
            color: 'success'
          });
          await toast.present();

          // Optional: navigate to login
          this.router.navigate(['/auth/login']);
        },
        error: async (err) => {
          const toast = await this.toastCtrl.create({
            message: err?.error?.message || 'Failed to send reset link.',
            duration: 2500,
            color: 'danger'
          });
          await toast.present();
        }
      });
  }
}
