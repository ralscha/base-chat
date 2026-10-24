import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let presence: PresenceService;

  beforeEach(() => {
    vi.useFakeTimers();
    presence = new PresenceService();
  });

  afterEach(() => {
    presence.ngOnDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('changes each selected presence at most once per tick', () => {
    presence.initialize(['alice', 'bob']);
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    vi.advanceTimersByTime(15_000);

    expect(presence.status()).toEqual({ alice: false, bob: true });
  });

  it('flips a single tracked user even when two flips are requested', () => {
    presence.initialize(['alice']);
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    vi.advanceTimersByTime(15_000);

    expect(presence.isOnline('alice')).toBe(false);
  });

  it('treats unknown IDs as offline and tracks names inherited from Object', () => {
    expect(presence.isOnline('toString')).toBe(false);

    presence.track('toString');

    expect(Object.hasOwn(presence.status(), 'toString')).toBe(true);
    expect(presence.isOnline('toString')).toBe(false);
  });
});
