import { Component, output } from '@angular/core';

export const QUICK_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

const COMMON_EMOJIS = [
  '😀',
  '😂',
  '😍',
  '🥰',
  '😎',
  '🤔',
  '😢',
  '😮',
  '😡',
  '🥳',
  '👍',
  '👎',
  '❤️',
  '🔥',
  '🎉',
  '🙏',
  '💯',
  '✅',
  '⭐',
  '💪',
  '👋',
  '🤣',
  '😅',
  '🙌',
  '😭',
  '🤯',
  '😱',
  '🤗',
  '🫶',
  '👀',
];

@Component({
  selector: 'app-emoji-picker',
  template: `
    <div
      class="grid grid-cols-6 gap-0.5 p-2 bg-base-100 border border-base-300 rounded-xl shadow-lg w-52"
    >
      @for (emoji of emojis; track emoji) {
        <button
          type="button"
          class="text-xl p-1.5 hover:bg-base-200 rounded transition-colors leading-none aspect-square"
          (click)="pick.emit(emoji)"
        >
          {{ emoji }}
        </button>
      }
    </div>
  `,
})
export class EmojiPickerComponent {
  pick = output<string>();
  protected readonly emojis = COMMON_EMOJIS;
}

