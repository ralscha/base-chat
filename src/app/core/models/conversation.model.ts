export interface Conversation {
  id: string;
  participantIds: [string, string]; // always exactly two participants
  lastMessage: string;
  lastMessageAt: number;
  lastMessageSenderId: string;
  unreadCount: number; // from the perspective of the current user
  deletedBy: string[]; // userIds who "deleted" this conversation
}
