import { Component, computed, inject, signal } from '@angular/core';
import { FormField, FormRoot, form, minLength, required } from '@angular/forms/signals';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { MockDataService } from '../../core/services/mock-data.service';
import { Theme, ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-profile',
  host: { class: 'flex flex-col flex-1 min-h-0' },
  imports: [FormField, FormRoot, DatePipe, AvatarComponent],
  templateUrl: './profile.html',
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  readonly #router = inject(Router);

  protected user = this.auth.currentUser;

  // ── Display name ───────────────────────────────────────────────────────
  protected nameValue = signal(this.auth.currentUser()?.displayName ?? '');
  protected nameSaved = signal(false);
  protected nameError = signal('');
  protected hasNameChanges = computed(
    () => this.nameValue().trim() !== (this.user()?.displayName ?? ''),
  );
  protected currentThemeLabel = computed(() =>
    this.themeService.theme() === 'dark' ? 'Dark mode' : 'Light mode',
  );

  protected updateNameValue(value: string): void {
    this.nameValue.set(value);
    this.nameSaved.set(false);
    this.nameError.set('');
  }

  protected updateNameFromInput(event: Event): void {
    this.updateNameValue((event.target as HTMLInputElement).value);
  }

  protected saveName(): void {
    const name = this.nameValue().trim();
    if (!name) {
      this.nameError.set('Display name is required.');
      this.nameSaved.set(false);
      return;
    }
    if (name === (this.user()?.displayName ?? '')) {
      this.nameError.set('');
      return;
    }
    this.auth.updateProfile({
      displayName: name,
      avatarInitials: MockDataService.initials(name),
    });
    this.nameValue.set(name);
    this.nameError.set('');
    this.nameSaved.set(true);
  }

  protected resetName(): void {
    this.nameValue.set(this.user()?.displayName ?? '');
    this.nameSaved.set(false);
    this.nameError.set('');
  }

  protected setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  // ── Change password ────────────────────────────────────────────────────
  protected pwModel = signal({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  protected pwForm = form(this.pwModel, (path) => {
    required(path.currentPassword, { message: 'Current password is required.' });
    required(path.newPassword, { message: 'New password is required.' });
    minLength(path.newPassword, 8, { message: 'Minimum 8 characters.' });
    required(path.confirmPassword, { message: 'Please confirm your password.' });
  });
  protected pwMismatch = computed(() => {
    const { newPassword, confirmPassword } = this.pwModel();
    return !!newPassword && !!confirmPassword && newPassword !== confirmPassword;
  });
  protected pwSubmitted = signal(false);
  protected pwError = signal('');
  protected pwSuccess = signal(false);

  protected changePassword(event: Event): void {
    event.preventDefault();
    this.pwSubmitted.set(true);
    if (this.pwForm().invalid() || this.pwMismatch()) {
      return;
    }
    this.pwError.set('');
    const { currentPassword, newPassword } = this.pwModel();
    const result = this.auth.changePassword(currentPassword, newPassword);
    if (result.success) {
      this.pwSuccess.set(true);
      this.pwSubmitted.set(false);
      this.pwModel.set({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } else {
      this.pwError.set(result.error ?? 'Error changing password.');
    }
  }

  // ── Passkeys ───────────────────────────────────────────────────────────
  protected showPasskeyModal = signal(false);
  protected passkeyName = signal('');
  protected passkeyLoading = signal(false);
  protected passkeyError = signal('');

  protected openPasskeyModal(): void {
    this.passkeyName.set('My Device');
    this.passkeyError.set('');
    this.showPasskeyModal.set(true);
  }

  protected closePasskeyModal(): void {
    this.showPasskeyModal.set(false);
  }

  protected updatePasskeyName(event: Event): void {
    this.passkeyName.set((event.target as HTMLInputElement).value);
  }

  protected confirmAddPasskey(): void {
    if (!this.passkeyName().trim()) {
      this.passkeyError.set('Please enter a name for this passkey.');
      return;
    }
    this.passkeyLoading.set(true);
    setTimeout(() => {
      this.passkeyLoading.set(false);
      this.auth.passkeyRegister(this.passkeyName().trim());
      this.showPasskeyModal.set(false);
    }, 1000);
  }

  protected removePasskey(id: string): void {
    this.auth.passkeyRemove(id);
  }

  // ── Danger zone ────────────────────────────────────────────────────────
  protected showDeleteModal = signal(false);

  protected confirmDeleteAccount(): void {
    this.showDeleteModal.set(true);
  }

  protected doDeleteAccount(): void {
    this.auth.deleteAccount();
    this.#router.navigate(['/auth/sign-in']);
  }

  protected cancelDeleteAccount(): void {
    this.showDeleteModal.set(false);
  }
}
