import { Injectable, signal, computed, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { Conversation } from '../models/conversation.model';
import { Message } from '../models/message.model';
import { MockDataService } from './mock-data.service';

const CONV_KEY = 'conversations';
const MSG_KEY = 'messages';

@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly #storage = inject(StorageService);
  readonly #auth = inject(AuthService);
  readonly #conversations = signal<Conversation[]>([]);
  readonly #messages = signal<Message[]>([]);
  readonly #partnerTyping = signal<Record<string, boolean>>({});
  readonly #typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly conversations = computed(() => {
    const me = this.#auth.currentUser()?.id;
    return this.#conversations()
      .filter((c) => !c.deletedBy.includes(me ?? ''))
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  });

  constructor() {
    this.#load();
  }

  #load(): void {
    this.#conversations.set(this.#storage.get<Conversation[]>(CONV_KEY) ?? []);
    this.#messages.set(this.#storage.get<Message[]>(MSG_KEY) ?? []);
  }

  #saveConversations(): void {
    this.#storage.set(CONV_KEY, this.#conversations());
  }

  #saveMessages(): void {
    this.#storage.set(MSG_KEY, this.#messages());
  }

  getMessages(conversationId: string): Message[] {
    const me = this.#auth.currentUser()?.id;
    return this.#messages()
      .filter(
        (m) => m.conversationId === conversationId && !(m.deletedBySender && m.senderId === me),
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getConversation(id: string): Conversation | undefined {
    return this.#conversations().find((c) => c.id === id);
  }

  getOrCreateConversation(otherUserId: string): Conversation {
    const me = this.#auth.currentUser()!.id;
    const existing = this.#conversations().find(
      (c) => c.participantIds.includes(me) && c.participantIds.includes(otherUserId),
    );
    if (existing) {
      // Restore if previously deleted by me
      if (existing.deletedBy.includes(me)) {
        this.#updateConversation(existing.id, {
          deletedBy: existing.deletedBy.filter((id) => id !== me),
        });
      }
      return this.getConversation(existing.id)!;
    }
    const conv: Conversation = {
      id: 'conv_' + MockDataService.uid(),
      participantIds: [me, otherUserId],
      lastMessage: '',
      lastMessageAt: Date.now(),
      lastMessageSenderId: me,
      unreadCount: 0,
      deletedBy: [],
    };
    this.#conversations.update((list) => [conv, ...list]);
    this.#saveConversations();
    return conv;
  }

  sendMessage(conversationId: string, text: string, imageDataUrl?: string): void {
    const me = this.#auth.currentUser()!.id;
    const trimmedText = text.trim();
    const msg: Message = {
      id: MockDataService.uid(),
      conversationId,
      senderId: me,
      text: trimmedText,
      timestamp: Date.now(),
      status: 'sent',
      deletedBySender: false,
      ...(imageDataUrl ? { imageDataUrl } : {}),
    };
    this.#messages.update((msgs) => [...msgs, msg]);
    this.#saveMessages();

    this.#updateConversation(conversationId, {
      lastMessage: trimmedText || '📷 Image',
      lastMessageAt: msg.timestamp,
      lastMessageSenderId: me,
    });

    // Simulate delivery
    setTimeout(() => this.#updateMessageStatus(msg.id, 'delivered'), 800);
    // Simulate read
    setTimeout(() => this.#updateMessageStatus(msg.id, 'read'), 3000);
    // Simulate partner typing a response (visual demo)
    setTimeout(() => this.setPartnerTyping(conversationId, true), 1500);
  }

  #updateMessageStatus(messageId: string, status: Message['status']): void {
    this.#messages.update((msgs) => msgs.map((m) => (m.id === messageId ? { ...m, status } : m)));
    this.#saveMessages();
  }

  deleteMessage(messageId: string): void {
    this.#messages.update((msgs) =>
      msgs.map((m) => (m.id === messageId ? { ...m, deletedBySender: true } : m)),
    );
    this.#saveMessages();
  }

  deleteConversation(conversationId: string): void {
    const me = this.#auth.currentUser()!.id;
    const conv = this.getConversation(conversationId);
    if (!conv) {
      return;
    }
    this.#updateConversation(conversationId, { deletedBy: [...conv.deletedBy, me] });
  }

  markConversationRead(conversationId: string): void {
    const me = this.#auth.currentUser()?.id;
    if (!me) {
      return;
    }
    this.#updateConversation(conversationId, { unreadCount: 0 });
    // Mark all incoming messages as read
    this.#messages.update((msgs) =>
      msgs.map((m) =>
        m.conversationId === conversationId && m.senderId !== me && m.status !== 'read'
          ? { ...m, status: 'read' as const }
          : m,
      ),
    );
    this.#saveMessages();
  }

  getOtherParticipantId(conversation: Conversation): string {
    const me = this.#auth.currentUser()!.id;
    return conversation.participantIds.find((id) => id !== me)!;
  }

  setPartnerTyping(conversationId: string, typing: boolean): void {
    const existing = this.#typingTimers.get(conversationId);
    if (existing) {
      clearTimeout(existing);
      this.#typingTimers.delete(conversationId);
    }
    this.#partnerTyping.update((s) => ({ ...s, [conversationId]: typing }));
    if (typing) {
      const t = setTimeout(() => {
        this.#partnerTyping.update((s) => ({ ...s, [conversationId]: false }));
        this.#typingTimers.delete(conversationId);
      }, 3000);
      this.#typingTimers.set(conversationId, t);
    }
  }

  isPartnerTyping(conversationId: string): boolean {
    return this.#partnerTyping()[conversationId] ?? false;
  }

  addReaction(messageId: string, emoji: string): void {
    const me = this.#auth.currentUser()!.id;
    this.#messages.update((msgs) =>
      msgs.map((m) => {
        if (m.id !== messageId) {
          return m;
        }
        const reactions = { ...(m.reactions ?? {}) };
        const users = reactions[emoji] ?? [];
        if (users.includes(me)) {
          // Toggle off
          const updated = users.filter((id) => id !== me);
          if (updated.length === 0) {
            delete reactions[emoji];
          } else {
            reactions[emoji] = updated;
          }
        } else {
          reactions[emoji] = [...users, me];
        }
        return { ...m, reactions };
      }),
    );
    this.#saveMessages();
  }

  totalUnread(): number {
    return this.conversations().reduce((sum, c) => sum + c.unreadCount, 0);
  }

  #updateConversation(id: string, updates: Partial<Conversation>): void {
    this.#conversations.update((list) => list.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    this.#saveConversations();
  }
}
