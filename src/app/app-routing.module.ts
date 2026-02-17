import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [

  // 🔐 Login (inside auth module)
  {
    path: 'auth',
    loadChildren: () =>
      import('./pages/auth/auth.module')
        .then(m => m.AuthModule),
  },

  // 🔑 Forgot Password (no layout)
  {
    path: 'forgot-password',
    loadChildren: () =>
      import('./pages/forgot-password/forgot-password.module')
        .then(m => m.ForgotPasswordPageModule),
  },

  // 🔁 Reset Password (no layout)
  {
    path: 'reset-password',
    loadChildren: () =>
      import('./pages/reset-password/reset-password.module')
        .then(m => m.ResetPasswordPageModule),
  },

  // 🏠 Main Layout (Protected Area)
  {
    path: '',
    loadChildren: () =>
      import('./layouts/main-layout/main-layout.module')
        .then(m => m.MainLayoutModule),
  },

  // ❌ Wildcard
  {
    path: '**',
    redirectTo: 'auth/login',
  }

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules
    })
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
