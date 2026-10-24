import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  NavigationEnd,
  Router,
  provideRouter,
  withDisabledInitialNavigation,
} from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { ContactsService } from '../../core/services/contacts.service';
import { ConversationPartnerService } from '../../core/services/conversation-partner.service';
import { NotificationService } from '../../core/services/notification.service';
import { PresenceService } from '../../core/services/presence.service';
import { MainLayoutComponent } from './main-layout';

describe('MainLayoutComponent navigation', () => {
  let fixture: ComponentFixture<MainLayoutComponent>;
  let router: Router;
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            {
              path: 'conversations',
              children: [
                { path: '', children: [] },
                { path: ':id', children: [] },
              ],
            },
            { path: 'bookmarks', children: [] },
          ],
          withDisabledInitialNavigation(),
        ),
        provideLocationMocks(),
        { provide: AuthService, useValue: { signOut: vi.fn() } },
        {
          provide: ChatService,
          useValue: { conversations: () => [], totalUnread: () => 0 },
        },
        { provide: ContactsService, useValue: { myContacts: () => [] } },
        { provide: PresenceService, useValue: { initialize: vi.fn() } },
        { provide: ConversationPartnerService, useValue: {} },
        {
          provide: NotificationService,
          useValue: { requestPermission: vi.fn().mockResolvedValue(undefined), show: vi.fn() },
        },
      ],
    });
    router = TestBed.inject(Router);
    await router.navigateByUrl('/conversations?q=first');
    fixture = TestBed.createComponent(MainLayoutComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('keeps the mobile conversation list visible with fragments and matrix parameters', async () => {
    await router.navigateByUrl('/conversations;view=all#latest');
    fixture.detectChanges();

    expect(element.querySelector('aside')?.classList.contains('hidden')).toBe(false);
    expect(element.querySelector('main')?.classList.contains('hidden')).toBe(true);
  });

  it('extracts the conversation ID without its matrix parameters or fragment', async () => {
    await router.navigateByUrl('/conversations/chat-one;view=compact#latest');
    fixture.detectChanges();

    expect(fixture.componentInstance['activeChatId']()).toBe('chat-one');
    expect(element.querySelector('aside')?.classList.contains('hidden')).toBe(true);
  });

  it('offers bookmarks in both navigation bars and displays the page on mobile', async () => {
    const links = element.querySelectorAll<HTMLAnchorElement>('a[href="/bookmarks"]');
    expect(links).toHaveLength(2);
    await router.navigateByUrl('/bookmarks');
    fixture.detectChanges();
    expect(element.querySelector('aside')?.classList.contains('hidden')).toBe(true);
    expect(element.querySelector('main')?.classList.contains('hidden')).toBe(false);
    expect(fixture.componentInstance['activeChatId']()).toBeNull();
  });

  it('restores the search query when moving backward and forward through history', async () => {
    const search = element.querySelector<HTMLInputElement>('[aria-label="Search conversations"]')!;
    expect(search.value).toBe('first');
    await router.navigateByUrl('/conversations?q=second');
    fixture.detectChanges();
    expect(search.value).toBe('second');

    const backwardNavigation = firstValueFrom(
      router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    TestBed.inject(Location).back();
    await backwardNavigation;
    fixture.detectChanges();
    expect(search.value).toBe('first');

    const forwardNavigation = firstValueFrom(
      router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    TestBed.inject(Location).forward();
    await forwardNavigation;
    fixture.detectChanges();
    expect(search.value).toBe('second');

    await router.navigateByUrl('/conversations');
    fixture.detectChanges();
    expect(search.value).toBe('');
  });
});
