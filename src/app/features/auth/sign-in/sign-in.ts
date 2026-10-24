import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, FormRoot, form, required } from '@angular/forms/signals';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sign-in',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './sign-in.html',
})
export class SignInComponent {
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);

  protected signInModel = signal({
    username: '',
    password: '',
  });

  protected signInForm = form(this.signInModel, (path) => {
    required(path.username, { message: 'Username is required.' });
    required(path.password, { message: 'Password is required.' });
  });

  protected submitted = signal(false);
  protected error = signal('');
  protected showPasskeyModal = signal(false);

  protected submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (this.signInForm().invalid()) {
      return;
    }
    this.error.set('');
    const { username, password } = this.signInModel();
    const result = this.#auth.signIn(username, password);
    if (result.success) {
      this.#router.navigate(['/conversations']);
    } else {
      this.error.set(result.error ?? 'Sign in failed.');
    }
  }

  protected openPasskeyModal(): void {
    this.error.set('');
    this.showPasskeyModal.set(true);
  }

  protected confirmPasskey(): void {
    const username = this.signInModel().username.trim();
    if (!username) {
      this.showPasskeyModal.set(false);
      this.error.set('Enter your username before using passkey sign-in.');
      return;
    }
    this.showPasskeyModal.set(false);
    const result = this.#auth.passkeySignIn(username);
    if (result.success) {
      this.#router.navigate(['/conversations']);
    } else {
      this.error.set(result.error ?? 'Passkey authentication failed.');
    }
  }

  protected cancelPasskey(): void {
    this.showPasskeyModal.set(false);
  }
}
