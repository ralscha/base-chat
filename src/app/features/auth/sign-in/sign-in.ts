import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sign-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './sign-in.html',
})
export class SignInComponent {
  readonly #fb = inject(FormBuilder);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);

  protected form = this.#fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected error = signal('');
  protected loading = signal(false);
  protected showPasskeyModal = signal(false);
  protected passkeyLoading = signal(false);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { username, password } = this.form.getRawValue();
    const result = this.#auth.signIn(username, password);
    this.loading.set(false);
    if (result.success) {
      this.#router.navigate(['/conversations']);
    } else {
      this.error.set(result.error ?? 'Sign in failed.');
    }
  }

  protected openPasskeyModal(): void {
    this.showPasskeyModal.set(true);
  }

  protected confirmPasskey(): void {
    this.passkeyLoading.set(true);
    setTimeout(() => {
      this.passkeyLoading.set(false);
      this.showPasskeyModal.set(false);
      const result = this.#auth.passkeySignIn();
      if (result.success) {
        this.#router.navigate(['/conversations']);
      } else {
        this.error.set('Passkey authentication failed. (No passkey registered for this demo.)');
      }
    }, 1200);
  }

  protected cancelPasskey(): void {
    this.showPasskeyModal.set(false);
  }
}
