import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const pw = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return pw && confirm && pw !== confirm ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
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
    { validators: passwordsMatch },
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
      const user = this.#auth.findUserByUsername(username);
      if (!user) {
        this.error.set('No account found with that username.');
        return;
      }
      // Mock reset: directly update the password
      const users = JSON.parse(localStorage.getItem('chat_users') ?? '[]');
      const idx = users.findIndex(
        (u: { username: string }) => u.username.toLowerCase() === username.toLowerCase(),
      );
      if (idx !== -1) {
        users[idx].passwordHash = password;
        localStorage.setItem('chat_users', JSON.stringify(users));
      }
      this.success.set(true);
    }, 600);
  }
}
