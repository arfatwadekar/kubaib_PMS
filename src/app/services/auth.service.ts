import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type UserRole = 'Doctor' | 'Receptionist';

export interface LoginRequest {
  username: string;
  password: string;
  roleMasterId: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private TOKEN_KEY = 'mhc_token';
  private ROLE_KEY = 'mhc_role';
  private USERNAME_KEY = 'mhc_username';

  constructor(private http: HttpClient) {}

  login(payload: LoginRequest) {
    return this.http.post<any>(`${environment.apiBaseUrl}/api/Auth/login`, payload);
  }

  setSession(token: string, role: UserRole, remember: boolean, username: string) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.ROLE_KEY, role);

    if (remember) localStorage.setItem(this.USERNAME_KEY, username);
    else localStorage.removeItem(this.USERNAME_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRole(): UserRole | null {
    return (localStorage.getItem(this.ROLE_KEY) as UserRole) || null;
  }

  getSavedUsername(): string {
    return localStorage.getItem(this.USERNAME_KEY) || '';
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.ROLE_KEY);
  }
}
