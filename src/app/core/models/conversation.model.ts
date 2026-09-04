export interface Conversation {
  id: string;
  participantIds: [string, string]; // always exactly two participants
  lastMessage: string;
  lastMessageAt: number;
  lastMessageSenderId: string;
  unreadCounts: Record<string, number>; // keyed by participant user ID
  deletedBy: string[]; // userIds who "deleted" this conversation
}
