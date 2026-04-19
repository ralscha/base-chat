import { Component, input, output, signal } from '@angular/core';
import { Message } from '../../../core/models/message.model';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-message-bubble',
  imports: [TimeAgoPipe],
  templateUrl: './message-bubble.html',
})
export class MessageBubbleComponent {
  message = input.required<Message>();
  isMine = input.required<boolean>();
  deleteMessage = output<string>();

  protected menuOpen = signal(false);

  protected onRightClick(event: MouseEvent): void {
    if (!this.isMine()) {
      return;
    }
    event.preventDefault();
    this.menuOpen.set(true);
    // Auto-close after 3 seconds or on next click
    const close = () => {
      this.menuOpen.set(false);
      document.removeEventListener('click', close);
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  protected onDelete(): void {
    this.menuOpen.set(false);
    this.deleteMessage.emit(this.message().id);
  }
}
