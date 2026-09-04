import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDataService } from './account-data.service';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';
import { ContactsService } from './contacts.service';
import { MockDataService } from './mock-data.service';

describe('ChatService', () => {
  let auth: AuthService;
  let chat: ChatService;
  let contacts: ContactsService;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { navigate: vi.fn() } }],
    });
    TestBed.inject(MockDataService).seed();
    auth = TestBed.inject(AuthService);
    contacts = TestBed.inject(ContactsService);
    chat = TestBed.inject(ChatService);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('only exposes conversations that belong to the signed-in user', () => {
    expect(auth.signIn('alice', 'pass1').success).toBe(true);

    expect(chat.conversations().map((conversation) => conversation.id)).toEqual(['conv_alice']);
    expect(chat.getConversation('conv_bob')).toBeUndefined();
    expect(chat.getMessages('conv_bob')).toEqual([]);
  });

  it('tracks unread messages separately for each participant', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    chat.markConversationRead('conv_alice');

    expect(chat.sendMessage('conv_alice', 'A new message').success).toBe(true);
    expect(chat.getConversation('conv_alice')?.unreadCounts['user_alice']).toBe(1);

    auth.signOut();
    expect(auth.signIn('alice', 'pass1').success).toBe(true);
    const conversation = chat.getConversation('conv_alice');
    expect(conversation).toBeDefined();
    expect(chat.getUnreadCount(conversation!)).toBe(1);

    chat.markConversationRead('conv_alice');
    expect(chat.getUnreadCount(chat.getConversation('conv_alice')!)).toBe(0);
    expect(chat.getMessages('conv_alice').at(-1)?.status).toBe('read');
  });

  it('prevents messaging a blocked contact', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const alice = contacts.getContactByUserId('user_alice');
    expect(alice).toBeDefined();
    contacts.toggleBlock(alice!.id);
    const messageCount = chat.getMessages('conv_alice').length;

    expect(chat.sendMessage('conv_alice', 'Should not send')).toEqual({
      success: false,
      error: 'Unblock this contact before sending a message.',
    });
    expect(chat.getMessages('conv_alice')).toHaveLength(messageCount);
  });

  it("does not let a user delete another participant's message", () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const incoming = chat
      .getMessages('conv_alice')
      .find((message) => message.senderId === 'user_alice');
    expect(incoming).toBeDefined();

    chat.deleteMessage(incoming!.id);

    expect(chat.getMessages('conv_alice').some((message) => message.id === incoming!.id)).toBe(
      true,
    );
  });

  it('removes account-owned contacts, conversations, and messages', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);

    TestBed.inject(AccountDataService).deleteCurrentAccount();

    expect(auth.getUserById('user_me')).toBeUndefined();
    expect(auth.signIn('alice', 'pass1').success).toBe(true);
    expect(chat.conversations()).toEqual([]);
    expect(contacts.getContactByUserId('user_me')).toBeUndefined();
  });
});
