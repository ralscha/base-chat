import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { MockDataService } from '../../core/services/mock-data.service';
import { Theme, ThemeService } from '../../core/services/theme.service';
import { passwordsMatch } from '../../shared/validators/passwords-match.validator';

@Component({
  selector: 'app-profile',
  host: { class: 'flex flex-col flex-1 min-h-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, AvatarComponent],
  templateUrl: './profile.html',
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  readonly #fb = inject(FormBuilder);
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
  protected pwForm = this.#fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch('newPassword', 'confirmPassword') },
  );
  protected pwError = signal('');
  protected pwSuccess = signal(false);

  protected changePassword(): void {
    if (this.pwForm.invalid) {
      this.pwForm.markAllAsTouched();
      return;
    }
    this.pwError.set('');
    const { currentPassword, newPassword } = this.pwForm.getRawValue();
    const result = this.auth.changePassword(currentPassword, newPassword);
    if (result.success) {
      this.pwSuccess.set(true);
      this.pwForm.reset();
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
