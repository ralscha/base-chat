import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { MockDataService } from './mock-data.service';
import { StorageService } from './storage.service';

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { navigate: vi.fn() } }],
    });
  });

  it('supports adding a password to a passkey-only account', () => {
    TestBed.inject(MockDataService).seed();
    const auth = TestBed.inject(AuthService);
    expect(auth.signUpWithPasskey('new_user', 'New User', 'new@example.com').success).toBe(true);

    auth.signOut();
    expect(auth.signIn('new_user', '')).toEqual({
      success: false,
      error: 'This account uses passkey sign-in.',
    });
    expect(auth.passkeySignIn('new_user').success).toBe(true);
    expect(auth.passkeyRemove(auth.currentUser()!.passkeys[0].id).success).toBe(false);

    expect(auth.changePassword('', 'new-password').success).toBe(true);
    expect(auth.passkeyRemove(auth.currentUser()!.passkeys[0].id).success).toBe(true);
    auth.signOut();
    expect(auth.signIn('new_user', 'new-password').success).toBe(true);
  });

  it('discards a session that references a missing user', () => {
    const storage = TestBed.inject(StorageService);
    storage.set('session', {
      userId: 'missing',
      token: 'invalid',
      expiresAt: Date.now() + 60_000,
    });

    const auth = TestBed.inject(AuthService);

    expect(auth.isAuthenticated()).toBe(false);
    expect(storage.get('session')).toBeNull();
  });
});
