import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { AuthService, UserRole } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const allowedRoles = (route.data?.['roles'] as UserRole[]) || [];
    const role = this.auth.getRole();

    // not logged in → login
    if (!this.auth.isLoggedIn()) {
      return this.router.parseUrl('/auth/login');
    }

    // if route doesn't specify roles, allow
    if (!allowedRoles.length) return true;

    // allowed?
    if (role && allowedRoles.includes(role)) return true;

    // not allowed → back to dashboard
    return this.router.parseUrl('/dashboard');
  }
}
