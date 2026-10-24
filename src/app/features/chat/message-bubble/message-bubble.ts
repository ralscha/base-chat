import {
  AfterViewChecked,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Message } from '../../../core/models/message.model';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { QUICK_REACTION_EMOJIS } from '../../../shared/components/emoji-picker/emoji-picker';
import { BookmarkButtonComponent } from '../../../shared/components/bookmark-button/bookmark-button';
import { ChecklistCardComponent } from '../checklist-card/checklist-card';
import { messagePreview } from '../message-preview';

@Component({
  selector: 'app-message-bubble',
  host: {
    '(document:click)': 'closeMenu()',
    '(document:keydown.escape)': 'closeMenu()',
  },
  imports: [TimeAgoPipe, BookmarkButtonComponent, ChecklistCardComponent],
  templateUrl: './message-bubble.html',
})
export class MessageBubbleComponent implements AfterViewChecked {
  message = input.required<Message>();
  isMine = input.required<boolean>();
  partnerName = input('Contact');
  deleteMessage = output<string>();
  reply = output<Message>();
  jumpToMessage = output<string>();

  readonly #chat = inject(ChatService);
  readonly #auth = inject(AuthService);
  protected readonly actionMenuRef = viewChild<ElementRef<HTMLElement>>('actionMenu');
  #lastMenuElement: HTMLElement | undefined;

  protected readonly quickEmojis = QUICK_REACTION_EMOJIS;
  protected menuOpen = signal(false);
  protected readonly preview = messagePreview;
  protected readonly replyTarget = computed(() => this.#chat.getReplyTarget(this.message()));
  protected readonly replyAuthor = computed(() =>
    this.replyTarget()?.senderId === this.#auth.currentUser()?.id ? 'You' : this.partnerName(),
  );
  protected readonly blocked = computed(() =>
    this.#chat.isConversationBlocked(this.message().conversationId),
  );

  protected readonly reactionEntries = computed(() => {
    const r = this.message().reactions;
    if (!r) {
      return [];
    }
    const me = this.#auth.currentUser()?.id ?? '';
    return Object.entries(r)
      .filter(([, users]) => users.length > 0)
      .map(([emoji, users]) => ({ emoji, count: users.length, mine: users.includes(me) }));
  });

  ngAfterViewChecked(): void {
    const menu = this.actionMenuRef()?.nativeElement;
    if (menu !== this.#lastMenuElement) {
      this.#lastMenuElement = menu;
      menu?.scrollIntoView({ block: 'nearest' });
    }
  }

  protected onRightClick(event: MouseEvent): void {
    event.preventDefault();
    this.menuOpen.set(true);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  protected react(emoji: string): void {
    this.menuOpen.set(false);
    this.#chat.addReaction(this.message().id, emoji);
  }

  protected onDelete(): void {
    this.menuOpen.set(false);
    this.deleteMessage.emit(this.message().id);
  }

  protected onReply(): void {
    this.menuOpen.set(false);
    this.reply.emit(this.message());
  }
}
