import { Message } from './message.model';

/** A personal reference; message content always comes from the visible conversation. */
export interface Bookmark {
  userId: string;
  messageId: string;
  conversationId: string;
  collection: string;
  savedAt: number;
}

export interface BookmarkCollection {
  userId: string;
  name: string;
}

export interface SavedMessage extends Bookmark {
  message?: Message;
}
