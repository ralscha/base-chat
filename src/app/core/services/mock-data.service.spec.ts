import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Conversation } from '../models/conversation.model';
import { Message } from '../models/message.model';
import { MockDataService } from './mock-data.service';
import { StorageService } from './storage.service';

describe('MockDataService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('preserves existing account data when the seed marker is missing', () => {
    const mockData = TestBed.inject(MockDataService);
    const storage = TestBed.inject(StorageService);
    mockData.seed();
    storage.set('users', []);
    storage.set('contacts', []);
    storage.set('messages', []);
    storage.set('conversations', []);
    storage.remove('seeded');

    mockData.seed();

    expect(storage.get('users')).toEqual([]);
    expect(storage.get('contacts')).toEqual([]);
    expect(storage.get('messages')).toEqual([]);
    expect(storage.get('conversations')).toEqual([]);
  });

  it('seeds conversation summaries that match their latest message', () => {
    TestBed.inject(MockDataService).seed();
    const storage = TestBed.inject(StorageService);
    const messages = storage.get<Message[]>('messages')!;
    for (const conversation of storage.get<Conversation[]>('conversations')!) {
      const latest = messages
        .filter((message) => message.conversationId === conversation.id)
        .at(-1)!;
      expect(conversation.lastMessage).toBe(latest.text);
      expect(conversation.lastMessageAt).toBe(latest.timestamp);
      expect(conversation.lastMessageSenderId).toBe(latest.senderId);
    }
  });

  it('generates initials from names separated by whitespace', () => {
    expect(MockDataService.initials('  Alice\tNguyen ')).toBe('AN');
    expect(MockDataService.initials(' ')).toBe('');
  });
});
