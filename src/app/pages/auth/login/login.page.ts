import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { AuthService, UserRole } from '../../../services/auth.service';

const ROLE_MASTER_ID: Record<UserRole, number> = {
  Doctor: 1,
  Receptionist: 2,
};

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone:false
})
export class LoginPage implements OnInit {
  role: UserRole = 'Doctor';
  form!: FormGroup;

  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.form = this.fb.group({
      username: [
        this.auth.getSavedUsername() ?? '',
        [Validators.required, Validators.minLength(3)],
      ],
     password: ['', [Validators.required]],
      remember: [true],
    });
  }

  setRole(role: UserRole): void {
    this.role = role;
  }

 login(): void {
  if (this.form.invalid || this.loading) {
    this.form.markAllAsTouched();
    return;
  }

  this.errorMessage = '';
  this.loading = true;

  const { username, password, remember } = this.form.value;

  this.auth.login({
    username: username.trim(),
    password: password.trim(),
    roleMasterId: ROLE_MASTER_ID[this.role],
  })
  .pipe(
    finalize(() => {
      this.loading = false;
    })
  )
  .subscribe({
    next: (res: any) => {

      // ✅ restore original flexible token mapping
      const token =
        res?.token ||
        res?.accessToken ||
        res?.data?.token ||
        res?.data?.accessToken;

      if (!token) {
        this.errorMessage = 'Invalid username or password';
        return;
      }

      this.auth.setSession(token, this.role, remember, username);

      // ✅ EXACT SAME redirect behavior
      this.router.navigateByUrl('/dashboard');

    },
    error: () => {
      this.errorMessage = 'Invalid username or password';
    }
  });
}


  private handleError(err?: any): void {
    this.errorMessage =
      err?.error?.message ||
      'Invalid username or password. Please try again.';
  }

  forgotPassword(): void {
    this.router.navigateByUrl('/forgot-password');
  }
}
