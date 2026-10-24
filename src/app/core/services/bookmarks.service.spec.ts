import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Bookmark } from '../models/bookmark.model';
import { AuthService } from './auth.service';
import { BookmarksService, DEFAULT_COLLECTION } from './bookmarks.service';
import { ChatService } from './chat.service';
import { MockDataService } from './mock-data.service';
import { StorageService } from './storage.service';

describe('BookmarksService', () => {
  let auth: AuthService;
  let chat: ChatService;
  let bookmarks: BookmarksService;

  function loadServices(): void {
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { navigate: vi.fn() } }],
    });
    TestBed.inject(MockDataService).seed();
    auth = TestBed.inject(AuthService);
    chat = TestBed.inject(ChatService);
    bookmarks = TestBed.inject(BookmarksService);
  }

  beforeEach(() => {
    localStorage.clear();
    loadServices();
    auth.signIn('me', 'password123');
  });

  afterEach(() => vi.restoreAllMocks());

  it('persists references and restores collections and originals after reload', () => {
    const original = chat.getMessages('conv_alice')[0];
    expect(bookmarks.save(original.id).success).toBe(true);
    expect(bookmarks.createCollection('Travel').success).toBe(true);
    expect(bookmarks.move(original.id, 'Travel').success).toBe(true);

    const stored = TestBed.inject(StorageService).get<{ bookmarks: Bookmark[] }>('bookmarks')!;
    expect(Object.keys(stored.bookmarks[0]).sort()).toEqual(
      ['userId', 'messageId', 'conversationId', 'collection', 'savedAt'].sort(),
    );
    TestBed.resetTestingModule();
    loadServices();

    expect(bookmarks.collections()).toEqual([DEFAULT_COLLECTION, 'Travel']);
    expect(bookmarks.bookmarks()).toMatchObject([{ collection: 'Travel', message: original }]);
    expect(bookmarks.save(original.id).success).toBe(true);
    expect(bookmarks.bookmarks()).toHaveLength(1);
  });

  it('isolates saves and collections between users and sign-out', () => {
    const messageId = chat.getMessages('conv_alice')[0].id;
    bookmarks.save(messageId);
    bookmarks.createCollection('Private ideas');
    auth.signOut();
    expect(bookmarks.bookmarks()).toEqual([]);
    expect(bookmarks.collections()).toEqual([]);
    expect(bookmarks.save(messageId).success).toBe(false);

    auth.signIn('alice', 'pass1');
    expect(bookmarks.bookmarks()).toEqual([]);
    expect(bookmarks.collections()).toEqual([DEFAULT_COLLECTION]);
    bookmarks.save(messageId);
    bookmarks.remove(messageId);
    auth.signIn('me', 'password123');

    expect(bookmarks.isSaved(messageId)).toBe(true);
    expect(bookmarks.collections()).toContain('Private ideas');
  });

  it('rejects inaccessible, missing and sender-deleted messages', () => {
    const bobMessage = chat.getMessages('conv_bob')[0];
    const ownMessage = chat
      .getMessages('conv_alice')
      .find((message) => message.senderId === 'user_me')!;
    chat.deleteMessage(ownMessage.id);
    expect(bookmarks.save(ownMessage.id).success).toBe(false);
    auth.signIn('alice', 'pass1');

    expect(bookmarks.save(bobMessage.id).success).toBe(false);
    expect(bookmarks.save('missing').success).toBe(false);
    expect(bookmarks.bookmarks()).toEqual([]);
  });

  it('resolves sender-only deletion independently for each user without retaining content', () => {
    const original = chat
      .getMessages('conv_alice')
      .find((message) => message.senderId === 'user_me')!;
    bookmarks.save(original.id);
    auth.signIn('alice', 'pass1');
    bookmarks.save(original.id);
    auth.signIn('me', 'password123');
    chat.deleteMessage(original.id);

    expect(bookmarks.bookmarks()[0].message).toBeUndefined();
    auth.signIn('alice', 'pass1');
    expect(bookmarks.bookmarks()[0].message?.text).toBe(original.text);
    chat.deleteConversation('conv_alice');
    expect(bookmarks.bookmarks()[0].message).toBeUndefined();
    expect(bookmarks.remove(original.id).success).toBe(true);
    expect(bookmarks.bookmarks()).toEqual([]);
  });

  it('normalizes collection names and moves bookmarks case-insensitively', () => {
    const messageId = chat.getMessages('conv_alice')[0].id;
    bookmarks.save(messageId);
    expect(bookmarks.createCollection('  Trip   ideas  ').success).toBe(true);
    expect(bookmarks.createCollection('trip ideas').success).toBe(false);
    expect(bookmarks.createCollection('SAVED MESSAGES').success).toBe(false);
    expect(bookmarks.createCollection(' ').success).toBe(false);
    expect(bookmarks.move(messageId, '  TRIP ideas ').success).toBe(true);
    expect(bookmarks.bookmarks()[0].collection).toBe('Trip ideas');
    expect(bookmarks.move(messageId, 'unknown').success).toBe(false);
    expect(bookmarks.move(messageId, 'saved messages').success).toBe(true);
    expect(bookmarks.bookmarks()[0].collection).toBe(DEFAULT_COLLECTION);
  });

  it('preserves saved state and reports failed writes for every mutation', () => {
    const messages = chat.getMessages('conv_alice');
    bookmarks.save(messages[0].id);
    bookmarks.createCollection('Ideas');
    const previous = bookmarks.bookmarks();
    vi.spyOn(TestBed.inject(StorageService), 'set').mockReturnValue(false);

    expect(bookmarks.save(messages[1].id)).toMatchObject({
      success: false,
      error: expect.any(String),
    });
    expect(bookmarks.remove(messages[0].id).success).toBe(false);
    expect(bookmarks.move(messages[0].id, 'Ideas').success).toBe(false);
    expect(bookmarks.createCollection('Recipes').success).toBe(false);
    expect(bookmarks.deleteUserData('user_me')).toBe(false);
    expect(bookmarks.bookmarks()).toEqual(previous);
    expect(bookmarks.collections()).toEqual([DEFAULT_COLLECTION, 'Ideas']);
  });

  it('cleans affected references for all participants, including hidden conversations', () => {
    const original = chat.getMessages('conv_alice')[0];
    const unrelated = chat.getMessages('conv_bob')[0];
    bookmarks.save(original.id);
    bookmarks.save(unrelated.id);
    auth.signIn('alice', 'pass1');
    bookmarks.save(original.id);
    bookmarks.createCollection('Alice ideas');
    chat.deleteConversation('conv_alice');
    expect(bookmarks.deleteUserData('user_me')).toBe(false);
    expect(bookmarks.deleteUserData('user_alice')).toBe(true);
    expect(bookmarks.bookmarks()).toEqual([]);
    expect(bookmarks.collections()).toEqual([DEFAULT_COLLECTION]);

    auth.signIn('me', 'password123');
    expect(bookmarks.bookmarks().map((bookmark) => bookmark.messageId)).toEqual([unrelated.id]);
  });
});
