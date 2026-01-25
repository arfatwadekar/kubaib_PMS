import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: false,
})
export class LoginPage {
  constructor(private router: Router) {}

  goDashboard() {
    this.router.navigateByUrl('/dashboard');
  }
}
