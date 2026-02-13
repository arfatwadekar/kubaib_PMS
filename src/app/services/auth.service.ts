import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type UserRole = 'Doctor' | 'Receptionist';

export interface LoginRequest {
  username: string;
  password: string;
  roleMasterId: number;
}

export interface LoginResponse {
  accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly TOKEN_KEY = 'mhc_token';
  private readonly ROLE_KEY = 'mhc_role';
  private readonly USERNAME_KEY = 'mhc_username';

  constructor(private http: HttpClient) {}

  // ===============================
  // API
  // ===============================

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>(
      `${environment.apiBaseUrl}/api/Auth/login`,
      payload
    );
  }

  // ===============================
  // Session Management
  // ===============================

  setSession(
    token: string,
    role: UserRole,
    remember: boolean,
    username: string
  ): void {

    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.ROLE_KEY, role);

    if (remember) {
      localStorage.setItem(this.USERNAME_KEY, username);
    } else {
      localStorage.removeItem(this.USERNAME_KEY);
    }
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.ROLE_KEY);
  }

  // ===============================
  // Getters
  // ===============================

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRole(): UserRole | null {
    const role = localStorage.getItem(this.ROLE_KEY);
    return role === 'Doctor' || role === 'Receptionist'
      ? role
      : null;
  }

  getSavedUsername(): string {
    return localStorage.getItem(this.USERNAME_KEY) ?? '';
  }

  // ===============================
  // Auth Checks
  // ===============================

  isLoggedIn(): boolean {
    const token = this.getToken();
    return !!token && !this.isTokenExpired();
  }

  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp * 1000; // JWT exp is in seconds
      return Date.now() > expiry;
    } catch {
      return true; // invalid token treated as expired
    }
  }
}
