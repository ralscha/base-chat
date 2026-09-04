import { OnDestroy, Service, computed, inject, signal } from '@angular/core';
import { Conversation } from '../models/conversation.model';
import { Message } from '../models/message.model';
import { AuthService } from './auth.service';
import { ContactsService } from './contacts.service';
import { MockDataService } from './mock-data.service';
import { StorageService } from './storage.service';

const CONVERSATIONS_KEY = 'conversations';
const MESSAGES_KEY = 'messages';

type StoredConversation = Omit<Conversation, 'unreadCounts'> & {
  unreadCounts?: Record<string, number>;
  unreadCount?: number;
};

export interface ChatActionResult {
  success: boolean;
  error?: string;
}

@Service()
export class ChatService implements OnDestroy {
  readonly #storage = inject(StorageService);
  readonly #auth = inject(AuthService);
  readonly #contacts = inject(ContactsService);
  readonly #conversations = signal<Conversation[]>([]);
  readonly #messages = signal<Message[]>([]);
  readonly #partnerTyping = signal<Record<string, boolean>>({});
  readonly #typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #statusTimers = new Set<ReturnType<typeof setTimeout>>();

  readonly conversations = computed(() => {
    const me = this.#auth.currentUser()?.id;
    if (!me) {
      return [];
    }
    return this.#conversations()
      .filter(
        (conversation) =>
          conversation.participantIds.includes(me) && !conversation.deletedBy.includes(me),
      )
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  });

  constructor() {
    this.#load();
  }

