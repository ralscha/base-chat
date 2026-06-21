import { Service, inject } from '@angular/core';
import { Conversation } from '../models/conversation.model';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';
import { ContactsService } from './contacts.service';

export interface ConversationPartner {
  userId: string;
  displayName: string;
  initials: string;
  color: string;
}

@Service()
export class ConversationPartnerService {
  readonly #auth = inject(AuthService);
  readonly #chat = inject(ChatService);
  readonly #contacts = inject(ContactsService);

  fromConversation(conversation: Conversation): ConversationPartner {
    const otherId = this.#chat.getOtherParticipantId(conversation);
    const contact = this.#contacts.getContactByUserId(otherId);
    const user = this.#auth.getUserById(otherId);

    return {
      userId: otherId,
      displayName: contact?.displayName ?? user?.displayName ?? 'Unknown',
      initials: contact?.avatarInitials ?? user?.avatarInitials ?? '?',
      color: contact?.avatarColor ?? user?.avatarColor ?? 'bg-primary',
    };
  }

  fromConversationId(conversationId: string): ConversationPartner | null {
    const conversation = this.#chat.getConversation(conversationId);
    return conversation ? this.fromConversation(conversation) : null;
  }
}

