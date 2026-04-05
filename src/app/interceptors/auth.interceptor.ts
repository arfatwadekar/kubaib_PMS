import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private isHandling401 = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    const token = this.auth.getToken();

    const isLoginCall = req.url.toLowerCase().includes('/auth/login');

    let authReq = req;

    if (token && !isLoginCall) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // if (error.status === 401) {
        //   this.handleUnauthorized();
        // }
        if (error.status === 401) {
  const isVerifyPasswordCall = req.url.toLowerCase().includes('/auth/verify-admin-password');
  
  if (!isVerifyPasswordCall) {
    this.handleUnauthorized();
  }
}
        return throwError(() => error);
      })
    );
  }

  private async handleUnauthorized(): Promise<void> {
    if (this.isHandling401) return;

    this.isHandling401 = true;

    try {
      this.auth.logout();

      const toast = await this.toastCtrl.create({
        message: 'Session expired. Please login again.',
        duration: 2000,
        position: 'top',
      });

      await toast.present();

      await this.router.navigateByUrl('/auth/login', {
        replaceUrl: true,
      });

    } finally {
      setTimeout(() => {
        this.isHandling401 = false;
      }, 2000);
    }
  }
}
