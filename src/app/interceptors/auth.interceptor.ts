import { Injectable, Injector } from '@angular/core';
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
  private toastShown = false;

  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const auth = this.injector.get(AuthService);
    const token = auth.getToken();

    // ✅ login request me token mat bhejo
    const isLoginCall = req.url.includes('/api/Auth/login');

    let requestToSend = req;
    if (token && !isLoginCall) {
      requestToSend = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
    }

    return next.handle(requestToSend).pipe(
      catchError((err: HttpErrorResponse) => {
        // ✅ If unauthorized → logout + toast + redirect
        if (err.status === 401) {
          this.handle401();
        }
        return throwError(() => err);
      })
    );
  }

  private async handle401() {
    if (this.toastShown) return; // prevent spam
    this.toastShown = true;

    const auth = this.injector.get(AuthService);
    const router = this.injector.get(Router);
    const toastCtrl = this.injector.get(ToastController);

    // clear session
    auth.logout();

    // show toast
    const toast = await toastCtrl.create({
      message: 'Session expired. Please login again.',
      duration: 2000,
      position: 'top',
    });
    await toast.present();

    // redirect
    router.navigateByUrl('/auth/login');

    // allow future toasts after a short time
    setTimeout(() => (this.toastShown = false), 2500);
  }
}
