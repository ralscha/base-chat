import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
  PRIMARY_OUTLET,
} from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { ContactsService } from '../../core/services/contacts.service';
import { NotificationService } from '../../core/services/notification.service';
import { PresenceService } from '../../core/services/presence.service';
import { ConversationPartnerService } from '../../core/services/conversation-partner.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { IconComponent } from '../../shared/components/icon/icon';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-main-layout',
  host: {
    '(document:keydown.control.k)': 'onCtrlK($event)',
    '(document:keydown.meta.k)': 'onCtrlK($event)',
  },
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AvatarComponent,
    IconComponent,
    TimeAgoPipe,
  ],
  templateUrl: './main-layout.html',
})
export class MainLayoutComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly chat = inject(ChatService);
  protected readonly contacts = inject(ContactsService);
  protected readonly presence = inject(PresenceService);
  protected readonly conversationPartners = inject(ConversationPartnerService);
  readonly #router = inject(Router);
  readonly #destroyRef = inject(DestroyRef);
  readonly #titleService = inject(Title);
  readonly #notifications = inject(NotificationService);

  protected readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

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
      const name = this.conversationPartners.fromConversation(c).displayName;
      if (name.toLowerCase().includes(q)) {
        return true;
      }
      return this.chat
        .getMessages(c.id)
        .some((message) =>
          [
            message.text,
            message.checklist?.title ?? '',
            ...(message.checklist?.items.map((item) => item.text) ?? []),
          ]
            .join(' ')
            .toLowerCase()
            .includes(q),
        );
    });
  });

  protected readonly totalUnread = computed(() => this.chat.totalUnread());

  readonly #previousUnreadCounts = new Map<string, number>();

  constructor() {
    // Keep page title in sync with unread count (feature: unread badge in title)
    effect(() => {
      const count = this.totalUnread();
      this.#titleService.setTitle(count > 0 ? `(${count}) BaseChat` : 'BaseChat');
    });

    // Browser notifications for new messages in non-active conversations
    effect(() => {
      const convs = this.chat.conversations();
      const activeId = this.activeChatId();
      const currentIds = new Set(convs.map((conversation) => conversation.id));
      for (const conversation of convs) {
        const unreadCount = this.chat.getUnreadCount(conversation);
        const previousCount = this.#previousUnreadCounts.get(conversation.id);
        if (
          previousCount !== undefined &&
          unreadCount > previousCount &&
          conversation.id !== activeId
        ) {
          const name = this.conversationPartners.fromConversation(conversation).displayName;
          this.#notifications.show(name, {
            body: conversation.lastMessage || 'New message',
            tag: conversation.id,
          });
        }
        this.#previousUnreadCounts.set(conversation.id, unreadCount);
      }
      for (const id of this.#previousUnreadCounts.keys()) {
        if (!currentIds.has(id)) {
          this.#previousUnreadCounts.delete(id);
        }
      }
    });
  }

  ngOnInit(): void {
    void this.#notifications.requestPermission();

    const users = new Set(this.contacts.myContacts().map((contact) => contact.userId));
    this.chat.conversations().forEach((conversation) => {
      const partnerId = this.chat.getOtherParticipantId(conversation);
      if (partnerId) {
        users.add(partnerId);
      }
    });
    this.presence.initialize([...users]);

    // Track active route to control mobile sidebar visibility
    this.#updateActiveChat(this.#router.url);
    this.#router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe((e) => this.#updateActiveChat(e.urlAfterRedirects));
  }

  #updateActiveChat(url: string): void {
    const parsedUrl = this.#router.parseUrl(url);
    const segments = parsedUrl.root.children[PRIMARY_OUTLET]?.segments ?? [];
    const isConversations = segments[0]?.path === 'conversations';
    this.activeChatId.set(isConversations && segments.length === 2 ? segments[1].path : null);
    this.showSidebarOnMobile.set(isConversations && segments.length === 1);
    this.searchQuery.set(parsedUrl.queryParamMap.get('q') ?? '');
  }

  protected getConversationPartner(convId: string) {
    return this.conversationPartners.fromConversationId(convId)!;
  }

  protected getUnreadCount(convId: string): number {
    const conversation = this.chat.getConversation(convId);
    return conversation ? this.chat.getUnreadCount(conversation) : 0;
  }

  protected onSearch(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.searchQuery.set(q);
    // Persist query in URL without pushing a new history entry
    void this.#router.navigate([], {
      queryParams: { q: q || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Ctrl+K / ⌘K — focus the conversation search input */
  protected onCtrlK(event: Event): void {
    event.preventDefault();
    this.searchInput()?.nativeElement.focus();
  }

  protected signOut(): void {
    this.auth.signOut();
  }
}
