import { Injectable, OnDestroy, signal } from '@angular/core';

// Mock presence: randomly shuffles online status of known user IDs
@Injectable({ providedIn: 'root' })
export class PresenceService implements OnDestroy {
  readonly #status = signal<Record<string, boolean>>({});
  readonly status = this.#status.asReadonly();

  #intervalId: ReturnType<typeof setInterval> | null = null;

  initialize(userIds: string[]): void {
    // Seed initial statuses
    const initial: Record<string, boolean> = {};
    userIds.forEach((id, i) => {
      initial[id] = i % 2 === 0;
    });
    this.#status.set(initial);

    // Randomly flip 1-2 statuses every 15 seconds
    this.#intervalId = setInterval(() => {
      this.#status.update((current) => {
        const ids = Object.keys(current);
        if (ids.length === 0) {
          return current;
        }
        const updated = { ...current };
        const flips = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < flips; i++) {
          const id = ids[Math.floor(Math.random() * ids.length)];
          updated[id] = !updated[id];
        }
        return updated;
      });
    }, 15_000);
  }

  isOnline(userId: string): boolean {
    return this.#status()[userId] ?? false;
  }

  ngOnDestroy(): void {
    if (this.#intervalId !== null) {
      clearInterval(this.#intervalId);
    }
  }
}
