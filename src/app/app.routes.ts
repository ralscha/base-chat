import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ── Auth ──────────────────────────────────────────────────────────────
  {
    path: 'auth',
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: 'sign-in',
        loadComponent: () =>
          import('./features/auth/sign-in/sign-in').then((m) => m.SignInComponent),
      },
      {
        path: 'sign-up',
        loadComponent: () =>
          import('./features/auth/sign-up/sign-up').then((m) => m.SignUpComponent),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password').then(
            (m) => m.ForgotPasswordComponent,
          ),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password').then(
            (m) => m.ResetPasswordComponent,
          ),
      },
      { path: '', redirectTo: 'sign-in', pathMatch: 'full' },
    ],
  },

  // ── App (authenticated) ───────────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./layouts/main-layout/main-layout').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'conversations',
        children: [
          {
            path: ':id',
            loadComponent: () =>
              import('./features/chat/chat-window/chat-window').then((m) => m.ChatWindowComponent),
          },
          {
            path: '',
            loadComponent: () =>
              import('./features/chat/chat-empty/chat-empty').then((m) => m.ChatEmptyComponent),
          },
        ],
      },
      {
        path: 'contacts',
        loadComponent: () =>
          import('./features/contacts/contacts').then((m) => m.ContactsComponent),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile').then((m) => m.ProfileComponent),
      },
      { path: '', redirectTo: 'conversations', pathMatch: 'full' },
    ],
  },

  // ── Fallback ──────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
