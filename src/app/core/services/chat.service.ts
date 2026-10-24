import { OnDestroy, Service, computed, inject, signal } from '@angular/core';
import { Conversation } from '../models/conversation.model';
import {
  MAX_CHECKLIST_ITEM_LENGTH,
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_TITLE_LENGTH,
  Message,
  MessageChecklist,
} from '../models/message.model';
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
  readonly #latestVisibleMessages = computed(() => {
    const me = this.#auth.currentUser()?.id;
    const latest = new Map<string, Message>();
    for (const message of this.#messages()) {
      if (message.deletedBySender && message.senderId === me) {
        continue;
      }
      const previous = latest.get(message.conversationId);
      if (!previous || message.timestamp >= previous.timestamp) {
        latest.set(message.conversationId, message);
      }
    }
    return latest;
  });

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
      .map((conversation) => this.#withVisiblePreview(conversation))
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

  #updateMessages(update: (messages: Message[]) => Message[]): boolean {
    const messages = update(this.#messages());
    if (!this.#storage.set(MESSAGES_KEY, messages)) {
      return false;
    }
    this.#messages.set(messages);
    return true;
  }

  #commitState(conversations: Conversation[], messages: Message[]): boolean {
    if (!this.#storage.set(MESSAGES_KEY, messages)) {
      return false;
    }
    if (!this.#storage.set(CONVERSATIONS_KEY, conversations)) {
      this.#storage.set(MESSAGES_KEY, this.#messages());
      return false;
    }
    this.#messages.set(messages);
    this.#conversations.set(conversations);
    return true;
  }

  #withVisiblePreview(conversation: Conversation): Conversation {
    const latest = this.#latestVisibleMessages().get(conversation.id);
    return {
      ...conversation,
      lastMessage: latest ? this.#messagePreview(latest) : '',
      lastMessageAt: latest?.timestamp ?? conversation.lastMessageAt,
      lastMessageSenderId: latest?.senderId ?? conversation.lastMessageSenderId,
    };
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

  getReplyTarget(message: Message): Message | undefined {
    const messages = this.getMessages(message.conversationId);
    const visibleMessage = messages.find((candidate) => candidate.id === message.id);
    return visibleMessage?.replyToId
      ? messages.find((candidate) => candidate.id === visibleMessage.replyToId)
      : undefined;
  }

  getConversation(id: string): Conversation | undefined {
    const me = this.#auth.currentUser()?.id;
    if (!me) {
      return undefined;
    }
    const conversation = this.#conversations().find(
      (conversation) =>
        conversation.id === id &&
        conversation.participantIds.includes(me) &&
        !conversation.deletedBy.includes(me),
    );
    return conversation ? this.#withVisiblePreview(conversation) : undefined;
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
    const conversations = [conversation, ...this.#conversations()];
    if (!this.#storage.set(CONVERSATIONS_KEY, conversations)) {
      return null;
    }
    this.#conversations.set(conversations);
    return conversation;
  }

  sendMessage(
    conversationId: string,
    text: string,
    imageDataUrl?: string,
    replyToId?: string,
  ): ChatActionResult {
    const trimmedText = text.trim();
    if (!trimmedText && !imageDataUrl) {
      return { success: false, error: 'Enter a message or attach an image.' };
    }
    return this.#sendContent(conversationId, {
      text: trimmedText,
      ...(imageDataUrl ? { imageDataUrl } : {}),
      ...(replyToId !== undefined ? { replyToId } : {}),
    });
  }

  sendChecklist(conversationId: string, title: string, items: string[]): ChatActionResult {
    const trimmedTitle = title.trim();
    const trimmedItems = items.map((item) => item.trim());
    if (!trimmedTitle || trimmedTitle.length > MAX_CHECKLIST_TITLE_LENGTH) {
      return {
        success: false,
        error: `Enter a checklist title of 1–${MAX_CHECKLIST_TITLE_LENGTH} characters.`,
      };
    }
    if (trimmedItems.length === 0 || trimmedItems.length > MAX_CHECKLIST_ITEMS) {
      return { success: false, error: `Add between 1 and ${MAX_CHECKLIST_ITEMS} items.` };
    }
    if (trimmedItems.some((item) => !item || item.length > MAX_CHECKLIST_ITEM_LENGTH)) {
      return {
        success: false,
        error: `Each item must contain 1–${MAX_CHECKLIST_ITEM_LENGTH} characters.`,
      };
    }
    return this.#sendContent(conversationId, {
      text: '',
      checklist: {
        title: trimmedTitle,
        items: trimmedItems.map((text) => ({
          id: MockDataService.uid(),
          text,
          completed: false,
        })),
      },
    });
  }

  #sendContent(
    conversationId: string,
    content: Pick<Message, 'text' | 'imageDataUrl' | 'replyToId' | 'checklist'>,
  ): ChatActionResult {
    const me = this.#auth.currentUser()?.id;
    const conversation = this.getConversation(conversationId);
    if (!me || !conversation) {
      return { success: false, error: 'Conversation not found.' };
    }
    if (this.isConversationBlocked(conversationId)) {
      return { success: false, error: 'Unblock this contact before sending a message.' };
    }
    if (
      content.replyToId !== undefined &&
      !this.getMessages(conversationId).some((message) => message.id === content.replyToId)
    ) {
      return { success: false, error: 'The message you are replying to is no longer available.' };
    }

    const recipientId = this.getOtherParticipantId(conversation);
    const message: Message = {
      id: MockDataService.uid(),
      conversationId,
      senderId: me,
      ...content,
      timestamp: Date.now(),
      status: 'sent',
      deletedBySender: false,
    };
    const updatedConversation: Conversation = {
      ...conversation,
      lastMessage: this.#messagePreview(message),
      lastMessageAt: message.timestamp,
      lastMessageSenderId: me,
      unreadCounts: {
        ...conversation.unreadCounts,
        [recipientId]: (conversation.unreadCounts[recipientId] ?? 0) + 1,
      },
      deletedBy: conversation.deletedBy.filter((id) => id !== recipientId),
    };
    if (
      !this.#commitState(
        this.#conversations().map((item) =>
          item.id === conversationId ? updatedConversation : item,
        ),
        [...this.#messages(), message],
      )
    ) {
      return { success: false, error: 'Could not save the message. Browser storage may be full.' };
    }

    this.#scheduleStatusUpdate(message.id, 'delivered', 800);
    return { success: true };
  }

  toggleChecklistItem(messageId: string, itemId: string): ChatActionResult {
    return this.#updateChecklist(messageId, (checklist) => {
      if (!checklist.items.some((item) => item.id === itemId)) {
        return { error: 'Checklist item not found.' };
      }
      return {
        checklist: {
          ...checklist,
          items: checklist.items.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item,
          ),
        },
      };
    });
  }

  addChecklistItem(messageId: string, text: string): ChatActionResult {
    const trimmedText = text.trim();
    if (!trimmedText || trimmedText.length > MAX_CHECKLIST_ITEM_LENGTH) {
      return {
        success: false,
        error: `Enter an item of 1–${MAX_CHECKLIST_ITEM_LENGTH} characters.`,
      };
    }
    return this.#updateChecklist(messageId, (checklist) => {
      if (checklist.items.length >= MAX_CHECKLIST_ITEMS) {
        return { error: `A checklist can contain up to ${MAX_CHECKLIST_ITEMS} items.` };
      }
      return {
        checklist: {
          ...checklist,
          items: [
            ...checklist.items,
            { id: MockDataService.uid(), text: trimmedText, completed: false },
          ],
        },
      };
    });
  }

  removeChecklistItem(messageId: string, itemId: string): ChatActionResult {
    return this.#updateChecklist(messageId, (checklist) => {
      if (!checklist.items.some((item) => item.id === itemId)) {
        return { error: 'Checklist item not found.' };
      }
      return {
        checklist: { ...checklist, items: checklist.items.filter((item) => item.id !== itemId) },
      };
    });
  }

  #updateChecklist(
    messageId: string,
    update: (checklist: MessageChecklist) => { checklist: MessageChecklist } | { error: string },
  ): ChatActionResult {
    const message = this.#messages().find((candidate) => candidate.id === messageId);
    if (
      !message?.checklist ||
      !this.getMessages(message.conversationId).some((candidate) => candidate.id === messageId)
    ) {
      return { success: false, error: 'Checklist not found.' };
    }
    if (this.isConversationBlocked(message.conversationId)) {
      return { success: false, error: 'Unblock this contact before editing a checklist.' };
    }
    const result = update(message.checklist);
    if ('error' in result) {
      return { success: false, error: result.error };
    }
    if (
      !this.#updateMessages((messages) =>
        messages.map((candidate) =>
          candidate.id === messageId ? { ...candidate, checklist: result.checklist } : candidate,
        ),
      )
    ) {
      return {
        success: false,
        error: 'Could not save the checklist. Browser storage may be full.',
      };
    }
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
    const rank = { sent: 0, delivered: 1, read: 2 };
    const target = this.#messages().find((message) => message.id === messageId);
    if (!target || rank[target.status] >= rank[status]) {
      return;
    }
    this.#updateMessages((messages) =>
      messages.map((message) => (message.id === messageId ? { ...message, status } : message)),
    );
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
    this.#updateMessages((messages) =>
      messages.map((candidate) =>
        candidate.id === messageId ? { ...candidate, deletedBySender: true } : candidate,
      ),
    );
  }

  #messagePreview(message: Message): string {
    if (message.checklist) {
      return `Checklist: ${message.checklist.title}`;
    }
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
    if (
      (conversation.unreadCounts[me] ?? 0) === 0 &&
      !this.#messages().some(
        (message) =>
          message.conversationId === conversationId &&
          message.senderId !== me &&
          message.status !== 'read',
      )
    ) {
      return;
    }
    this.#commitState(
      this.#conversations().map((item) =>
        item.id === conversationId
          ? { ...item, unreadCounts: { ...item.unreadCounts, [me]: 0 } }
          : item,
      ),
      this.#messages().map((message) =>
        message.conversationId === conversationId &&
        message.senderId !== me &&
        message.status !== 'read'
          ? { ...message, status: 'read' as const }
          : message,
      ),
    );
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
    return (
      !!this.getConversation(conversationId) && (this.#partnerTyping()[conversationId] ?? false)
    );
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
    this.#updateMessages((messages) =>
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
  }

  totalUnread(): number {
    return this.conversations().reduce(
      (total, conversation) => total + this.getUnreadCount(conversation),
      0,
    );
  }

  deleteUserData(userId: string): boolean {
    if (userId !== this.#auth.currentUser()?.id) {
      return false;
    }
    const conversationIds = new Set(
      this.#conversations()
        .filter((conversation) => conversation.participantIds.includes(userId))
        .map((conversation) => conversation.id),
    );
    if (
      !this.#commitState(
        this.#conversations().filter((conversation) => !conversationIds.has(conversation.id)),
        this.#messages().filter((message) => !conversationIds.has(message.conversationId)),
      )
    ) {
      return false;
    }
    this.#partnerTyping.update((status) =>
      Object.fromEntries(Object.entries(status).filter(([id]) => !conversationIds.has(id))),
    );
    for (const id of conversationIds) {
      const timer = this.#typingTimers.get(id);
      if (timer !== undefined) {
        clearTimeout(timer);
        this.#typingTimers.delete(id);
      }
    }
    return true;
  }

  #updateConversation(id: string, updates: Partial<Conversation>): boolean {
    const conversations = this.#conversations().map((conversation) =>
      conversation.id === id ? { ...conversation, ...updates } : conversation,
    );
    if (!this.#storage.set(CONVERSATIONS_KEY, conversations)) {
      return false;
    }
    this.#conversations.set(conversations);
    return true;
  }

  ngOnDestroy(): void {
    this.#typingTimers.forEach((timer) => clearTimeout(timer));
    this.#statusTimers.forEach((timer) => clearTimeout(timer));
  }
}
