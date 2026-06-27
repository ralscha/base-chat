import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  email,
  FormField,
  FormRoot,
  form,
  minLength,
  pattern,
  required,
} from '@angular/forms/signals';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sign-up',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './sign-up.html',
})
export class SignUpComponent {
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);

  protected registrationMode = signal<'password' | 'passkey'>('password');
  protected submitted = signal(false);

  protected signUpModel = signal({
    username: '',
    email: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });

  protected signUpForm = form(this.signUpModel, (path) => {
    required(path.username, { message: 'Username is required.' });
    minLength(path.username, 3, { message: 'Minimum 3 characters.' });
    pattern(path.username, /^[a-zA-Z0-9_]+$/, {
      message: 'Only letters, numbers and underscores.',
    });
    required(path.email, { message: 'Email is required.' });
    email(path.email, { message: 'Enter a valid email address.' });
    required(path.displayName, { message: 'Display name is required.' });
    minLength(path.displayName, 2, { message: 'Minimum 2 characters.' });
    required(path.password, {
      message: 'Password is required.',
      when: () => this.registrationMode() === 'password',
    });
    minLength(path.password, 8, {
      message: 'Minimum 8 characters.',
      when: () => this.registrationMode() === 'password',
    });
    required(path.confirmPassword, {
      message: 'Please confirm your password.',
      when: () => this.registrationMode() === 'password',
    });
  });

  protected passwordsMismatch = computed(() => {
    if (this.registrationMode() !== 'password') {
      return false;
    }
    const { password, confirmPassword } = this.signUpModel();
    return !!password && !!confirmPassword && password !== confirmPassword;
  });

  protected error = signal('');
  protected loading = signal(false);
  protected showPasskeyPrompt = signal(false);
  protected passkeyLoading = signal(false);

  protected switchMode(mode: 'password' | 'passkey'): void {
    if (this.registrationMode() === mode) {
      return;
    }
    this.registrationMode.set(mode);
    this.submitted.set(false);
    this.error.set('');
    if (mode === 'passkey') {
      this.signUpModel.update((model) => ({ ...model, password: '', confirmPassword: '' }));
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (this.registrationMode() === 'password') {
      this.#submitPassword();
    } else {
      this.#startPasskeyFlow();
    }
  }

  #commonFieldsValid(): boolean {
    return (
      this.signUpForm.username().valid() &&
      this.signUpForm.email().valid() &&
      this.signUpForm.displayName().valid()
    );
  }

  #submitPassword(): void {
    if (this.signUpForm().invalid() || this.passwordsMismatch()) {
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { username, email, displayName, password } = this.signUpModel();
    const result = this.#auth.signUp(username, displayName, password, email);
    this.loading.set(false);
    if (result.success) {
      this.#router.navigate(['/conversations']);
    } else {
      this.error.set(result.error ?? 'Sign up failed.');
    }
  }

  #startPasskeyFlow(): void {
    if (!this.#commonFieldsValid()) {
      return;
    }
    this.showPasskeyPrompt.set(true);
  }

  protected confirmPasskey(): void {
    this.passkeyLoading.set(true);
    this.error.set('');
    const { username, email, displayName } = this.signUpModel();
    setTimeout(() => {
      const result = this.#auth.signUpWithPasskey(username, displayName, email);
      this.passkeyLoading.set(false);
      this.showPasskeyPrompt.set(false);
      if (result.success) {
        this.#router.navigate(['/conversations']);
      } else {
        this.error.set(result.error ?? 'Passkey registration failed.');
      }
    }, 1200);
  }

  protected cancelPasskey(): void {
    this.showPasskeyPrompt.set(false);
  }
}
