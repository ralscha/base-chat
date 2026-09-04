import { Service, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from './storage.service';
import { MockDataService } from './mock-data.service';
import { User, AuthSession } from '../models/user.model';

const SESSION_KEY = 'session';
const USERS_KEY = 'users';

interface AuthResult {
  success: boolean;
  error?: string;
}

@Service()
export class AuthService {
  readonly #storage = inject(StorageService);
  readonly #router = inject(Router);
  readonly #currentUser = signal<User | null>(null);
  readonly currentUser = this.#currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.#currentUser() !== null);

  constructor() {
    this.#restoreSession();
  }

  #restoreSession(): void {
    const session = this.#storage.get<AuthSession>(SESSION_KEY);
    if (!session || session.expiresAt <= Date.now()) {
      this.#storage.remove(SESSION_KEY);
      return;
    }
    const users = this.#storage.get<User[]>(USERS_KEY) ?? [];
    const user = users.find((u) => u.id === session.userId) ?? null;
    if (!user) {
      this.#storage.remove(SESSION_KEY);
    }
    this.#currentUser.set(user);
  }

  #getUsers(): User[] {
    return this.#storage.get<User[]>(USERS_KEY) ?? [];
  }

  #saveUsers(users: User[]): void {
    this.#storage.set(USERS_KEY, users);
  }

  signIn(username: string, password: string): AuthResult {
    const users = this.#getUsers();
    const normalizedUsername = username.trim().toLowerCase();
    const user = users.find((u) => u.username.toLowerCase() === normalizedUsername);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }
    if (!user.passwordHash) {
      return { success: false, error: 'This account uses passkey sign-in.' };
    }
    if (user.passwordHash !== password) {
      return { success: false, error: 'Incorrect password.' };
    }
    this.#startSession(user);
    return { success: true };
  }

  signUp(username: string, displayName: string, password: string, email?: string): AuthResult {
    return this.#register(username, displayName, password, email, false);
  }

  signUpWithPasskey(username: string, displayName: string, email?: string): AuthResult {
    return this.#register(username, displayName, '', email, true);
  }

  #register(
    username: string,
    displayName: string,
    password: string,
    email: string | undefined,
    withPasskey: boolean,
  ): AuthResult {
    const normalizedUsername = username.trim();
    const normalizedDisplayName = displayName.trim();
    if (!/^[a-zA-Z0-9_]{3,}$/.test(normalizedUsername)) {
      return { success: false, error: 'Enter a valid username with at least 3 characters.' };
    }
    if (normalizedDisplayName.length < 2) {
      return { success: false, error: 'Display name must be at least 2 characters.' };
    }
    if (!withPasskey && password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' };
    }

    const users = this.#getUsers();
    if (users.some((u) => u.username.toLowerCase() === normalizedUsername.toLowerCase())) {
      return { success: false, error: 'Username already taken.' };
    }
    const idx = users.length;
    const newUser: User = {
      id: 'user_' + MockDataService.uid(),
      username: normalizedUsername,
      email: email?.trim(),
      displayName: normalizedDisplayName,
      passwordHash: password,
      avatarInitials: MockDataService.initials(normalizedDisplayName),
      avatarColor: MockDataService.avatarColor(idx),
      createdAt: Date.now(),
      passkeys: withPasskey
        ? [{ id: MockDataService.uid(), name: 'Primary passkey', createdAt: Date.now() }]
        : [],
    };
    users.push(newUser);
    this.#saveUsers(users);
    this.#startSession(newUser);
    return { success: true };
  }

  signOut(): void {
    this.#storage.remove(SESSION_KEY);
    this.#currentUser.set(null);
    this.#router.navigate(['/auth/sign-in']);
  }

  updateProfile(
    updates: Partial<Pick<User, 'displayName' | 'avatarInitials' | 'avatarColor' | 'passkeys'>>,
  ): void {
    const current = this.#currentUser();
    if (!current) {
      return;
    }
    const users = this.#getUsers();
    const idx = users.findIndex((u) => u.id === current.id);
    if (idx === -1) {
      return;
    }
    const updated = { ...users[idx], ...updates };
    users[idx] = updated;
    this.#saveUsers(users);
    this.#currentUser.set(updated);
  }

  changePassword(
    currentPassword: string,
    newPassword: string,
  ): { success: boolean; error?: string } {
    const current = this.#currentUser();
    if (!current) {
      return { success: false, error: 'Not authenticated.' };
    }
    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' };
    }
    if (current.passwordHash && current.passwordHash !== currentPassword) {
      return { success: false, error: 'Current password is incorrect.' };
    }
    const users = this.#getUsers();
    const idx = users.findIndex((u) => u.id === current.id);
    if (idx === -1) {
      return { success: false, error: 'Account not found.' };
    }
    users[idx] = { ...users[idx], passwordHash: newPassword };
    this.#saveUsers(users);
    this.#currentUser.set(users[idx]);
    return { success: true };
  }

  deleteAccount(): void {
    const current = this.#currentUser();
    if (!current) {
      return;
    }
    const users = this.#getUsers().filter((u) => u.id !== current.id);
    this.#saveUsers(users);
    this.#storage.remove(SESSION_KEY);
    this.#currentUser.set(null);
  }

  // ── Passkey mock ─────────────────────────────────────────────────────────
  passkeyRegister(name: string): AuthResult {
    const current = this.#currentUser();
    if (!current) {
      return { success: false, error: 'Not authenticated.' };
    }
    const normalizedName = name.trim();
    if (!normalizedName) {
      return { success: false, error: 'Passkey name is required.' };
    }
    if (
      current.passkeys.some(
        (passkey) => passkey.name.toLowerCase() === normalizedName.toLowerCase(),
      )
    ) {
      return { success: false, error: 'A passkey with that name already exists.' };
    }
    const newKey = { id: MockDataService.uid(), name: normalizedName, createdAt: Date.now() };
    this.updateProfile({ passkeys: [...current.passkeys, newKey] });
    return { success: true };
  }

  passkeyRemove(passkeyId: string): AuthResult {
    const current = this.#currentUser();
    if (!current) {
      return { success: false, error: 'Not authenticated.' };
    }
    if (!current.passwordHash && current.passkeys.length === 1) {
      return { success: false, error: 'Set a password before removing your only passkey.' };
    }
    this.updateProfile({ passkeys: current.passkeys.filter((p) => p.id !== passkeyId) });
    return { success: true };
  }

  passkeySignIn(username: string): AuthResult {
    const users = this.#getUsers();
    const normalizedUsername = username.trim().toLowerCase();
    const user = users.find((candidate) => candidate.username.toLowerCase() === normalizedUsername);
    if (!user || user.passkeys.length === 0) {
      return { success: false, error: 'No passkey is registered for that username.' };
    }
    this.#startSession(user);
    return { success: true };
  }

  resetPassword(username: string, newPassword: string): AuthResult {
    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' };
    }
    const users = this.#getUsers();
    const normalizedUsername = username.trim().toLowerCase();
    const idx = users.findIndex((u) => u.username.toLowerCase() === normalizedUsername);
    if (idx === -1) {
      return { success: false, error: 'No account found with that username.' };
    }
    users[idx] = { ...users[idx], passwordHash: newPassword };
    this.#saveUsers(users);
    return { success: true };
  }

  getUserById(id: string): User | undefined {
    return this.#getUsers().find((u) => u.id === id);
  }

  findUserByUsername(username: string): User | undefined {
    const normalizedUsername = username.trim().toLowerCase();
    return this.#getUsers().find((u) => u.username.toLowerCase() === normalizedUsername);
  }

  #startSession(user: User): void {
    const session: AuthSession = {
      userId: user.id,
      token: MockDataService.uid(),
      expiresAt: Date.now() + 7 * 86_400_000, // 7 days
    };
    this.#storage.set(SESSION_KEY, session);
    this.#currentUser.set(user);
  }
}
