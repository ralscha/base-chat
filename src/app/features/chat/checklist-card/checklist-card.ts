import { Component, computed, inject, input, signal } from '@angular/core';
import {
  MAX_CHECKLIST_ITEM_LENGTH,
  MAX_CHECKLIST_ITEMS,
  Message,
} from '../../../core/models/message.model';
import { ChatService } from '../../../core/services/chat.service';

@Component({
  selector: 'app-checklist-card',
  templateUrl: './checklist-card.html',
})
export class ChecklistCardComponent {
  readonly message = input.required<Message>();
  readonly #chat = inject(ChatService);
  protected readonly itemLimit = MAX_CHECKLIST_ITEMS;
  protected readonly itemLengthLimit = MAX_CHECKLIST_ITEM_LENGTH;
  protected readonly checklist = computed(() => this.message().checklist!);
  protected readonly completedCount = computed(
    () => this.checklist().items.filter((item) => item.completed).length,
  );
  protected readonly blocked = computed(() =>
    this.#chat.isConversationBlocked(this.message().conversationId),
  );
  protected readonly newItem = signal('');
  protected readonly error = signal('');

  protected updateNewItem(event: Event): void {
    this.newItem.set((event.target as HTMLInputElement).value);
    this.error.set('');
  }

  protected toggleItem(itemId: string, event: Event): void {
    const result = this.#chat.toggleChecklistItem(this.message().id, itemId);
    this.error.set(result.success ? '' : (result.error ?? 'Could not update this item.'));
    if (!result.success) {
      (event.target as HTMLInputElement).checked =
        this.checklist().items.find((item) => item.id === itemId)?.completed ?? false;
    }
  }

  protected addItem(event: Event): void {
    event.preventDefault();
    const result = this.#chat.addChecklistItem(this.message().id, this.newItem());
    this.error.set(result.success ? '' : (result.error ?? 'Could not add this item.'));
    if (result.success) {
      this.newItem.set('');
    }
  }

  protected removeItem(itemId: string): void {
    const result = this.#chat.removeChecklistItem(this.message().id, itemId);
    this.error.set(result.success ? '' : (result.error ?? 'Could not remove this item.'));
  }
}
