import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  Router,
  UrlTree,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService, UserRole } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {

    // 1️⃣ Check authentication first
    if (!this.auth.isLoggedIn()) {
      return this.router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url },
      });
    }

    const allowedRoles = this.extractRoles(route);
    const userRole = this.auth.getRole();

    // 2️⃣ If no roles defined → allow
    if (!allowedRoles.length) {
      return true;
    }

    // 3️⃣ Check role access
    if (userRole && allowedRoles.includes(userRole)) {
      return true;
    }

    // 4️⃣ Unauthorized role → redirect to dashboard
    return this.router.createUrlTree(['/dashboard']);
  }

  private extractRoles(route: ActivatedRouteSnapshot): UserRole[] {
    const roles = route.data?.['roles'];
    return Array.isArray(roles) ? roles : [];
  }
}
