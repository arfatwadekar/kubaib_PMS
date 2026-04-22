// import { NgModule } from '@angular/core';
// import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

// const routes: Routes = [

//   // 🔐 Login (inside auth module)
//   {
//     path: 'auth',
//     loadChildren: () =>
//       import('./pages/auth/auth.module')
//         .then(m => m.AuthModule),
//   },

//   // 🔑 Forgot Password (no layout)
//   {
//     path: 'forgot-password',
//     loadChildren: () =>
//       import('./pages/forgot-password/forgot-password.module')
//         .then(m => m.ForgotPasswordPageModule),
//   },

//   // 🔁 Reset Password (no layout)
//   {
//     path: 'reset-password',
//     loadChildren: () =>
//       import('./pages/reset-password/reset-password.module')
//         .then(m => m.ResetPasswordPageModule),
//   },

//   // 🏠 Main Layout (Protected Area)
//   {
//     path: '',
//     loadChildren: () =>
//       import('./layouts/main-layout/main-layout.module')
//         .then(m => m.MainLayoutModule),
//   },

//   // ❌ Wildcard
//   {
//     path: '**',
//     redirectTo: 'auth/login',
//   }

// ];

// @NgModule({
//   imports: [
//     RouterModule.forRoot(routes, {
//       preloadingStrategy: PreloadAllModules
//     })
//   ],
//   exports: [RouterModule],
// })
// export class AppRoutingModule {}



import { NgModule } from '@angular/core';
import { RouterModule, Routes, NoPreloading } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [

  {
    path: 'auth',
    loadChildren: () =>
      import('./pages/auth/auth.module')
        .then(m => m.AuthModule),
  },

  {
    path: 'forgot-password',
    loadChildren: () =>
      import('./pages/forgot-password/forgot-password.module')
        .then(m => m.ForgotPasswordPageModule),
  },

  {
    path: 'reset-password',
    loadChildren: () =>
      import('./pages/reset-password/reset-password.module')
        .then(m => m.ResetPasswordPageModule),
  },

 {
  path: '',
  loadChildren: () =>
    import('./layouts/main-layout/main-layout.module')
      .then(m => m.MainLayoutModule),
  canActivate: [AuthGuard]   // ✅ ONLY THIS
},

  {
    path: '**',
    redirectTo: 'auth/login',
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: NoPreloading   // 🔥 KEY FIX
    })
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}