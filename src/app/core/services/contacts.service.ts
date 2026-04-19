import { Injectable, signal, computed, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { Contact } from '../models/contact.model';
import { MockDataService } from './mock-data.service';
import { User } from '../models/user.model';

const CONTACTS_KEY = 'contacts';

@Injectable({ providedIn: 'root' })
export class ContactsService {
  readonly #storage = inject(StorageService);
  readonly #auth = inject(AuthService);
  readonly #contacts = signal<Contact[]>([]);

  readonly myContacts = computed(() => {
    const me = this.#auth.currentUser()?.id;
    return this.#contacts().filter((c) => c.ownerId === me);
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
    const q = query.toLowerCase();
    return this.myContacts().filter((c) => c.displayName.toLowerCase().includes(q));
  }

  addContact(user: User): { success: boolean; error?: string } {
    const me = this.#auth.currentUser()!.id;
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
    this.#contacts.update((list) => list.filter((c) => c.id !== contactId));
    this.#save();
  }

  toggleBlock(contactId: string): void {
    this.#contacts.update((list) =>
      list.map((c) => (c.id === contactId ? { ...c, blocked: !c.blocked } : c)),
    );
    this.#save();
  }

  getContactByUserId(userId: string): Contact | undefined {
    const me = this.#auth.currentUser()?.id;
    return this.#contacts().find((c) => c.ownerId === me && c.userId === userId);
  }
}
