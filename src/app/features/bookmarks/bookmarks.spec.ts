import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { BookmarksService } from '../../core/services/bookmarks.service';
import { ChatService } from '../../core/services/chat.service';
import { MockDataService } from '../../core/services/mock-data.service';
import { StorageService } from '../../core/services/storage.service';
import { BookmarksComponent } from './bookmarks';

describe('BookmarksComponent', () => {
  let fixture: ComponentFixture<BookmarksComponent>;
  let element: HTMLElement;
  let chat: ChatService;
  let bookmarks: BookmarksService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(MockDataService).seed();
    TestBed.inject(AuthService).signIn('me', 'password123');
    chat = TestBed.inject(ChatService);
    bookmarks = TestBed.inject(BookmarksService);
    fixture = TestBed.createComponent(BookmarksComponent);
    element = fixture.nativeElement;
  });

  afterEach(() => vi.restoreAllMocks());

  it('creates a collection, moves and filters a bookmark, and links to the original', () => {
    const original = chat.getMessages('conv_alice')[0];
    bookmarks.save(original.id);
    fixture.detectChanges();
    const name = element.querySelector<HTMLInputElement>('input[type="text"]')!;
    name.value = 'Travel';
    name.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    const destination = element.querySelector<HTMLSelectElement>('article select')!;
    destination.value = 'Travel';
    destination.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(bookmarks.bookmarks()[0].collection).toBe('Travel');
    const filter = element.querySelector<HTMLSelectElement>('select')!;
    filter.value = 'Saved messages';
    filter.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(element.querySelector('article')).toBeNull();
    filter.value = 'Travel';
    filter.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(element.querySelector('article a')?.getAttribute('href')).toBe(
      '/conversations/conv_alice#message-' + original.id,
    );
  });

  it('searches checklist items and shows live checklist progress', () => {
    expect(chat.sendChecklist('conv_alice', 'Packing list', ['Passport', 'Tickets']).success).toBe(
      true,
    );
    const checklist = chat.getMessages('conv_alice').at(-1)!;
    bookmarks.save(checklist.id);
    fixture.detectChanges();
    const search = element.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'passport';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.querySelector('article')?.textContent).toContain('Packing list');
    expect(element.querySelector('article')?.textContent).toContain('0 of 2 complete');
    chat.toggleChecklistItem(checklist.id, checklist.checklist!.items[0].id);
    fixture.detectChanges();
    expect(element.querySelector('article')?.textContent).toContain('1 of 2 complete');
    search.value = 'not in this checklist';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.querySelector('article')).toBeNull();
  });

  it('selects the persisted collection when its options render after a fresh load', () => {
    const original = chat.getMessages('conv_alice')[0];
    bookmarks.save(original.id);
    bookmarks.createCollection('Travel');
    bookmarks.move(original.id, 'Travel');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(BookmarksComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();

    expect(element.querySelector<HTMLSelectElement>('article select')?.value).toBe('Travel');
    const filter = element.querySelector<HTMLSelectElement>('select')!;
    expect(filter.value).toBe('');
    filter.value = 'Travel';
    filter.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(element.querySelector<HTMLSelectElement>('article select')?.value).toBe('Travel');

    // Adding an option while filtering must retain both existing selections.
    TestBed.inject(BookmarksService).createCollection('Ideas');
    fixture.detectChanges();
    expect(filter.value).toBe('Travel');
    expect(element.querySelector<HTMLSelectElement>('article select')?.value).toBe('Travel');
  });

  it('removes original content and links when the sender deletes a saved message', () => {
    const original = chat
      .getMessages('conv_alice')
      .find((message) => message.senderId === 'user_me')!;
    bookmarks.save(original.id);
    fixture.detectChanges();
    expect(element.textContent).toContain(original.text);
    chat.deleteMessage(original.id);
    fixture.detectChanges();

    expect(element.textContent).not.toContain(original.text);
    expect(element.textContent).toContain('Original message unavailable');
    expect(element.querySelector('article a')).toBeNull();
    element.querySelector<HTMLButtonElement>('article button')!.click();
    fixture.detectChanges();
    expect(element.querySelector('article')).toBeNull();
    expect(element.textContent).toContain('Keep useful messages close');
  });

  it('restores the selected collection and announces storage errors on a failed move', () => {
    bookmarks.save(chat.getMessages('conv_alice')[0].id);
    bookmarks.createCollection('Ideas');
    fixture.detectChanges();
    vi.spyOn(TestBed.inject(StorageService), 'set').mockReturnValue(false);
    const destination = element.querySelector<HTMLSelectElement>('article select')!;
    destination.value = 'Ideas';
    destination.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(destination.value).toBe('Saved messages');
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not save bookmarks',
    );
    expect(bookmarks.bookmarks()[0].collection).toBe('Saved messages');
  });
});
