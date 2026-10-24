import { Service, signal } from '@angular/core';

@Service()
export class NotificationService {
  readonly supported = typeof Notification !== 'undefined';

  readonly #permission = signal<NotificationPermission>(
    this.supported ? Notification.permission : 'denied',
  );
  readonly permission = this.#permission.asReadonly();

  async requestPermission(): Promise<void> {
    if (!this.supported) {
      this.#permission.set('denied');
      return;
    }
    if (Notification.permission !== 'default') {
      this.#permission.set(Notification.permission);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      this.#permission.set(permission);
    } catch {
      this.#permission.set('denied');
    }
  }

  show(title: string, options?: NotificationOptions): void {
    if (!this.supported) {
      return;
    }
    this.#permission.set(Notification.permission);
    if (this.permission() !== 'granted') {
      return;
    }
    try {
      new Notification(title, { icon: '/favicon.svg', ...options });
    } catch {
      // Some browsers expose the API but require service-worker notifications.
    }
  }
}
