import { Service, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';
import { ContactsService } from './contacts.service';
import { MockDataService } from './mock-data.service';

@Service()
export class AccountDataService {
  readonly #auth = inject(AuthService);
  readonly #chat = inject(ChatService);
  readonly #contacts = inject(ContactsService);

  updateDisplayName(displayName: string): void {
    const normalizedName = displayName.trim();
    if (!normalizedName) {
      return;
    }
    this.#auth.updateProfile({
      displayName: normalizedName,
      avatarInitials: MockDataService.initials(normalizedName),
    });
    const user = this.#auth.currentUser();
    if (user) {
      this.#contacts.syncUser(user);
    }
  }

  deleteCurrentAccount(): void {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) {
      return;
    }
    this.#chat.deleteUserData(userId);
    this.#contacts.deleteUserData(userId);
    this.#auth.deleteAccount();
  }
}
