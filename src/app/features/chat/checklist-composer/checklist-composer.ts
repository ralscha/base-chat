import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  MAX_CHECKLIST_TITLE_LENGTH,
  MAX_CHECKLIST_ITEM_LENGTH,
  MAX_CHECKLIST_ITEMS,
} from '../../../core/models/message.model';
import { ChatService } from '../../../core/services/chat.service';

@Component({
  selector: 'app-checklist-composer',
  templateUrl: './checklist-composer.html',
})
export class ChecklistComposerComponent implements AfterViewInit {
  readonly conversationId = input.required<string>();
  readonly blocked = input(false);
  readonly canceled = output<void>();
  readonly sent = output<void>();
  readonly #chat = inject(ChatService);
  protected readonly titleLimit = MAX_CHECKLIST_TITLE_LENGTH;
  protected readonly itemLengthLimit = MAX_CHECKLIST_ITEM_LENGTH;
  protected readonly itemLimit = MAX_CHECKLIST_ITEMS;
  protected readonly title = signal('');
  protected readonly itemsText = signal('');
  protected readonly error = signal('');
  protected readonly titleInput = viewChild.required<ElementRef<HTMLInputElement>>('titleInput');

  ngAfterViewInit(): void {
    this.titleInput().nativeElement.focus();
  }

  protected updateTitle(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
    this.error.set('');
  }

  protected updateItems(event: Event): void {
    this.itemsText.set((event.target as HTMLTextAreaElement).value);
    this.error.set('');
  }

  protected send(event: Event): void {
    event.preventDefault();
    if (this.blocked()) {
      return;
    }
    const items = this.itemsText()
      .split(/\r?\n/)
      .map((text) => text.trim())
      .filter(Boolean);
    const result = this.#chat.sendChecklist(this.conversationId(), this.title(), items);
    if (!result.success) {
      this.error.set(result.error ?? 'Could not send this checklist.');
      return;
    }
    this.sent.emit();
  }
}
