import { Service, inject } from '@angular/core';
import { AuthResult, AuthService } from './auth.service';
import { ChatService } from './chat.service';
import { BookmarksService } from './bookmarks.service';
import { ContactsService } from './contacts.service';
import { MockDataService } from './mock-data.service';

@Service()
export class AccountDataService {
  readonly #auth = inject(AuthService);
  readonly #chat = inject(ChatService);
  readonly #bookmarks = inject(BookmarksService);
  readonly #contacts = inject(ContactsService);

  updateDisplayName(displayName: string): AuthResult {
    const normalizedName = displayName.trim();
    if (!normalizedName) {
      return { success: false, error: 'Display name is required.' };
    }
    const result = this.#auth.updateProfile({
      displayName: normalizedName,
      avatarInitials: MockDataService.initials(normalizedName),
    });
    if (!result.success) {
      return result;
    }
    const user = this.#auth.currentUser();
    if (user && !this.#contacts.syncUser(user)) {
      return {
        success: false,
        error:
          'Your profile was saved, but contacts could not be updated. Check browser storage and try again.',
      };
    }
    return { success: true };
  }

  deleteCurrentAccount(): AuthResult {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) {
      return { success: false, error: 'Not authenticated.' };
    }
    if (
      !this.#bookmarks.deleteUserData(userId) ||
      !this.#chat.deleteUserData(userId) ||
      !this.#contacts.deleteUserData(userId)
    ) {
      return {
        success: false,
        error: 'Could not remove your account data. Check browser storage and try again.',
      };
    }
    return this.#auth.deleteAccount();
  }
}
