export type MessageStatus = 'sent' | 'delivered' | 'read';

export const MAX_CHECKLIST_TITLE_LENGTH = 100;
export const MAX_CHECKLIST_ITEM_LENGTH = 200;
export const MAX_CHECKLIST_ITEMS = 50;

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface MessageChecklist {
  title: string;
  items: ChecklistItem[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: number;
  status: MessageStatus;
  deletedBySender: boolean;
  imageDataUrl?: string;
  replyToId?: string;
  checklist?: MessageChecklist;
  reactions?: Record<string, string[]>;
}
