import { Component, inject, input, signal } from '@angular/core';
import { BookmarksService } from '../../../core/services/bookmarks.service';

@Component({
  selector: 'app-bookmark-button',
  host: { class: 'block' },
  template: `
    <button
      type="button"
      class="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-base-200 rounded-lg"
      [attr.aria-pressed]="bookmarks.isSaved(messageId())"
      (click)="toggle($event)"
    >
      <svg
        class="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 4h12v17l-6-4-6 4V4Z" />
      </svg>
      {{ bookmarks.isSaved(messageId()) ? 'Remove bookmark' : 'Save message' }}
    </button>
    @if (error()) {
      <p role="alert" class="px-4 py-2 text-xs text-error max-w-64">{{ error() }}</p>
    }
  `,
})
export class BookmarkButtonComponent {
  readonly messageId = input.required<string>();
  protected readonly bookmarks = inject(BookmarksService);
  protected readonly error = signal('');

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    const result = this.bookmarks.isSaved(this.messageId())
      ? this.bookmarks.remove(this.messageId())
      : this.bookmarks.save(this.messageId());
    this.error.set(result.success ? '' : (result.error ?? 'Could not update your bookmark.'));
  }
}
