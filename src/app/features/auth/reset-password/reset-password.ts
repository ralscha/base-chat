import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form, minLength, required } from '@angular/forms/signals';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './reset-password.html',
})
export class ResetPasswordComponent {
  readonly #auth = inject(AuthService);

  protected resetPasswordModel = signal({
    username: '',
    password: '',
    confirmPassword: '',
  });

  protected resetPasswordForm = form(this.resetPasswordModel, (path) => {
    required(path.username, { message: 'Username is required.' });
    required(path.password, { message: 'Password is required.' });
    minLength(path.password, 8, { message: 'Minimum 8 characters.' });
    required(path.confirmPassword, { message: 'Please confirm your password.' });
  });

  protected passwordsMismatch = computed(() => {
    const { password, confirmPassword } = this.resetPasswordModel();
    return !!password && !!confirmPassword && password !== confirmPassword;
  });

  protected submitted = signal(false);
  protected error = signal('');
  protected loading = signal(false);
  protected success = signal(false);

  protected submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (this.resetPasswordForm().invalid() || this.passwordsMismatch()) {
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { username, password } = this.resetPasswordModel();
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


