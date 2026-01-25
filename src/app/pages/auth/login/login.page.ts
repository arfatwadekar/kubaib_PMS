import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, UserRole } from '../../../services/auth.service';

const ROLE_MASTER_ID: Record<UserRole, number> = {
  Doctor: 1,
  Receptionist: 2,
};

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  role: UserRole = 'Doctor';

  username = '';
  password = '';
  remember = true;

  loading = false;
  errorMessage = '';

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.username = this.auth.getSavedUsername();
  }

  setRole(role: UserRole) {
    this.role = role;
  }

  login() {
    this.errorMessage = '';
    if (!this.username || !this.password) {
      this.errorMessage = 'Invalid username or password';
      return;
    }

    this.loading = true;

    this.auth
      .login({
        username: this.username,
        password: this.password,
        roleMasterId: ROLE_MASTER_ID[this.role],
      })
      .subscribe({
        next: (res: any) => {
          // ✅ token mapping (adjust if backend key different)
          const token =
            res?.token ||
            res?.accessToken ||
            res?.data?.token ||
            res?.data?.accessToken;

          if (!token) {
            this.errorMessage = 'Invalid username or password';
            this.loading = false;
            return;
          }

          this.auth.setSession(token, this.role, this.remember, this.username);
this.router.navigateByUrl('/dashboard');
        },
        error: () => {
          this.errorMessage = 'Invalid username or password';
          this.loading = false;
        },
        complete: () => (this.loading = false),
      });
  }

  forgotPassword(){}
}
