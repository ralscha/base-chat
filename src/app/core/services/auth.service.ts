import { Service, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from './storage.service';
import { MockDataService } from './mock-data.service';
import { User, AuthSession } from '../models/user.model';

const SESSION_KEY = 'session';
const USERS_KEY = 'users';

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
    if (!session || session.expiresAt < Date.now()) {
      this.#storage.remove(SESSION_KEY);
      return;
    }
    const users = this.#storage.get<User[]>(USERS_KEY) ?? [];
    const user = users.find((u) => u.id === session.userId) ?? null;
    this.#currentUser.set(user);
  }

  #getUsers(): User[] {
    return this.#storage.get<User[]>(USERS_KEY) ?? [];
  }

  #saveUsers(users: User[]): void {
    this.#storage.set(USERS_KEY, users);
  }

  signIn(username: string, password: string): { success: boolean; error?: string } {
    const users = this.#getUsers();
    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      return { success: false, error: 'User not found.' };
    }
    if (user.passwordHash !== password) {
      return { success: false, error: 'Incorrect password.' };
    }
    this.#startSession(user);
    return { success: true };
  }

  signUp(
    username: string,
    displayName: string,
    password: string,
    email?: string,
  ): { success: boolean; error?: string } {
    const users = this.#getUsers();
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, error: 'Username already taken.' };
    }
    const idx = users.length;
    const newUser: User = {
      id: 'user_' + MockDataService.uid(),
      username,
      email,
      displayName,
      passwordHash: password,
      avatarInitials: MockDataService.initials(displayName),
      avatarColor: MockDataService.avatarColor(idx),
      createdAt: Date.now(),
      passkeys: [],
    };
    users.push(newUser);
    this.#saveUsers(users);
    this.#startSession(newUser);
    return { success: true };
  }

  signUpWithPasskey(
    username: string,
    displayName: string,
    email?: string,
  ): { success: boolean; error?: string } {
    const users = this.#getUsers();
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, error: 'Username already taken.' };
    }
    const idx = users.length;
    const newKey = { id: MockDataService.uid(), name: 'Primary passkey', createdAt: Date.now() };
    const newUser: User = {
      id: 'user_' + MockDataService.uid(),
      username,
      email,
      displayName,
      passwordHash: '',
      avatarInitials: MockDataService.initials(displayName),
      avatarColor: MockDataService.avatarColor(idx),
      createdAt: Date.now(),
      passkeys: [newKey],
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
    if (current.passwordHash !== currentPassword) {
      return { success: false, error: 'Current password is incorrect.' };
    }
    const users = this.#getUsers();
    const idx = users.findIndex((u) => u.id === current.id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], passwordHash: newPassword };
      this.#saveUsers(users);
      this.#currentUser.set(users[idx]);
    }
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
  passkeyRegister(name: string): { success: boolean } {
    const current = this.#currentUser();
    if (!current) {
      return { success: false };
    }
    const newKey = { id: MockDataService.uid(), name, createdAt: Date.now() };
    this.updateProfile({ passkeys: [...current.passkeys, newKey] });
    return { success: true };
  }

  passkeyRemove(passkeyId: string): void {
    const current = this.#currentUser();
    if (!current) {
      return;
    }
    this.updateProfile({ passkeys: current.passkeys.filter((p) => p.id !== passkeyId) });
  }

  passkeySignIn(): { success: boolean } {
    // Mock: sign in as the "me" seed user when passkey flow completes
    const users = this.#getUsers();
    const user = users.find((u) => u.id === 'user_me');
    if (!user) {
      return { success: false };
    }
    this.#startSession(user);
    return { success: true };
  }

  resetPassword(username: string, newPassword: string): { success: boolean; error?: string } {
    const users = this.#getUsers();
    const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
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
    return this.#getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
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