  #load(): void {
    const stored = this.#storage.get<StoredConversation[]>(CONVERSATIONS_KEY) ?? [];
    let migrated = false;
    const conversations = stored.map((storedConversation): Conversation => {
      if (storedConversation.unreadCounts) {
        return storedConversation as Conversation;
      }
      migrated = true;
      const { unreadCount = 0, ...conversation } = storedConversation;
      return {
        ...conversation,
        unreadCounts: { [conversation.participantIds[0]]: unreadCount },
      } as Conversation;
    });
    this.#conversations.set(conversations);
    this.#messages.set(this.#storage.get<Message[]>(MESSAGES_KEY) ?? []);
    if (migrated) {
      this.#saveConversations();
    }
  }

  #saveConversations(): boolean {
    return this.#storage.set(CONVERSATIONS_KEY, this.#conversations());
  }

  #saveMessages(): boolean {
    return this.#storage.set(MESSAGES_KEY, this.#messages());
  }

  getMessages(conversationId: string): Message[] {
    if (!this.getConversation(conversationId)) {
      return [];
    }
    const me = this.#auth.currentUser()?.id;
    return this.#messages()
      .filter(
        (message) =>
          message.conversationId === conversationId &&
          !(message.deletedBySender && message.senderId === me),
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getConversation(id: string): Conversation | undefined {
    const me = this.#auth.currentUser()?.id;
    if (!me) {
      return undefined;
    }
    return this.#conversations().find(
      (conversation) =>
        conversation.id === id &&
        conversation.participantIds.includes(me) &&
        !conversation.deletedBy.includes(me),
    );
  }

  getOrCreateConversation(otherUserId: string): Conversation | null {
    const me = this.#auth.currentUser()?.id;
    if (
      !me ||
      otherUserId === me ||
      !this.#auth.getUserById(otherUserId) ||
      this.#contacts.isBlocked(otherUserId)
    ) {
      return null;
    }
    const existing = this.#conversations().find(
      (conversation) =>
        conversation.participantIds.includes(me) &&
        conversation.participantIds.includes(otherUserId),
    );
    if (existing) {
      if (existing.deletedBy.includes(me)) {
        this.#updateConversation(existing.id, {
          deletedBy: existing.deletedBy.filter((id) => id !== me),
        });
      }
      return this.getConversation(existing.id) ?? null;
    }

    const conversation: Conversation = {
      id: 'conv_' + MockDataService.uid(),
      participantIds: [me, otherUserId],
      lastMessage: '',
      lastMessageAt: Date.now(),
      lastMessageSenderId: me,
      unreadCounts: { [me]: 0, [otherUserId]: 0 },
      deletedBy: [],
    };
    this.#conversations.update((list) => [conversation, ...list]);
    this.#saveConversations();
    return conversation;
  }

  sendMessage(conversationId: string, text: string, imageDataUrl?: string): ChatActionResult {
    const me = this.#auth.currentUser()?.id;
    const conversation = this.getConversation(conversationId);
    const trimmedText = text.trim();
    if (!me || !conversation) {
      return { success: false, error: 'Conversation not found.' };
    }
    if (!trimmedText && !imageDataUrl) {
      return { success: false, error: 'Enter a message or attach an image.' };
    }
    if (this.isConversationBlocked(conversationId)) {
      return { success: false, error: 'Unblock this contact before sending a message.' };
    }

    const recipientId = this.getOtherParticipantId(conversation);
    const message: Message = {
      id: MockDataService.uid(),
      conversationId,
      senderId: me,
      text: trimmedText,
      timestamp: Date.now(),
      status: 'sent',
      deletedBySender: false,
      ...(imageDataUrl ? { imageDataUrl } : {}),
    };
    const previousMessages = this.#messages();
    this.#messages.set([...previousMessages, message]);
    if (!this.#saveMessages()) {
      this.#messages.set(previousMessages);
      return { success: false, error: 'Browser storage is full. Remove an attachment and retry.' };
    }

    const conversationSaved = this.#updateConversation(conversationId, {
      lastMessage: this.#messagePreview(message),
      lastMessageAt: message.timestamp,
      lastMessageSenderId: me,
      unreadCounts: {
        ...conversation.unreadCounts,
        [recipientId]: (conversation.unreadCounts[recipientId] ?? 0) + 1,
      },
      deletedBy: conversation.deletedBy.filter((id) => id !== recipientId),
    });
    if (!conversationSaved) {
      this.#messages.set(previousMessages);
      this.#saveMessages();
      return { success: false, error: 'Could not save the conversation.' };
    }

    this.#scheduleStatusUpdate(message.id, 'delivered', 800);
    return { success: true };
  }

  #scheduleStatusUpdate(messageId: string, status: Message['status'], delay: number): void {
    const timer = setTimeout(() => {
      this.#statusTimers.delete(timer);
      this.#updateMessageStatus(messageId, status);
    }, delay);
    this.#statusTimers.add(timer);
  }

  #updateMessageStatus(messageId: string, status: Message['status']): void {
    this.#messages.update((messages) =>
      messages.map((message) => (message.id === messageId ? { ...message, status } : message)),
    );
    this.#saveMessages();
  }

  deleteMessage(messageId: string): void {
    const me = this.#auth.currentUser()?.id;
    const message = this.#messages().find((candidate) => candidate.id === messageId);
    if (
      !me ||
      !message ||
      message.senderId !== me ||
      !this.getConversation(message.conversationId)
    ) {
      return;
    }
    this.#messages.update((messages) =>
      messages.map((candidate) =>
        candidate.id === messageId ? { ...candidate, deletedBySender: true } : candidate,
      ),
    );
    this.#saveMessages();
    this.#refreshConversationPreview(message.conversationId);
  }

  #refreshConversationPreview(conversationId: string): void {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return;
    }
    const messages = this.getMessages(conversationId);
    const latest = messages[messages.length - 1];
    this.#updateConversation(conversationId, {
      lastMessage: latest ? this.#messagePreview(latest) : '',
      lastMessageAt: latest?.timestamp ?? conversation.lastMessageAt,
      lastMessageSenderId: latest?.senderId ?? conversation.lastMessageSenderId,
    });
  }

  #messagePreview(message: Message): string {
    return message.text || (message.imageDataUrl ? '📷 Image' : '');
  }

  deleteConversation(conversationId: string): void {
    const me = this.#auth.currentUser()?.id;
    const conversation = this.getConversation(conversationId);
    if (!me || !conversation) {
      return;
    }
    this.#updateConversation(conversationId, {
      deletedBy: [...new Set([...conversation.deletedBy, me])],
    });
  }

  markConversationRead(conversationId: string): void {
    const me = this.#auth.currentUser()?.id;
    const conversation = this.getConversation(conversationId);
    if (!me || !conversation) {
      return;
    }
    this.#updateConversation(conversationId, {
      unreadCounts: { ...conversation.unreadCounts, [me]: 0 },
    });
    this.#messages.update((messages) =>
      messages.map((message) =>
        message.conversationId === conversationId &&
        message.senderId !== me &&
        message.status !== 'read'
          ? { ...message, status: 'read' as const }
          : message,
      ),
    );
    this.#saveMessages();
  }

  getOtherParticipantId(conversation: Conversation): string {
    const me = this.#auth.currentUser()?.id;
    return conversation.participantIds.find((id) => id !== me) ?? '';
  }

  getUnreadCount(conversation: Conversation): number {
    const me = this.#auth.currentUser()?.id;
    return me ? (conversation.unreadCounts[me] ?? 0) : 0;
  }

  isConversationBlocked(conversationId: string): boolean {
    const conversation = this.getConversation(conversationId);
    return conversation
      ? this.#contacts.isBlocked(this.getOtherParticipantId(conversation))
      : false;
  }

  setPartnerTyping(conversationId: string, typing: boolean): void {
    if (!this.getConversation(conversationId)) {
      return;
    }
    const existing = this.#typingTimers.get(conversationId);
    if (existing) {
      clearTimeout(existing);
      this.#typingTimers.delete(conversationId);
    }
    this.#partnerTyping.update((status) => ({ ...status, [conversationId]: typing }));
    if (typing) {
      const timer = setTimeout(() => {
        this.#partnerTyping.update((status) => ({ ...status, [conversationId]: false }));
        this.#typingTimers.delete(conversationId);
      }, 3000);
      this.#typingTimers.set(conversationId, timer);
    }
  }

  isPartnerTyping(conversationId: string): boolean {
    return this.#partnerTyping()[conversationId] ?? false;
  }

  addReaction(messageId: string, emoji: string): void {
    const me = this.#auth.currentUser()?.id;
    const message = this.#messages().find((candidate) => candidate.id === messageId);
    if (
      !me ||
      !message ||
      !emoji ||
      (message.deletedBySender && message.senderId === me) ||
      !this.getConversation(message.conversationId) ||
      this.isConversationBlocked(message.conversationId)
    ) {
      return;
    }
    this.#messages.update((messages) =>
      messages.map((candidate) => {
        if (candidate.id !== messageId) {
          return candidate;
        }
        const reactions = { ...(candidate.reactions ?? {}) };
        const users = reactions[emoji] ?? [];
        if (users.includes(me)) {
          const updated = users.filter((id) => id !== me);
          if (updated.length === 0) {
            delete reactions[emoji];
          } else {
            reactions[emoji] = updated;
          }
        } else {
          reactions[emoji] = [...users, me];
        }
        return { ...candidate, reactions };
      }),
    );
    this.#saveMessages();
  }

  totalUnread(): number {
    return this.conversations().reduce(
      (total, conversation) => total + this.getUnreadCount(conversation),
      0,
    );
  }

  deleteUserData(userId: string): void {
    const conversationIds = new Set(
      this.#conversations()
        .filter((conversation) => conversation.participantIds.includes(userId))
        .map((conversation) => conversation.id),
    );
    this.#conversations.update((conversations) =>
      conversations.filter((conversation) => !conversationIds.has(conversation.id)),
    );
    this.#messages.update((messages) =>
      messages.filter((message) => !conversationIds.has(message.conversationId)),
    );
    this.#partnerTyping.update((status) =>
      Object.fromEntries(Object.entries(status).filter(([id]) => !conversationIds.has(id))),
    );
    this.#saveConversations();
    this.#saveMessages();
  }

  #updateConversation(id: string, updates: Partial<Conversation>): boolean {
    const previous = this.#conversations();
    this.#conversations.set(
      previous.map((conversation) =>
        conversation.id === id ? { ...conversation, ...updates } : conversation,
      ),
    );
    if (this.#saveConversations()) {
      return true;
    }
    this.#conversations.set(previous);
    return false;
  }

  ngOnDestroy(): void {
    this.#typingTimers.forEach((timer) => clearTimeout(timer));
    this.#statusTimers.forEach((timer) => clearTimeout(timer));
  }
}
