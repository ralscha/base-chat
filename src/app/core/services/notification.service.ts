import { Service, signal } from '@angular/core';

@Service()
export class NotificationService {
  readonly supported = typeof Notification !== 'undefined';

  readonly #permission = signal<NotificationPermission>(
    this.supported ? Notification.permission : 'denied',
  );
  readonly permission = this.#permission.asReadonly();

  async requestPermission(): Promise<void> {
    if (!this.supported || Notification.permission === 'granted') {
      this.#permission.set(Notification.permission);
      return;
    }
    const perm = await Notification.requestPermission();
    this.#permission.set(perm);
  }

  show(title: string, options?: NotificationOptions): void {
    if (!this.supported || Notification.permission !== 'granted') {
      return;
    }
    new Notification(title, { icon: '/favicon.ico', ...options });
  }
}
