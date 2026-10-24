import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not interrupt chat when the browser rejects notification construction', () => {
    const notification = vi.fn(function () {
      throw new TypeError('Use a service worker to show notifications');
    });
    Object.assign(notification, { permission: 'granted' });
    vi.stubGlobal('Notification', notification);
    const service = new NotificationService();

    expect(() => service.show('New message')).not.toThrow();
    expect(notification).toHaveBeenCalledOnce();
  });

  it('refreshes permission before displaying a notification', () => {
    const notification = Object.assign(
      vi.fn(function () {
        return {};
      }),
      { permission: 'granted' },
    );
    vi.stubGlobal('Notification', notification);
    const service = new NotificationService();
    notification.permission = 'denied';

    service.show('New message');

    expect(notification).not.toHaveBeenCalled();
    expect(service.permission()).toBe('denied');
  });

  it('handles browsers without notification support', async () => {
    vi.stubGlobal('Notification', undefined);
    const service = new NotificationService();

    await service.requestPermission();

    expect(service.supported).toBe(false);
    expect(service.permission()).toBe('denied');
    expect(() => service.show('New message')).not.toThrow();
  });
});
