import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => vi.restoreAllMocks());

  it('removes malformed JSON without throwing', () => {
    localStorage.setItem('chat_invalid', '{');

    expect(TestBed.inject(StorageService).get('invalid')).toBeNull();
    expect(localStorage.getItem('chat_invalid')).toBeNull();
  });

  it('preserves the saved value when given a value JSON cannot serialize', () => {
    const storage = TestBed.inject(StorageService);
    storage.set('example', 'saved');

    expect(storage.set('example', undefined)).toBe(false);
    expect(storage.get('example')).toBe('saved');
  });

  it('reports a browser storage write failure', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });

    expect(TestBed.inject(StorageService).set('example', 'value')).toBe(false);
  });

  it('clears only application-owned storage', () => {
    const storage = TestBed.inject(StorageService);
    storage.set('session', { token: 'demo' });
    storage.set('users', []);
    localStorage.setItem('unrelated', 'preserved');

    storage.clear();

    expect(storage.get('session')).toBeNull();
    expect(storage.get('users')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('preserved');
  });
});
