import { DOCUMENT, Service, signal, effect, inject } from '@angular/core';
import { StorageService } from './storage.service';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'theme';

@Service()
export class ThemeService {
  readonly #storage = inject(StorageService);
  readonly #document = inject(DOCUMENT);
  readonly #theme = signal<Theme>('light');
  readonly theme = this.#theme.asReadonly();

  constructor() {
    const saved = this.#storage.get<unknown>(THEME_KEY) === 'dark' ? 'dark' : 'light';
    this.#theme.set(saved);
    this.#applyTheme(saved);
    effect(() => {
      this.#applyTheme(this.#theme());
      this.#storage.set(THEME_KEY, this.#theme());
    });
  }

  toggle(): void {
    this.#theme.update((t) => (t === 'light' ? 'dark' : 'light'));
  }

  setTheme(theme: Theme): void {
    this.#theme.set(theme);
  }

  #applyTheme(theme: Theme): void {
    this.#document.documentElement.setAttribute('data-theme', theme);
  }
}
