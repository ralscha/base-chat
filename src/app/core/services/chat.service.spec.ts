import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDataService } from './account-data.service';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';
import { ContactsService } from './contacts.service';
import { MockDataService } from './mock-data.service';
import { StorageService } from './storage.service';
import { Conversation } from '../models/conversation.model';
import { Message } from '../models/message.model';

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
    vi.restoreAllMocks();
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

  it('does not downgrade a read receipt when the delivery timer fires', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    expect(chat.sendMessage('conv_alice', 'Read this immediately').success).toBe(true);

    auth.signOut();
    expect(auth.signIn('alice', 'pass1').success).toBe(true);
    chat.markConversationRead('conv_alice');
    vi.advanceTimersByTime(800);

    expect(chat.getMessages('conv_alice').at(-1)?.status).toBe('read');
    expect(TestBed.inject(StorageService).get<Message[]>('messages')?.at(-1)?.status).toBe('read');
  });

  it('does not rewrite storage when a conversation is already read', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    chat.markConversationRead('conv_alice');
    const save = vi.spyOn(TestBed.inject(StorageService), 'set');

    chat.markConversationRead('conv_alice');

    expect(save).not.toHaveBeenCalled();
  });

  it('keeps deleted message previews private to the sender', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const previous = chat.getMessages('conv_alice').at(-1)!;
    expect(chat.sendMessage('conv_alice', 'Visible to Alice').success).toBe(true);
    const sent = chat.getMessages('conv_alice').at(-1)!;

    chat.deleteMessage(sent.id);

    expect(chat.getConversation('conv_alice')?.lastMessage).toBe(previous.text);
    expect(
      chat.conversations().find((conversation) => conversation.id === 'conv_alice')?.lastMessage,
    ).toBe(previous.text);
    expect(chat.getMessages('conv_alice').some((message) => message.id === sent.id)).toBe(false);

    auth.signOut();
    expect(auth.signIn('alice', 'pass1').success).toBe(true);
    expect(chat.getConversation('conv_alice')?.lastMessage).toBe('Visible to Alice');
    expect(chat.getMessages('conv_alice').at(-1)?.id).toBe(sent.id);
  });

  it('derives previews from the latest visible message instead of stale stored metadata', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const latest = chat.getMessages('conv_alice').at(-1)!;

    expect(chat.getConversation('conv_alice')).toMatchObject({
      lastMessage: latest.text,
      lastMessageAt: latest.timestamp,
      lastMessageSenderId: latest.senderId,
    });
  });

  it('does not create a conversation when storage fails', () => {
    expect(auth.signIn('alice', 'pass1').success).toBe(true);
    const previous = chat.conversations();
    vi.spyOn(TestBed.inject(StorageService), 'set').mockReturnValue(false);

    expect(chat.getOrCreateConversation('user_bob')).toBeNull();
    expect(chat.conversations()).toEqual(previous);
  });

  it('rolls back a sent message when the conversation cannot be saved', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const storage = TestBed.inject(StorageService);
    const previousMessages = storage.get<Message[]>('messages');
    const previousConversation = chat.getConversation('conv_alice');
    const save = storage.set.bind(storage);
    vi.spyOn(storage, 'set').mockImplementation(
      (key, value) => key !== 'conversations' && save(key, value),
    );

    expect(chat.sendMessage('conv_alice', 'Cannot save').success).toBe(false);
    expect(storage.get<Message[]>('messages')).toEqual(previousMessages);
    expect(chat.getConversation('conv_alice')).toEqual(previousConversation);
  });

  it('keeps unread counts and receipts when saving read messages fails', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const storage = TestBed.inject(StorageService);
    const previousConversations = chat.conversations();
    const previousConversation = chat.getConversation('conv_alice');
    const previousMessages = chat.getMessages('conv_alice');
    const previousStoredConversations = storage.get<Conversation[]>('conversations');
    const save = storage.set.bind(storage);
    vi.spyOn(storage, 'set').mockImplementation(
      (key, value) => key !== 'messages' && save(key, value),
    );

    chat.markConversationRead('conv_alice');

    expect(chat.conversations()).toBe(previousConversations);
    expect(chat.getConversation('conv_alice')).toEqual(previousConversation);
    expect(chat.getMessages('conv_alice')).toEqual(previousMessages);
    expect(storage.get<Conversation[]>('conversations')).toEqual(previousStoredConversations);
  });

  it('keeps a message visible when saving its deletion fails', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const outgoing = chat
      .getMessages('conv_alice')
      .find((message) => message.senderId === 'user_me')!;
    vi.spyOn(TestBed.inject(StorageService), 'set').mockReturnValue(false);

    chat.deleteMessage(outgoing.id);

    expect(chat.getMessages('conv_alice')).toContainEqual(outgoing);
  });

  it('does not expose typing indicators from inaccessible conversations', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    chat.setPartnerTyping('conv_bob', true);
    expect(chat.isPartnerTyping('conv_bob')).toBe(true);

    auth.signOut();
    expect(auth.signIn('alice', 'pass1').success).toBe(true);

    expect(chat.isPartnerTyping('conv_bob')).toBe(false);
  });

  it('restores account data when saving its removal fails', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const storage = TestBed.inject(StorageService);
    const previousConversations = chat.conversations();
    const previousStoredConversations = storage.get<Conversation[]>('conversations');
    const previousMessages = chat.getMessages('conv_alice');
    const save = storage.set.bind(storage);
    vi.spyOn(storage, 'set').mockImplementation(
      (key, value) => key !== 'messages' && save(key, value),
    );

    expect(chat.deleteUserData('user_me')).toBe(false);
    expect(chat.conversations()).toEqual(previousConversations);
    expect(chat.getMessages('conv_alice')).toEqual(previousMessages);
    expect(storage.get<Conversation[]>('conversations')).toEqual(previousStoredConversations);
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

  it('persists quoted replies and keeps text and image message callers compatible', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const target = chat.getMessages('conv_alice').at(-1)!;

    expect(chat.sendMessage('conv_alice', '  See you there!  ', undefined, target.id).success).toBe(
      true,
    );
    const reply = chat.getMessages('conv_alice').at(-1)!;
    expect(reply).toMatchObject({ text: 'See you there!', replyToId: target.id });
    expect(chat.getReplyTarget(reply)).toEqual(target);

    const reloaded = TestBed.runInInjectionContext(() => new ChatService());
    expect(reloaded.getReplyTarget(reloaded.getMessages('conv_alice').at(-1)!)).toEqual(target);
    reloaded.ngOnDestroy();

    expect(chat.sendMessage('conv_alice', 'An ordinary message').success).toBe(true);
    expect(chat.getMessages('conv_alice').at(-1)?.replyToId).toBeUndefined();
    expect(chat.sendMessage('conv_alice', '', 'data:image/png;base64,image').success).toBe(true);
    expect(chat.getMessages('conv_alice').at(-1)).toMatchObject({
      text: '',
      imageDataUrl: 'data:image/png;base64,image',
    });
  });

  it('rejects missing, cross-conversation, and privately deleted reply targets', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const otherConversationTarget = chat.getMessages('conv_bob')[0];
    const hiddenTarget = chat
      .getMessages('conv_alice')
      .find((message) => message.senderId === 'user_me')!;
    chat.deleteMessage(hiddenTarget.id);
    const previousMessages = chat.getMessages('conv_alice');

    for (const targetId of ['', 'missing', otherConversationTarget.id, hiddenTarget.id]) {
      expect(chat.sendMessage('conv_alice', 'A reply', undefined, targetId).success).toBe(false);
    }
    expect(chat.getMessages('conv_alice')).toEqual(previousMessages);
  });

  it('respects per-user deletion when resolving quotes and hides inaccessible replies', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const target = chat
      .getMessages('conv_alice')
      .find((message) => message.senderId === 'user_me')!;
    expect(chat.sendMessage('conv_alice', 'A reply', undefined, target.id).success).toBe(true);
    const reply = chat.getMessages('conv_alice').at(-1)!;

    chat.deleteMessage(target.id);
    expect(chat.getReplyTarget(reply)).toBeUndefined();

    auth.signOut();
    expect(auth.signIn('alice', 'pass1').success).toBe(true);
    expect(chat.getReplyTarget(reply)).toMatchObject({ id: target.id });

    auth.signOut();
    expect(chat.getReplyTarget(reply)).toBeUndefined();
    expect(auth.signIn('bob', 'pass2').success).toBe(true);
    expect(chat.getReplyTarget(reply)).toBeUndefined();

    auth.signOut();
    expect(auth.signIn('alice', 'pass1').success).toBe(true);
    chat.deleteConversation('conv_alice');
    expect(chat.getReplyTarget(reply)).toBeUndefined();
  });

  it('resolves quotes from stored visible messages instead of forged or deleted source objects', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const target = chat.getMessages('conv_alice').at(-1)!;
    expect(chat.sendMessage('conv_alice', 'An ordinary message').success).toBe(true);
    const ordinary = chat.getMessages('conv_alice').at(-1)!;
    expect(chat.getReplyTarget({ ...ordinary, replyToId: target.id })).toBeUndefined();
    expect(chat.sendMessage('conv_alice', 'A reply', undefined, target.id).success).toBe(true);
    const reply = chat.getMessages('conv_alice').at(-1)!;
    chat.deleteMessage(reply.id);
    expect(chat.getReplyTarget(reply)).toBeUndefined();
  });

  it('does not retain a reply when saving fails', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const target = chat.getMessages('conv_alice').at(-1)!;
    const previousMessages = chat.getMessages('conv_alice');
    vi.spyOn(TestBed.inject(StorageService), 'set').mockReturnValue(false);

    expect(chat.sendMessage('conv_alice', 'A reply', undefined, target.id).success).toBe(false);
    expect(chat.getMessages('conv_alice')).toEqual(previousMessages);
  });

  it('persists shared checklists with trimmed content, previews, and unread counts', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);

    expect(
      chat.sendChecklist('conv_alice', '  Weekend plans  ', ['  Picnic  ', 'Train tickets'])
        .success,
    ).toBe(true);
    const message = chat.getMessages('conv_alice').at(-1)!;
    expect(message.checklist).toEqual({
      title: 'Weekend plans',
      items: [
        { id: expect.any(String), text: 'Picnic', completed: false },
        { id: expect.any(String), text: 'Train tickets', completed: false },
      ],
    });
    expect(new Set(message.checklist!.items.map((item) => item.id)).size).toBe(2);
    expect(chat.getConversation('conv_alice')).toMatchObject({
      lastMessage: 'Checklist: Weekend plans',
      unreadCounts: { user_alice: 1 },
    });

    const reloaded = TestBed.runInInjectionContext(() => new ChatService());
    expect(reloaded.getMessages('conv_alice').at(-1)?.checklist).toEqual(message.checklist);
    reloaded.ngOnDestroy();
  });

  it('lets both participants edit a shared checklist and preserves its position in the chat', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    expect(chat.sendChecklist('conv_alice', 'Groceries', ['Milk', 'Bread']).success).toBe(true);
    const original = chat.getMessages('conv_alice').at(-1)!;
    const [milk, bread] = original.checklist!.items;
    expect(chat.toggleChecklistItem(original.id, milk.id).success).toBe(true);

    auth.signOut();
    expect(auth.signIn('alice', 'pass1').success).toBe(true);
    expect(chat.toggleChecklistItem(original.id, milk.id).success).toBe(true);
    expect(chat.addChecklistItem(original.id, '  Apples  ').success).toBe(true);
    expect(chat.removeChecklistItem(original.id, bread.id).success).toBe(true);
    const updated = chat.getMessages('conv_alice').at(-1)!;
    expect(updated.timestamp).toBe(original.timestamp);
    expect(updated.checklist!.items).toEqual([
      { ...milk, completed: false },
      { id: expect.any(String), text: 'Apples', completed: false },
    ]);
    expect(chat.getConversation('conv_alice')?.unreadCounts['user_alice']).toBe(1);

    const reloaded = TestBed.runInInjectionContext(() => new ChatService());
    expect(reloaded.getMessages('conv_alice').at(-1)?.checklist).toEqual(updated.checklist);
    reloaded.ngOnDestroy();
  });

  it('allows an emptied checklist to be filled again', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    expect(chat.sendChecklist('conv_alice', 'Ideas', ['First idea']).success).toBe(true);
    const message = chat.getMessages('conv_alice').at(-1)!;

    expect(chat.removeChecklistItem(message.id, message.checklist!.items[0].id).success).toBe(true);
    expect(chat.getMessages('conv_alice').at(-1)?.checklist?.items).toEqual([]);
    expect(chat.addChecklistItem(message.id, 'A better idea').success).toBe(true);
    expect(chat.getMessages('conv_alice').at(-1)?.checklist?.items[0].text).toBe('A better idea');
  });

  it.each([
    { title: '', items: ['Item'] },
    { title: '   ', items: ['Item'] },
    { title: 'x'.repeat(101), items: ['Item'] },
    { title: 'Title', items: [] },
    { title: 'Title', items: [' '] },
    { title: 'Title', items: ['x'.repeat(201)] },
    { title: 'Title', items: Array.from({ length: 51 }, () => 'Item') },
  ])('rejects invalid checklist content: $title / $items.length items', ({ title, items }) => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const previousMessages = chat.getMessages('conv_alice');

    expect(chat.sendChecklist('conv_alice', title, items).success).toBe(false);
    expect(chat.getMessages('conv_alice')).toEqual(previousMessages);
  });

  it('enforces checklist item bounds and rejects missing items without changing data', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    expect(
      chat.sendChecklist(
        'conv_alice',
        'Full list',
        Array.from({ length: 50 }, () => 'Item'),
      ).success,
    ).toBe(true);
    const message = chat.getMessages('conv_alice').at(-1)!;

    expect(chat.addChecklistItem(message.id, 'Too many').success).toBe(false);
    expect(chat.addChecklistItem(message.id, '  ').success).toBe(false);
    expect(chat.addChecklistItem(message.id, 'x'.repeat(201)).success).toBe(false);
    expect(chat.toggleChecklistItem(message.id, 'missing').success).toBe(false);
    expect(chat.removeChecklistItem(message.id, 'missing').success).toBe(false);
    expect(chat.getMessages('conv_alice').at(-1)).toEqual(message);
  });

  it('rejects checklist mutations by signed-out users and other conversation participants', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    expect(chat.sendChecklist('conv_alice', 'Private list', ['Item']).success).toBe(true);
    const message = chat.getMessages('conv_alice').at(-1)!;
    const itemId = message.checklist!.items[0].id;

    auth.signOut();
    expect(chat.toggleChecklistItem(message.id, itemId).success).toBe(false);
    expect(chat.sendChecklist('conv_alice', 'New list', ['Item']).success).toBe(false);
    expect(auth.signIn('bob', 'pass2').success).toBe(true);
    expect(chat.toggleChecklistItem(message.id, itemId).success).toBe(false);
    expect(chat.addChecklistItem(message.id, 'Forbidden').success).toBe(false);
    expect(chat.removeChecklistItem(message.id, itemId).success).toBe(false);
    expect(chat.sendChecklist('conv_alice', 'New list', ['Item']).success).toBe(false);
  });

  it('rejects creating and editing checklists with a blocked contact', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    expect(chat.sendChecklist('conv_alice', 'Existing list', ['Item']).success).toBe(true);
    const message = chat.getMessages('conv_alice').at(-1)!;
    const itemId = message.checklist!.items[0].id;
    expect(contacts.toggleBlock(contacts.getContactByUserId('user_alice')!.id).success).toBe(true);

    expect(chat.sendChecklist('conv_alice', 'New list', ['Item']).success).toBe(false);
    expect(chat.toggleChecklistItem(message.id, itemId).success).toBe(false);
    expect(chat.addChecklistItem(message.id, 'Forbidden').success).toBe(false);
    expect(chat.removeChecklistItem(message.id, itemId).success).toBe(false);
    expect(chat.getMessages('conv_alice').at(-1)).toEqual(message);
  });

  it('rejects hidden checklist edits while allowing the other participant to keep using it', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    expect(chat.sendChecklist('conv_alice', 'Existing list', ['Item']).success).toBe(true);
    const message = chat.getMessages('conv_alice').at(-1)!;
    const itemId = message.checklist!.items[0].id;
    chat.deleteMessage(message.id);

    expect(chat.toggleChecklistItem(message.id, itemId).success).toBe(false);
    expect(chat.addChecklistItem(message.id, 'Forbidden').success).toBe(false);
    expect(chat.removeChecklistItem(message.id, itemId).success).toBe(false);

    auth.signOut();
    expect(auth.signIn('alice', 'pass1').success).toBe(true);
    expect(chat.toggleChecklistItem(message.id, itemId).success).toBe(true);
    chat.deleteConversation('conv_alice');
    expect(chat.toggleChecklistItem(message.id, itemId).success).toBe(false);
    expect(chat.addChecklistItem(message.id, 'Forbidden').success).toBe(false);
    expect(chat.removeChecklistItem(message.id, itemId).success).toBe(false);
  });

  it.each(['toggle', 'add', 'remove'])(
    'preserves checklist data when saving a %s fails',
    (operation) => {
      expect(auth.signIn('me', 'password123').success).toBe(true);
      expect(chat.sendChecklist('conv_alice', 'Saved list', ['Item']).success).toBe(true);
      const message = chat.getMessages('conv_alice').at(-1)!;
      const storage = TestBed.inject(StorageService);
      const storedMessages = storage.get<Message[]>('messages');
      vi.spyOn(storage, 'set').mockReturnValue(false);

      const result =
        operation === 'toggle'
          ? chat.toggleChecklistItem(message.id, message.checklist!.items[0].id)
          : operation === 'add'
            ? chat.addChecklistItem(message.id, 'Unsaved')
            : chat.removeChecklistItem(message.id, message.checklist!.items[0].id);

      expect(result.success).toBe(false);
      expect(chat.getMessages('conv_alice').at(-1)).toEqual(message);
      expect(storage.get<Message[]>('messages')).toEqual(storedMessages);
    },
  );

  it('rolls back checklist creation when conversation storage fails', () => {
    expect(auth.signIn('me', 'password123').success).toBe(true);
    const storage = TestBed.inject(StorageService);
    const previousMessages = storage.get<Message[]>('messages');
    const previousConversation = chat.getConversation('conv_alice');
    const save = storage.set.bind(storage);
    vi.spyOn(storage, 'set').mockImplementation(
      (key, value) => key !== 'conversations' && save(key, value),
    );

    expect(chat.sendChecklist('conv_alice', 'Unsaved list', ['Item']).success).toBe(false);
    expect(storage.get<Message[]>('messages')).toEqual(previousMessages);
    expect(chat.getConversation('conv_alice')).toEqual(previousConversation);
  });
});
