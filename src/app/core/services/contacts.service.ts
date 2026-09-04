import { Service, signal, computed, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { Contact } from '../models/contact.model';
import { MockDataService } from './mock-data.service';
import { User } from '../models/user.model';

const CONTACTS_KEY = 'contacts';

@Service()
export class ContactsService {
  readonly #storage = inject(StorageService);
  readonly #auth = inject(AuthService);
  readonly #contacts = signal<Contact[]>([]);

  readonly myContacts = computed(() => {
    const me = this.#auth.currentUser()?.id;
    return this.#contacts()
      .filter((c) => c.ownerId === me)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  });

  constructor() {
    this.#load();
  }

  #load(): void {
    this.#contacts.set(this.#storage.get<Contact[]>(CONTACTS_KEY) ?? []);
  }

  #save(): void {
    this.#storage.set(CONTACTS_KEY, this.#contacts());
  }

  search(query: string): Contact[] {
    const q = query.trim().toLowerCase();
    return this.myContacts().filter(
      (contact) =>
        contact.displayName.toLowerCase().includes(q) ||
        (this.#auth.getUserById(contact.userId)?.username.toLowerCase().includes(q) ?? false),
    );
  }

  addContact(user: User): { success: boolean; error?: string } {
    const me = this.#auth.currentUser()?.id;
    if (!me) {
      return { success: false, error: 'Not authenticated.' };
    }
    if (user.id === me) {
      return { success: false, error: 'Cannot add yourself.' };
    }
    const alreadyExists = this.#contacts().some((c) => c.ownerId === me && c.userId === user.id);
    if (alreadyExists) {
      return { success: false, error: 'Contact already added.' };
    }
    const contact: Contact = {
      id: MockDataService.uid(),
      ownerId: me,
      userId: user.id,
      displayName: user.displayName,
      avatarInitials: user.avatarInitials,
      avatarColor: user.avatarColor,
      blocked: false,
      addedAt: Date.now(),
    };
    this.#contacts.update((list) => [...list, contact]);
    this.#save();
    return { success: true };
  }

  removeContact(contactId: string): void {
    const me = this.#auth.currentUser()?.id;
    if (!me) {
      return;
    }
    this.#contacts.update((list) =>
      list.filter((contact) => contact.id !== contactId || contact.ownerId !== me),
    );
    this.#save();
  }

  toggleBlock(contactId: string): void {
    const me = this.#auth.currentUser()?.id;
    if (!me) {
      return;
    }
    this.#contacts.update((list) =>
      list.map((contact) =>
        contact.id === contactId && contact.ownerId === me
          ? { ...contact, blocked: !contact.blocked }
          : contact,
      ),
    );
    this.#save();
  }

  getContactByUserId(userId: string): Contact | undefined {
    const me = this.#auth.currentUser()?.id;
    return this.#contacts().find((c) => c.ownerId === me && c.userId === userId);
  }

  isBlocked(userId: string): boolean {
    return this.getContactByUserId(userId)?.blocked ?? false;
  }

  syncUser(user: User): void {
    this.#contacts.update((list) =>
      list.map((contact) =>
        contact.userId === user.id
          ? {
              ...contact,
              displayName: user.displayName,
              avatarInitials: user.avatarInitials,
              avatarColor: user.avatarColor,
            }
          : contact,
      ),
    );
    this.#save();
  }

  deleteUserData(userId: string): void {
    this.#contacts.update((list) =>
      list.filter((contact) => contact.ownerId !== userId && contact.userId !== userId),
    );
    this.#save();
  }
}
