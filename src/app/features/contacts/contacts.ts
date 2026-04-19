import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ContactsService } from '../../core/services/contacts.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { PresenceService } from '../../core/services/presence.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { Contact } from '../../core/models/contact.model';

@Component({
  selector: 'app-contacts',
  host: { class: 'flex flex-col flex-1 min-h-0' },
  imports: [FormsModule, AvatarComponent],
  templateUrl: './contacts.html',
})
export class ContactsComponent {
  protected readonly contacts = inject(ContactsService);
  protected readonly auth = inject(AuthService);
  protected readonly chat = inject(ChatService);
  protected readonly presence = inject(PresenceService);
  readonly #router = inject(Router);

  protected searchQuery = signal('');
  protected showAddModal = signal(false);
  protected addUsername = signal('');
  protected addError = signal('');
  protected addSuccess = signal('');

  protected filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) {
      return this.contacts.myContacts();
    }
    return this.contacts.myContacts().filter((c) => c.displayName.toLowerCase().includes(q));
  });

  protected openChat(contact: Contact): void {
    const conv = this.chat.getOrCreateConversation(contact.userId);
    this.#router.navigate(['/conversations', conv.id]);
  }

  protected toggleBlock(contact: Contact): void {
    this.contacts.toggleBlock(contact.id);
  }

  protected removeContact(contact: Contact): void {
    this.contacts.removeContact(contact.id);
  }

  protected openAddModal(): void {
    this.addUsername.set('');
    this.addError.set('');
    this.addSuccess.set('');
    this.showAddModal.set(true);
  }

  protected closeAddModal(): void {
    this.showAddModal.set(false);
  }

  protected submitAdd(): void {
    this.addError.set('');
    this.addSuccess.set('');
    const username = this.addUsername().trim();
    if (!username) {
      this.addError.set('Please enter a username.');
      return;
    }
    const user = this.auth.findUserByUsername(username);
    if (!user) {
      this.addError.set('User not found.');
      return;
    }
    const result = this.contacts.addContact(user);
    if (result.success) {
      this.addSuccess.set(`${user.displayName} added to contacts!`);
      this.addUsername.set('');
    } else {
      this.addError.set(result.error ?? 'Could not add contact.');
    }
  }
}
