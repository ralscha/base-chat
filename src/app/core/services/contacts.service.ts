import { Service, signal, computed, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { AuthResult, AuthService } from './auth.service';
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
    const contacts = this.#storage.get<Contact[]>(CONTACTS_KEY);
    this.#contacts.set(Array.isArray(contacts) ? contacts : []);
  }

  #save(contacts: Contact[]): boolean {
    if (!this.#storage.set(CONTACTS_KEY, contacts)) {
      return false;
    }
    this.#contacts.set(contacts);
    return true;
  }

  search(query: string): Contact[] {
    const q = query.trim().toLowerCase();
    return this.myContacts().filter(
      (contact) =>
        contact.displayName.toLowerCase().includes(q) ||
        (this.#auth.getUserById(contact.userId)?.username.toLowerCase().includes(q) ?? false),
    );
  }

  addContact(user: User): AuthResult {
    const me = this.#auth.currentUser()?.id;
    if (!me) {
      return { success: false, error: 'Not authenticated.' };
    }
    if (user.id === me) {
      return { success: false, error: 'Cannot add yourself.' };
    }
    const savedUser = this.#auth.getUserById(user.id);
    if (!savedUser) {
      return { success: false, error: 'Account not found.' };
    }
    const alreadyExists = this.#contacts().some((c) => c.ownerId === me && c.userId === user.id);
    if (alreadyExists) {
      return { success: false, error: 'Contact already added.' };
    }
    const contact: Contact = {
      id: MockDataService.uid(),
      ownerId: me,
      userId: user.id,
      displayName: savedUser.displayName,
      avatarInitials: savedUser.avatarInitials,
      avatarColor: savedUser.avatarColor,
      blocked: false,
      addedAt: Date.now(),
    };
    return this.#mutationResult(this.#save([...this.#contacts(), contact]));
  }

  removeContact(contactId: string): AuthResult {
    const me = this.#auth.currentUser()?.id;
    if (!me) {
      return { success: false, error: 'Not authenticated.' };
    }
    return this.#mutationResult(
      this.#save(
        this.#contacts().filter((contact) => contact.id !== contactId || contact.ownerId !== me),
      ),
    );
  }

  toggleBlock(contactId: string): AuthResult {
    const me = this.#auth.currentUser()?.id;
    if (!me) {
      return { success: false, error: 'Not authenticated.' };
    }
    return this.#mutationResult(
      this.#save(
        this.#contacts().map((contact) =>
          contact.id === contactId && contact.ownerId === me
            ? { ...contact, blocked: !contact.blocked }
            : contact,
        ),
      ),
    );
  }

  getContactByUserId(userId: string): Contact | undefined {
    const me = this.#auth.currentUser()?.id;
    return this.#contacts().find((c) => c.ownerId === me && c.userId === userId);
  }

  isBlocked(userId: string): boolean {
    return this.getContactByUserId(userId)?.blocked ?? false;
  }

  syncUser(user: User): boolean {
    return this.#save(
      this.#contacts().map((contact) =>
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
  }

  deleteUserData(userId: string): boolean {
    if (this.#auth.currentUser()?.id !== userId) {
      return false;
    }
    return this.#save(
      this.#contacts().filter((contact) => contact.ownerId !== userId && contact.userId !== userId),
    );
  }

  #mutationResult(success: boolean): AuthResult {
    return success
      ? { success: true }
      : {
          success: false,
          error: 'Could not save your contacts. Check browser storage and try again.',
        };
  }
}
