import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
})
export class ForgotPasswordComponent {
  readonly #fb = inject(FormBuilder);
  readonly #auth = inject(AuthService);

  protected form = this.#fb.nonNullable.group({
    username: ['', Validators.required],
  });

  protected submitted = signal(false);
  protected error = signal('');
  protected loading = signal(false);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { username } = this.form.getRawValue();
    // Mock: verify the username exists
    setTimeout(() => {
      this.loading.set(false);
      const user = this.#auth.findUserByUsername(username);
      if (!user) {
        this.error.set('No account found with that username.');
      } else {
        this.submitted.set(true);
      }
    }, 600);
  }
}
