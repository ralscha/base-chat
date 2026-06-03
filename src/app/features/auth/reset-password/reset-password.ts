import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { passwordsMatch } from '../../../shared/validators/passwords-match.validator';

@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
})
export class ResetPasswordComponent {
  readonly #fb = inject(FormBuilder);
  readonly #auth = inject(AuthService);

  protected form = this.#fb.nonNullable.group(
    {
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch('password', 'confirmPassword') },
  );

  protected error = signal('');
  protected loading = signal(false);
  protected success = signal(false);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { username, password } = this.form.getRawValue();
    setTimeout(() => {
      this.loading.set(false);
      const result = this.#auth.resetPassword(username, password);
      if (!result.success) {
        this.error.set(result.error ?? 'No account found with that username.');
        return;
      }
      this.success.set(true);
    }, 600);
  }
}
