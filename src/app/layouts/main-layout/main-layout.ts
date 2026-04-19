import { Component, inject, computed, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { ContactsService } from '../../core/services/contacts.service';
import { PresenceService } from '../../core/services/presence.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { signal } from '@angular/core';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AvatarComponent, TimeAgoPipe],
  templateUrl: './main-layout.html',
})
export class MainLayoutComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly chat = inject(ChatService);
  protected readonly contacts = inject(ContactsService);
  protected readonly presence = inject(PresenceService);
  readonly #router = inject(Router);

  protected searchQuery = signal('');
  protected activeChatId = signal<string | null>(null);
  /** On mobile, show sidebar only when at the /conversations root */
  protected showSidebarOnMobile = signal(true);

  protected readonly filteredConversations = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) {
      return this.chat.conversations();
    }
    return this.chat.conversations().filter((c) => {
      const otherId = this.chat.getOtherParticipantId(c);
      const contact = this.contacts.getContactByUserId(otherId);
      const user = this.auth.getUserById(otherId);
      const name = contact?.displayName ?? user?.displayName ?? '';
      return name.toLowerCase().includes(q);
    });
  });

  ngOnInit(): void {
    // Initialize presence for all known users
    const users = ['user_alice', 'user_bob', 'user_carol', 'user_david', 'user_eve'];
    this.presence.initialize(users);

    // Track active route to control mobile sidebar visibility
    this.#updateActiveChat(this.#router.url);
    this.#router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => this.#updateActiveChat(e.urlAfterRedirects));
  }

  #updateActiveChat(url: string): void {
    const match = url.match(/\/conversations\/([^/?]+)/);
    this.activeChatId.set(match ? match[1] : null);
    // On mobile, sidebar is only visible at bare /conversations route
    const isSidebarRoute = /^\/conversations(\?.*)?$/.test(url);
    this.showSidebarOnMobile.set(isSidebarRoute);
  }

  protected getConversationPartner(convId: string) {
    const conv = this.chat.getConversation(convId)!;
    const otherId = this.chat.getOtherParticipantId(conv);
    const contact = this.contacts.getContactByUserId(otherId);
    const user = this.auth.getUserById(otherId);
    return {
      displayName: contact?.displayName ?? user?.displayName ?? 'Unknown',
      initials: contact?.avatarInitials ?? user?.avatarInitials ?? '?',
      color: contact?.avatarColor ?? user?.avatarColor ?? 'bg-primary',
      userId: otherId,
    };
  }

  protected onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected signOut(): void {
    this.auth.signOut();
  }

  protected totalUnread = computed(() => this.chat.totalUnread());
}
