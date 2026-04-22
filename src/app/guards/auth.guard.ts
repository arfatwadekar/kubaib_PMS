// import { Injectable } from '@angular/core';
// import {
  
//   CanActivate,
//   Router,
//   UrlTree,
//   ActivatedRouteSnapshot,
//   RouterStateSnapshot,
// } from '@angular/router';
// import { AuthService } from '../services/auth.service';

// @Injectable({ providedIn: 'root' })
// export class AuthGuard implements CanActivate {

//   constructor(
//     private auth: AuthService,
//     private router: Router
//   ) {}

//   canActivate(
//     route: ActivatedRouteSnapshot,
//     state: RouterStateSnapshot
//   ): boolean | UrlTree {

//     const token = this.auth.getToken();

//     // Basic check
//     if (!token) {
//       return this.router.createUrlTree(['/auth/login'], {
//         queryParams: { returnUrl: state.url },
//       });
//     }

//     // Optional: check token expiry
//     if (this.auth.isTokenExpired?.()) {
//       this.auth.logout();
//       return this.router.createUrlTree(['/auth/login']);
//     }

//     return true;
//   }
// }


import { Injectable } from '@angular/core';
import {
  CanActivate,
  CanMatch,
  Router,
  UrlTree,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Route,
  UrlSegment
} from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanMatch {

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  private checkAuth(url?: string): boolean | UrlTree {
    const token = this.auth.getToken();

    if (!token) {
      return this.router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: url }
      });
    }

    if (this.auth.isTokenExpired?.()) {
      this.auth.logout();
      return this.router.createUrlTree(['/auth/login']);
    }

    return true;
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {
    return this.checkAuth(state.url);
  }

  canMatch(
    route: Route,
    segments: UrlSegment[]
  ): boolean | UrlTree {
    const url = '/' + segments.map(s => s.path).join('/');
    return this.checkAuth(url);
  }
}