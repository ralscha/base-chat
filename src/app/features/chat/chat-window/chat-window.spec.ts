import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { ChatService } from '../../../core/services/chat.service';
import { BookmarksService } from '../../../core/services/bookmarks.service';
import { ConversationPartnerService } from '../../../core/services/conversation-partner.service';
import { PresenceService } from '../../../core/services/presence.service';
import { Message } from '../../../core/models/message.model';
import { ChatWindowComponent } from './chat-window';

class ControlledFileReader {
  static readonly LOADING = 1;
  static instances: ControlledFileReader[] = [];
  readyState = ControlledFileReader.LOADING;
  result = 'data:image/png;base64,dGVzdA==';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  abort = vi.fn();
  readAsDataURL = vi.fn();

  constructor() {
    ControlledFileReader.instances.push(this);
  }

  finish(): void {
    this.readyState = 2;
    this.onload?.();
  }
}

describe('ChatWindowComponent', () => {
  let fixture: ComponentFixture<ChatWindowComponent>;
  let element: HTMLElement;
  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let routeFragment: BehaviorSubject<string | null>;
  let sendMessage: ReturnType<typeof vi.fn>;
  let markConversationRead: ReturnType<typeof vi.fn>;
  const messages = signal<Message[]>([]);
  const originalScrollIntoView = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollIntoView',
  );

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    ControlledFileReader.instances = [];
    vi.stubGlobal('FileReader', ControlledFileReader);
    routeParams = new BehaviorSubject(convertToParamMap({ id: 'first' }));
    routeFragment = new BehaviorSubject<string | null>(null);
    sendMessage = vi.fn().mockReturnValue({ success: true });
    markConversationRead = vi.fn();
    messages.set([]);
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: routeParams, fragment: routeFragment } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'me' }) } },
        {
          provide: ChatService,
          useValue: {
            getConversation: (id: string) => ({ id }),
            getMessages: messages,
            isConversationBlocked: () => false,
            isPartnerTyping: () => false,
            markConversationRead,
            sendMessage,
            getReplyTarget: (message: Message) =>
              messages().find((candidate) => candidate.id === message.replyToId),
          },
        },
        {
          provide: BookmarksService,
          useValue: { isSaved: () => false, save: vi.fn().mockReturnValue({ success: true }) },
        },
        { provide: PresenceService, useValue: { isOnline: () => false } },
        {
          provide: ConversationPartnerService,
          useValue: {
            fromConversation: () => ({
              userId: 'other',
              displayName: 'Other person',
              initials: 'OP',
              color: 'bg-primary',
            }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ChatWindowComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.unstubAllGlobals();
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  function enterText(text: string): HTMLTextAreaElement {
    const input = element.querySelector('textarea')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return input;
  }

  function selectImage(): ControlledFileReader {
    const input = element.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['image'], 'image.png', { type: 'image/png' })],
    });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    return ControlledFileReader.instances.at(-1)!;
  }

  it('keeps Enter available for IME composition and Shift+Enter newlines', () => {
    const input = enterText('Draft message');
    const composing = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      cancelable: true,
    });
    input.dispatchEvent(composing);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(composing.defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith(
      'first',
      'Draft message',
      undefined,
      undefined,
    );
  });

  it('waits for the selected image before sending a message', () => {
    const input = enterText('With an attachment');
    const reader = selectImage();
    const sendButton = element.querySelector<HTMLButtonElement>('[aria-label="Send message"]')!;
    expect(sendButton.disabled).toBe(true);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(sendMessage).not.toHaveBeenCalled();

    reader.finish();
    fixture.detectChanges();
    expect(sendButton.disabled).toBe(false);
    sendButton.click();
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith(
      'first',
      'With an attachment',
      reader.result,
      undefined,
    );
  });

  it('discards pending attachments and delete confirmation when switching conversations', () => {
    const reader = selectImage();
    const staleLoad = reader.onload!;
    element.querySelector<HTMLButtonElement>('[aria-label="Delete conversation"]')!.click();
    fixture.detectChanges();
    expect(element.querySelector('.modal')).not.toBeNull();

    routeParams.next(convertToParamMap({ id: 'second' }));
    staleLoad();
    fixture.detectChanges();
    expect(reader.abort).toHaveBeenCalledOnce();
    expect(element.querySelector('img[alt="Image to send"]')).toBeNull();
    expect(element.querySelector('.modal')).toBeNull();
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('keeps the most recently selected attachment if reads complete out of order', () => {
    const first = selectImage();
    const staleLoad = first.onload!;
    const second = selectImage();
    second.result = 'data:image/png;base64,bmV3';
    second.finish();
    staleLoad();
    fixture.detectChanges();

    expect(first.abort).toHaveBeenCalledOnce();
    expect(element.querySelector('img[alt="Image to send"]')?.getAttribute('src')).toBe(
      second.result,
    );
  });

  it('aborts an image read when the chat is destroyed', () => {
    const reader = selectImage();
    fixture.destroy();
    expect(reader.abort).toHaveBeenCalledOnce();
  });

  it('marks incoming messages read while the conversation stays open', () => {
    markConversationRead.mockClear();
    messages.set([
      {
        id: 'incoming',
        conversationId: 'first',
        senderId: 'other',
        text: 'Hello',
        timestamp: Date.now(),
        status: 'delivered',
        deletedBySender: false,
      },
    ]);
    fixture.detectChanges();
    expect(markConversationRead).toHaveBeenCalledWith('first');
  });

  function addOriginalMessage(): Message {
    const original: Message = {
      id: 'original',
      conversationId: 'first',
      senderId: 'other',
      text: 'Which train should we book?',
      timestamp: Date.now(),
      status: 'read',
      deletedBySender: false,
    };
    messages.set([original]);
    fixture.detectChanges();
    return original;
  }

  function startReply(): void {
    element.querySelector<HTMLButtonElement>('[aria-label="Message actions"]')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('[aria-label="Reply to message"]')!.click();
    fixture.detectChanges();
  }

  it('sends the selected quote and clears the reply after success', () => {
    addOriginalMessage();
    startReply();
    expect(element.textContent).toContain('Replying to Other person');
    const input = enterText('The morning train');
    expect(document.activeElement).toBe(input);
    element.querySelector<HTMLButtonElement>('[aria-label="Send message"]')!.click();
    fixture.detectChanges();
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith(
      'first',
      'The morning train',
      undefined,
      'original',
    );
    expect(element.querySelector('[aria-label="Cancel reply"]')).toBeNull();
  });

  it('preserves the quote and draft when saving fails, and allows canceling only the quote', () => {
    addOriginalMessage();
    startReply();
    sendMessage.mockReturnValue({ success: false, error: 'Browser storage is full.' });
    const input = enterText('The morning train');
    element.querySelector<HTMLButtonElement>('[aria-label="Send message"]')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Browser storage is full.');
    expect(input.value).toBe('The morning train');
    expect(element.querySelector('[aria-label="Cancel reply"]')).not.toBeNull();
    element.querySelector<HTMLButtonElement>('[aria-label="Cancel reply"]')!.click();
    fixture.detectChanges();
    expect(element.querySelector('[aria-label="Cancel reply"]')).toBeNull();
    expect(input.value).toBe('The morning train');
  });

  it('clears the reply and checklist composer on conversation change', () => {
    addOriginalMessage();
    startReply();
    element.querySelector<HTMLButtonElement>('[aria-label="Create checklist"]')!.click();
    fixture.detectChanges();
    expect(element.querySelector('app-checklist-composer')).not.toBeNull();
    routeParams.next(convertToParamMap({ id: 'second' }));
    fixture.detectChanges();
    expect(element.querySelector('[aria-label="Cancel reply"]')).toBeNull();
    expect(element.querySelector('app-checklist-composer')).toBeNull();
  });

  it('focuses and scrolls to the original when clicking a sent quote', () => {
    const original = addOriginalMessage();
    messages.set([
      original,
      { ...original, id: 'reply', senderId: 'me', text: 'Morning', replyToId: original.id },
    ]);
    fixture.detectChanges();
    const target = element.querySelector<HTMLElement>('#message-original')!;
    target.scrollIntoView = vi.fn();
    element
      .querySelector<HTMLButtonElement>('[aria-label="View original message from Other person"]')!
      .click();
    fixture.detectChanges();
    expect(target.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'center' });
    expect(document.activeElement).toBe(target);
  });

  it('handles bookmark fragments and unavailable original messages', () => {
    const original = addOriginalMessage();
    const target = element.querySelector<HTMLElement>('#message-original')!;
    target.scrollIntoView = vi.fn();
    routeFragment.next('message-original');
    fixture.detectChanges();
    expect(document.activeElement).toBe(target);
    expect(target.scrollIntoView).toHaveBeenCalledOnce();

    messages.set([{ ...original, id: 'reply', text: 'Morning', replyToId: 'missing' }]);
    fixture.detectChanges();
    expect(element.textContent).toContain('Original message unavailable');
    expect(element.querySelector('[aria-label^="View original message"]')).toBeNull();
  });

  it('preserves fragment navigation when the router emits the fragment before new parameters', () => {
    const original = addOriginalMessage();
    messages.set([{ ...original, id: 'destination', conversationId: 'second' }]);
    routeFragment.next('message-destination');
    routeParams.next(convertToParamMap({ id: 'second' }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(element.querySelector('#message-destination'));
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      block: 'center',
    });
  });

  it('brings long-checklist actions into view once and keeps them open after bookmarking', () => {
    const original = addOriginalMessage();
    messages.set([
      {
        ...original,
        text: '',
        checklist: {
          title: 'Long checklist',
          items: Array.from({ length: 50 }, (_, index) => ({
            id: `item-${index}`,
            text: `Task ${index + 1}`,
            completed: false,
          })),
        },
      },
    ]);
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('[aria-label="Message actions"]')!.click();
    fixture.detectChanges();
    const menu = element.querySelector<HTMLElement>('[aria-label="Message options"]')!;
    expect(menu).not.toBeNull();
    expect(menu.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
    expect(vi.mocked(menu.scrollIntoView).mock.contexts[0]).toBe(menu);
    menu.querySelector<HTMLButtonElement>('app-bookmark-button button')!.click();
    fixture.detectChanges();
    expect(element.querySelector('[aria-label="Message options"]')).toBe(menu);
    expect(menu.scrollIntoView).toHaveBeenCalledOnce();
    document.body.click();
    fixture.detectChanges();
    expect(element.querySelector('[aria-label="Message options"]')).toBeNull();
  });
});
