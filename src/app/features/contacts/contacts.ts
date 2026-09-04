import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ContactsService } from '../../core/services/contacts.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { PresenceService } from '../../core/services/presence.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { Contact } from '../../core/models/contact.model';

@Component({
  selector: 'app-contacts',
  host: { class: 'flex flex-col flex-1 min-h-0' },
  imports: [AvatarComponent],
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
    return this.contacts.search(this.searchQuery());
  });

  protected updateSearchQuery(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected updateAddUsername(event: Event): void {
    this.addUsername.set((event.target as HTMLInputElement).value);
  }

  protected openChat(contact: Contact): void {
    const conv = this.chat.getOrCreateConversation(contact.userId);
    if (conv) {
      this.#router.navigate(['/conversations', conv.id]);
    }
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
      this.presence.track(user.id);
    } else {
      this.addError.set(result.error ?? 'Could not add contact.');
    }
  }
}
