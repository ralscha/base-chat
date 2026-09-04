import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Message } from '../../../core/models/message.model';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { QUICK_REACTION_EMOJIS } from '../../../shared/components/emoji-picker/emoji-picker';

@Component({
  selector: 'app-message-bubble',
  host: { '(document:click)': 'closeMenu()' },
  imports: [TimeAgoPipe],
  templateUrl: './message-bubble.html',
})
export class MessageBubbleComponent {
  message = input.required<Message>();
  isMine = input.required<boolean>();
  deleteMessage = output<string>();

  readonly #chat = inject(ChatService);
  readonly #auth = inject(AuthService);

  protected readonly quickEmojis = QUICK_REACTION_EMOJIS;
  protected menuOpen = signal(false);

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

  protected onRightClick(event: MouseEvent): void {
    event.preventDefault();
    this.menuOpen.set(true);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected react(emoji: string): void {
    this.menuOpen.set(false);
    this.#chat.addReaction(this.message().id, emoji);
  }

  protected onDelete(): void {
    this.menuOpen.set(false);
    this.deleteMessage.emit(this.message().id);
  }
}
