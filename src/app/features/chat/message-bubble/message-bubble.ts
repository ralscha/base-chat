import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Message } from '../../../core/models/message.model';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

@Component({
  selector: 'app-message-bubble',
  imports: [TimeAgoPipe],
  templateUrl: './message-bubble.html',
})
export class MessageBubbleComponent {
  message = input.required<Message>();
  isMine = input.required<boolean>();
  deleteMessage = output<string>();

  readonly #chat = inject(ChatService);
  readonly #auth = inject(AuthService);

  protected readonly quickEmojis = QUICK_EMOJIS;
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
    const close = () => {
      this.menuOpen.set(false);
      document.removeEventListener('click', close);
    };
    setTimeout(() => document.addEventListener('click', close), 0);
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
