import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDataService } from './account-data.service';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';
import { BookmarksService } from './bookmarks.service';
import { ContactsService } from './contacts.service';
import { MockDataService } from './mock-data.service';
import { StorageService } from './storage.service';

describe('AccountDataService', () => {
  let auth: AuthService;
  let accountData: AccountDataService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { navigate: vi.fn() } }],
    });
    TestBed.inject(MockDataService).seed();
    auth = TestBed.inject(AuthService);
    auth.signIn('me', 'password123');
    accountData = TestBed.inject(AccountDataService);
  });

  afterEach(() => vi.restoreAllMocks());

  it('does not report a saved display name or synchronize contacts after a failed write', () => {
    const contacts = TestBed.inject(ContactsService);
    const sync = vi.spyOn(contacts, 'syncUser');
    vi.spyOn(TestBed.inject(StorageService), 'set').mockReturnValue(false);

    expect(accountData.updateDisplayName('New Name').success).toBe(false);
    expect(auth.currentUser()?.displayName).toBe('You');
    expect(sync).not.toHaveBeenCalled();
  });

  it('retains the account and session when message cleanup fails', () => {
    vi.spyOn(TestBed.inject(ChatService), 'deleteUserData').mockReturnValue(false);
    const removeContacts = vi.spyOn(TestBed.inject(ContactsService), 'deleteUserData');

    expect(accountData.deleteCurrentAccount().success).toBe(false);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getUserById('user_me')).toBeDefined();
    expect(removeContacts).not.toHaveBeenCalled();
  });

  it('retains account and conversation data when bookmark cleanup fails', () => {
    vi.spyOn(TestBed.inject(BookmarksService), 'deleteUserData').mockReturnValue(false);
    const removeChat = vi.spyOn(TestBed.inject(ChatService), 'deleteUserData');

    expect(accountData.deleteCurrentAccount().success).toBe(false);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getUserById('user_me')).toBeDefined();
    expect(removeChat).not.toHaveBeenCalled();
  });

  it('retains the account and session when contact cleanup fails', () => {
    vi.spyOn(TestBed.inject(ContactsService), 'deleteUserData').mockReturnValue(false);

    expect(accountData.deleteCurrentAccount().success).toBe(false);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getUserById('user_me')).toBeDefined();
  });

  it('cleans personal bookmarks and deleted-message references without removing unrelated saves', () => {
    const bookmarks = TestBed.inject(BookmarksService);
    const chat = TestBed.inject(ChatService);
    const sharedMessageId = chat.getMessages('conv_alice')[0].id;
    expect(bookmarks.save(sharedMessageId).success).toBe(true);
    expect(bookmarks.createCollection('My plans').success).toBe(true);

    expect(auth.signIn('alice', 'pass1').success).toBe(true);
    expect(bookmarks.save(sharedMessageId).success).toBe(true);
    expect(bookmarks.createCollection('Alice plans').success).toBe(true);
    const unrelatedConversation = chat.getOrCreateConversation('user_bob')!;
    expect(chat.sendMessage(unrelatedConversation.id, 'Keep this message').success).toBe(true);
    const unrelatedMessageId = chat.getMessages(unrelatedConversation.id).at(-1)!.id;
    expect(bookmarks.save(unrelatedMessageId).success).toBe(true);

    expect(auth.signIn('me', 'password123').success).toBe(true);
    expect(accountData.deleteCurrentAccount().success).toBe(true);
    expect(auth.signIn('alice', 'pass1').success).toBe(true);
    expect(bookmarks.bookmarks().map((bookmark) => bookmark.messageId)).toEqual([
      unrelatedMessageId,
    ]);
    expect(bookmarks.collections()).toContain('Alice plans');
    expect(bookmarks.collections()).not.toContain('My plans');
  });
});
