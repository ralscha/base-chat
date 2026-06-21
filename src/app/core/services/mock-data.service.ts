import { Service, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { User } from '../models/user.model';
import { Contact } from '../models/contact.model';
import { Conversation } from '../models/conversation.model';
import { Message } from '../models/message.model';

const SEEDED_KEY = 'seeded';

const AVATAR_COLORS = [
  'bg-primary',
  'bg-secondary',
  'bg-accent',
  'bg-info',
  'bg-success',
  'bg-warning',
  'bg-error',
];

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function ts(daysAgo: number, hoursAgo = 0, minsAgo = 0): number {
  return Date.now() - daysAgo * 86_400_000 - hoursAgo * 3_600_000 - minsAgo * 60_000;
}

@Service()
export class MockDataService {
  readonly #storage = inject(StorageService);

  seed(): void {
    if (this.#storage.get<boolean>(SEEDED_KEY)) {
      return;
    }

    // ── Users ──────────────────────────────────────────────────────────────
    const users: User[] = [
      {
        id: 'user_me',
        username: 'me',
        displayName: 'You',
        passwordHash: 'password123',
        avatarInitials: 'YO',
        avatarColor: 'bg-primary',
        createdAt: ts(30),
        passkeys: [],
      },
      {
        id: 'user_alice',
        username: 'alice',
        displayName: 'Alice Nguyen',
        passwordHash: 'pass1',
        avatarInitials: 'AN',
        avatarColor: 'bg-secondary',
        createdAt: ts(60),
        passkeys: [],
      },
      {
        id: 'user_bob',
        username: 'bob',
        displayName: 'Bob Martinez',
        passwordHash: 'pass2',
        avatarInitials: 'BM',
        avatarColor: 'bg-accent',
        createdAt: ts(55),
        passkeys: [],
      },
      {
        id: 'user_carol',
        username: 'carol',
        displayName: 'Carol Kim',
        passwordHash: 'pass3',
        avatarInitials: 'CK',
        avatarColor: 'bg-info',
        createdAt: ts(50),
        passkeys: [],
      },
      {
        id: 'user_david',
        username: 'david',
        displayName: 'David Lee',
        passwordHash: 'pass4',
        avatarInitials: 'DL',
        avatarColor: 'bg-success',
        createdAt: ts(45),
        passkeys: [],
      },
      {
        id: 'user_eve',
        username: 'eve',
        displayName: 'Eve Chen',
        passwordHash: 'pass5',
        avatarInitials: 'EC',
        avatarColor: 'bg-warning',
        createdAt: ts(40),
        passkeys: [],
      },
    ];
    this.#storage.set('users', users);

    // ── Contacts for "me" ──────────────────────────────────────────────────
    const contacts: Contact[] = [
      {
        id: uid(),
        ownerId: 'user_me',
        userId: 'user_alice',
        displayName: 'Alice Nguyen',
        avatarInitials: 'AN',
        avatarColor: 'bg-secondary',
        blocked: false,
        addedAt: ts(20),
      },
      {
        id: uid(),
        ownerId: 'user_me',
        userId: 'user_bob',
        displayName: 'Bob Martinez',
        avatarInitials: 'BM',
        avatarColor: 'bg-accent',
        blocked: false,
        addedAt: ts(18),
      },
      {
        id: uid(),
        ownerId: 'user_me',
        userId: 'user_carol',
        displayName: 'Carol Kim',
        avatarInitials: 'CK',
        avatarColor: 'bg-info',
        blocked: false,
        addedAt: ts(15),
      },
      {
        id: uid(),
        ownerId: 'user_me',
        userId: 'user_david',
        displayName: 'David Lee',
        avatarInitials: 'DL',
        avatarColor: 'bg-success',
        blocked: false,
        addedAt: ts(10),
      },
      {
        id: uid(),
        ownerId: 'user_me',
        userId: 'user_eve',
        displayName: 'Eve Chen',
        avatarInitials: 'EC',
        avatarColor: 'bg-warning',
        blocked: true,
        addedAt: ts(8),
      },
    ];
    this.#storage.set('contacts', contacts);

    // ── Conversations & Messages ───────────────────────────────────────────
    const convAlice: Conversation = {
      id: 'conv_alice',
      participantIds: ['user_me', 'user_alice'],
      lastMessage: 'See you tomorrow!',
      lastMessageAt: ts(0, 1),
      lastMessageSenderId: 'user_alice',
      unreadCount: 2,
      deletedBy: [],
    };
    const convBob: Conversation = {
      id: 'conv_bob',
      participantIds: ['user_me', 'user_bob'],
      lastMessage: 'Sure, sounds good.',
      lastMessageAt: ts(1, 3),
      lastMessageSenderId: 'user_me',
      unreadCount: 0,
      deletedBy: [],
    };
    const convCarol: Conversation = {
      id: 'conv_carol',
      participantIds: ['user_me', 'user_carol'],
      lastMessage: 'Did you see the game last night?',
      lastMessageAt: ts(2),
      lastMessageSenderId: 'user_carol',
      unreadCount: 1,
      deletedBy: [],
    };
    const convDavid: Conversation = {
      id: 'conv_david',
      participantIds: ['user_me', 'user_david'],
      lastMessage: 'Thanks for the help!',
      lastMessageAt: ts(5),
      lastMessageSenderId: 'user_david',
      unreadCount: 0,
      deletedBy: [],
    };
    this.#storage.set('conversations', [convAlice, convBob, convCarol, convDavid]);

    const messages: Message[] = [
      // Alice conversation
      {
        id: uid(),
        conversationId: 'conv_alice',
        senderId: 'user_me',
        text: 'Hey Alice, how are you?',
        timestamp: ts(2, 10),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_alice',
        senderId: 'user_alice',
        text: 'Doing great, thanks! You?',
        timestamp: ts(2, 9, 50),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_alice',
        senderId: 'user_me',
        text: 'Pretty good. Want to grab lunch?',
        timestamp: ts(2, 9, 40),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_alice',
        senderId: 'user_alice',
        text: 'Absolutely! What time works for you?',
        timestamp: ts(2, 9, 30),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_alice',
        senderId: 'user_me',
        text: 'How about noon?',
        timestamp: ts(1, 12),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_alice',
        senderId: 'user_alice',
        text: 'Noon works perfectly!',
        timestamp: ts(1, 11),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_alice',
        senderId: 'user_alice',
        text: 'See you tomorrow!',
        timestamp: ts(0, 1),
        status: 'delivered',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_alice',
        senderId: 'user_alice',
        text: "Don't forget your umbrella 😄",
        timestamp: ts(0, 0, 30),
        status: 'delivered',
        deletedBySender: false,
      },

      // Bob conversation
      {
        id: uid(),
        conversationId: 'conv_bob',
        senderId: 'user_bob',
        text: 'Hey! Are you free Saturday?',
        timestamp: ts(3, 8),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_bob',
        senderId: 'user_me',
        text: "Should be! What's up?",
        timestamp: ts(3, 7),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_bob',
        senderId: 'user_bob',
        text: "We're having a BBQ at my place.",
        timestamp: ts(3, 6),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_bob',
        senderId: 'user_me',
        text: 'That sounds awesome!',
        timestamp: ts(2, 20),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_bob',
        senderId: 'user_bob',
        text: 'Great, come around 3pm.',
        timestamp: ts(1, 18),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_bob',
        senderId: 'user_me',
        text: 'Sure, sounds good.',
        timestamp: ts(1, 3),
        status: 'read',
        deletedBySender: false,
      },

      // Carol conversation
      {
        id: uid(),
        conversationId: 'conv_carol',
        senderId: 'user_me',
        text: 'Hi Carol!',
        timestamp: ts(4, 15),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_carol',
        senderId: 'user_carol',
        text: 'Hey! Long time no see.',
        timestamp: ts(4, 14),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_carol',
        senderId: 'user_me',
        text: "I know, been busy. How's work?",
        timestamp: ts(3, 10),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_carol',
        senderId: 'user_carol',
        text: 'Crazy busy but good!',
        timestamp: ts(3, 9),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_carol',
        senderId: 'user_carol',
        text: 'Did you see the game last night?',
        timestamp: ts(2),
        status: 'delivered',
        deletedBySender: false,
      },

      // David conversation
      {
        id: uid(),
        conversationId: 'conv_david',
        senderId: 'user_me',
        text: 'Hey David, can you help me with something?',
        timestamp: ts(7, 10),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_david',
        senderId: 'user_david',
        text: 'Of course! What do you need?',
        timestamp: ts(7, 9),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_david',
        senderId: 'user_me',
        text: 'I was trying to fix that bug we discussed.',
        timestamp: ts(6, 15),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_david',
        senderId: 'user_david',
        text: 'Ah yeah, try resetting the cache first.',
        timestamp: ts(6, 14),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_david',
        senderId: 'user_me',
        text: "That worked! You're a lifesaver.",
        timestamp: ts(5, 12),
        status: 'read',
        deletedBySender: false,
      },
      {
        id: uid(),
        conversationId: 'conv_david',
        senderId: 'user_david',
        text: 'Thanks for the help!',
        timestamp: ts(5),
        status: 'read',
        deletedBySender: false,
      },
    ];
    this.#storage.set('messages', messages);

    this.#storage.set(SEEDED_KEY, true);
  }

  // ── Utility used by AuthService for avatar generation ────────────────────
  static avatarColor(index: number): string {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  }

  static initials(name: string): string {
    return initials(name);
  }

  static uid(): string {
    return uid();
  }
}

