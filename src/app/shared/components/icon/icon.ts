import { Component, input } from '@angular/core';

export type IconName = 'chat' | 'search' | 'users' | 'user' | 'sign-out';

@Component({
  selector: 'app-icon',
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [class]="size()"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('chat') {
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        }
        @case ('search') {
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z"
          />
        }
        @case ('users') {
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        }
        @case ('user') {
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        }
        @case ('sign-out') {
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        }
      }
    </svg>
  `,
})
export class IconComponent {
  name = input.required<IconName>();
  size = input('h-5 w-5');
  strokeWidth = input(2);
}

