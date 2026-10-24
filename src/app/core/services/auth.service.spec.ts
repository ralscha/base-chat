import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../models/user.model';
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

  afterEach(() => vi.restoreAllMocks());

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

  it.each([
    { userId: 'user_me', token: 'token' },
    { userId: 'user_me', token: 'token', expiresAt: '2099-01-01' },
    { userId: 'user_me', expiresAt: Date.now() + 60_000 },
    { userId: 'user_me', token: '', expiresAt: Date.now() + 60_000 },
    { userId: 'user_me', token: 'token', expiresAt: 0 },
  ])('discards malformed or expired session metadata: %j', (session) => {
    TestBed.inject(MockDataService).seed();
    const storage = TestBed.inject(StorageService);
    storage.set('session', session);

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    expect(storage.get('session')).toBeNull();
  });

  it('keeps the active account synchronized after a password reset', () => {
    TestBed.inject(MockDataService).seed();
    const auth = TestBed.inject(AuthService);
    auth.signIn('me', 'password123');

    expect(auth.resetPassword(' ME ', 'reset-password').success).toBe(true);
    expect(auth.currentUser()?.passwordHash).toBe('reset-password');
    expect(auth.changePassword('password123', 'next-password').success).toBe(false);
    expect(auth.changePassword('reset-password', 'next-password').success).toBe(true);
  });

  it('checks password changes against the latest persisted account', () => {
    TestBed.inject(MockDataService).seed();
    const auth = TestBed.inject(AuthService);
    const storage = TestBed.inject(StorageService);
    auth.signIn('me', 'password123');
    storage.set(
      'users',
      storage
        .get<User[]>('users')!
        .map((user) =>
          user.id === 'user_me' ? { ...user, passwordHash: 'changed-elsewhere' } : user,
        ),
    );

    expect(auth.changePassword('password123', 'next-password')).toEqual({
      success: false,
      error: 'Current password is incorrect.',
    });
    expect(auth.changePassword('changed-elsewhere', 'next-password').success).toBe(true);
  });

  it('does not authenticate when the session cannot be saved', () => {
    TestBed.inject(MockDataService).seed();
    const auth = TestBed.inject(AuthService);
    const storage = TestBed.inject(StorageService);
    vi.spyOn(storage, 'set').mockReturnValue(false);

    expect(auth.signIn('me', 'password123').success).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
    expect(storage.get('session')).toBeNull();
  });

  it('does not create an account when browser storage rejects it', () => {
    const auth = TestBed.inject(AuthService);
    vi.spyOn(TestBed.inject(StorageService), 'set').mockReturnValue(false);

    expect(auth.signUp('new_user', 'New User', 'password123').success).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.findUserByUsername('new_user')).toBeUndefined();
  });

  it('explains when account creation succeeds but saving the session fails', () => {
    const auth = TestBed.inject(AuthService);
    const storage = TestBed.inject(StorageService);
    const save = storage.set.bind(storage);
    vi.spyOn(storage, 'set').mockImplementation(
      (key, value) => key !== 'session' && save(key, value),
    );

    const result = auth.signUp('new_user', 'New User', 'password123');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Your account was created');
    expect(auth.findUserByUsername('new_user')).toBeDefined();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('retains the saved profile, password, passkeys, and session after failed writes', () => {
    TestBed.inject(MockDataService).seed();
    const auth = TestBed.inject(AuthService);
    const storage = TestBed.inject(StorageService);
    auth.signIn('me', 'password123');
    const user = auth.currentUser();
    vi.spyOn(storage, 'set').mockReturnValue(false);

    expect(auth.updateProfile({ displayName: 'Changed' }).success).toBe(false);
    expect(auth.changePassword('password123', 'new-password').success).toBe(false);
    expect(auth.resetPassword('me', 'reset-password').success).toBe(false);
    expect(auth.passkeyRegister('New passkey').success).toBe(false);
    expect(auth.deleteAccount().success).toBe(false);

    expect(auth.currentUser()).toEqual(user);
    expect(auth.getUserById('user_me')).toEqual(user);
    expect(storage.get('session')).not.toBeNull();
  });

  it('does not remove a passkey that is no longer registered', () => {
    const auth = TestBed.inject(AuthService);
    auth.signUpWithPasskey('new_user', 'New User');

    expect(auth.passkeyRemove('missing')).toEqual({ success: false, error: 'Passkey not found.' });
    expect(auth.currentUser()?.passkeys).toHaveLength(1);
  });
});
