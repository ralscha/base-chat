import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { passwordsMatch } from '../../../shared/validators/passwords-match.validator';

@Component({
  selector: 'app-sign-up',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './sign-up.html',
})
export class SignUpComponent {
  readonly #fb = inject(FormBuilder);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);

  protected registrationMode = signal<'password' | 'passkey'>('password');

  protected form = this.#fb.nonNullable.group(
    {
      username: [
        '',
        [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9_]+$/)],
      ],
      email: ['', [Validators.required, Validators.email]],
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch('password', 'confirmPassword') },
  );

  protected error = signal('');
  protected loading = signal(false);
  protected showPasskeyPrompt = signal(false);
  protected passkeyLoading = signal(false);

  protected switchMode(mode: 'password' | 'passkey'): void {
    if (this.registrationMode() === mode) {
      return;
    }
    this.registrationMode.set(mode);
    this.error.set('');
    const pwCtrl = this.form.get('password')!;
    const cfCtrl = this.form.get('confirmPassword')!;
    if (mode === 'passkey') {
      pwCtrl.clearValidators();
      cfCtrl.clearValidators();
      pwCtrl.setValue('');
      cfCtrl.setValue('');
    } else {
      pwCtrl.setValidators([Validators.required, Validators.minLength(8)]);
      cfCtrl.setValidators(Validators.required);
    }
    pwCtrl.updateValueAndValidity();
    cfCtrl.updateValueAndValidity();
  }

  protected submit(): void {
    if (this.registrationMode() === 'password') {
      this.#submitPassword();
    } else {
      this.#startPasskeyFlow();
    }
  }

  #validateCommonFields(): boolean {
    ['username', 'email', 'displayName'].forEach((f) => this.form.get(f)?.markAsTouched());
    return ['username', 'email', 'displayName'].every((f) => this.form.get(f)?.valid);
  }

  #submitPassword(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { username, email, displayName, password } = this.form.getRawValue();
    const result = this.#auth.signUp(username, displayName, password, email);
    this.loading.set(false);
    if (result.success) {
      this.#router.navigate(['/conversations']);
    } else {
      this.error.set(result.error ?? 'Sign up failed.');
    }
  }

  #startPasskeyFlow(): void {
    if (!this.#validateCommonFields()) {
      return;
    }
    this.showPasskeyPrompt.set(true);
  }

  protected confirmPasskey(): void {
    this.passkeyLoading.set(true);
    this.error.set('');
    const { username, email, displayName } = this.form.getRawValue();
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
