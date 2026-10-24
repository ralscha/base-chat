import { Service, computed, inject, signal } from '@angular/core';
import { Bookmark, BookmarkCollection, SavedMessage } from '../models/bookmark.model';
import { Conversation } from '../models/conversation.model';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';
import { StorageService } from './storage.service';

const STORAGE_KEY = 'bookmarks';
export const DEFAULT_COLLECTION = 'Saved messages';

interface BookmarkState {
  bookmarks: Bookmark[];
  collections: BookmarkCollection[];
}

export interface BookmarkResult {
  success: boolean;
  error?: string;
}

@Service()
export class BookmarksService {
  readonly #storage = inject(StorageService);
  readonly #auth = inject(AuthService);
  readonly #chat = inject(ChatService);
  readonly #state = signal<BookmarkState>(this.#load());

  readonly collections = computed(() => {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) {
      return [];
    }
    return [
      DEFAULT_COLLECTION,
      ...this.#state()
        .collections.filter((collection) => collection.userId === userId)
        .map((collection) => collection.name)
        .sort((a, b) => a.localeCompare(b)),
    ];
  });

  readonly bookmarks = computed<SavedMessage[]>(() => {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) {
      return [];
    }
    const messages = new Map(
      this.#chat
        .conversations()
        .flatMap((conversation) =>
          this.#chat.getMessages(conversation.id).map((message) => [message.id, message] as const),
        ),
    );
    return this.#state()
      .bookmarks.filter((bookmark) => bookmark.userId === userId)
      .map((bookmark) => {
        const message = messages.get(bookmark.messageId);
        return {
          ...bookmark,
          message: message?.conversationId === bookmark.conversationId ? message : undefined,
        };
      })
      .sort((a, b) => b.savedAt - a.savedAt);
  });

  isSaved(messageId: string): boolean {
    const userId = this.#auth.currentUser()?.id;
    return this.#state().bookmarks.some(
      (bookmark) => bookmark.userId === userId && bookmark.messageId === messageId,
    );
  }

  save(messageId: string): BookmarkResult {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) {
      return { success: false, error: 'Sign in to save messages.' };
    }
    const message = this.#chat
      .conversations()
      .flatMap((conversation) => this.#chat.getMessages(conversation.id))
      .find((candidate) => candidate.id === messageId);
    if (!message) {
      return { success: false, error: 'This message is no longer available.' };
    }
    if (this.isSaved(messageId)) {
      return { success: true };
    }
    return this.#commit({
      ...this.#state(),
      bookmarks: [
        ...this.#state().bookmarks,
        {
          userId,
          messageId,
          conversationId: message.conversationId,
          collection: DEFAULT_COLLECTION,
          savedAt: Date.now(),
        },
      ],
    });
  }

  remove(messageId: string): BookmarkResult {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) {
      return { success: false, error: 'Sign in to manage saved messages.' };
    }
    return this.#commit({
      ...this.#state(),
      bookmarks: this.#state().bookmarks.filter(
        (bookmark) => bookmark.userId !== userId || bookmark.messageId !== messageId,
      ),
    });
  }

  createCollection(name: string): BookmarkResult {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) {
      return { success: false, error: 'Sign in to create collections.' };
    }
    const normalized = this.#normalizeName(name);
    if (!normalized || normalized.length > 60) {
      return { success: false, error: 'Use a collection name between 1 and 60 characters.' };
    }
    if (this.#findCollection(normalized)) {
      return { success: false, error: 'A collection with this name already exists.' };
    }
    return this.#commit({
      ...this.#state(),
      collections: [...this.#state().collections, { userId, name: normalized }],
    });
  }

  move(messageId: string, collectionName: string): BookmarkResult {
    const userId = this.#auth.currentUser()?.id;
    const collection = this.#findCollection(collectionName);
    if (!userId || !this.isSaved(messageId)) {
      return { success: false, error: 'Saved message not found.' };
    }
    if (!collection) {
      return { success: false, error: 'Collection not found.' };
    }
    return this.#commit({
      ...this.#state(),
      bookmarks: this.#state().bookmarks.map((bookmark) =>
        bookmark.userId === userId && bookmark.messageId === messageId
          ? { ...bookmark, collection }
          : bookmark,
      ),
    });
  }

  deleteUserData(userId: string): boolean {
    if (userId !== this.#auth.currentUser()?.id) {
      return false;
    }
    // Include hidden conversations; the chat cleanup removes these for every participant.
    const conversationIds = new Set(
      (this.#storage.get<Conversation[]>('conversations') ?? [])
        .filter((conversation) => conversation.participantIds.includes(userId))
        .map((conversation) => conversation.id),
    );
    return this.#commit({
      bookmarks: this.#state().bookmarks.filter(
        (bookmark) => bookmark.userId !== userId && !conversationIds.has(bookmark.conversationId),
      ),
      collections: this.#state().collections.filter((collection) => collection.userId !== userId),
    }).success;
  }

  #findCollection(name: string): string | undefined {
    const normalized = this.#normalizeName(name).toLowerCase();
    return this.collections().find((collection) => collection.toLowerCase() === normalized);
  }

  #normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }

  #commit(state: BookmarkState): BookmarkResult {
    if (!this.#storage.set(STORAGE_KEY, state)) {
      return {
        success: false,
        error: 'Could not save bookmarks. Check browser storage and try again.',
      };
    }
    this.#state.set(state);
    return { success: true };
  }

  #load(): BookmarkState {
    const stored = this.#storage.get<BookmarkState>(STORAGE_KEY);
    return {
      bookmarks: Array.isArray(stored?.bookmarks)
        ? stored.bookmarks.filter(
            (bookmark) =>
              bookmark &&
              typeof bookmark.userId === 'string' &&
              typeof bookmark.messageId === 'string' &&
              typeof bookmark.conversationId === 'string' &&
              typeof bookmark.collection === 'string' &&
              Number.isFinite(bookmark.savedAt),
          )
        : [],
      collections: Array.isArray(stored?.collections)
        ? stored.collections.filter(
            (collection) =>
              collection &&
              typeof collection.userId === 'string' &&
              typeof collection.name === 'string' &&
              collection.name.trim().length > 0 &&
              collection.name.toLowerCase() !== DEFAULT_COLLECTION.toLowerCase(),
          )
        : [],
    };
  }
}
