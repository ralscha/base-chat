import {
  Component,
  inject,
  computed,
  signal,
  OnInit,
  AfterViewChecked,
  DestroyRef,
  viewChild,
  ElementRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { PresenceService } from '../../../core/services/presence.service';
import { ConversationPartnerService } from '../../../core/services/conversation-partner.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar';
import { MessageBubbleComponent } from '../message-bubble/message-bubble';
import { EmojiPickerComponent } from '../../../shared/components/emoji-picker/emoji-picker';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-chat-window',
  host: {
    class: 'flex flex-col flex-1 min-h-0',
    '(document:click)': 'closeEmojiPicker()',
  },
  imports: [AvatarComponent, MessageBubbleComponent, EmojiPickerComponent],
  templateUrl: './chat-window.html',
})
export class ChatWindowComponent implements OnInit, AfterViewChecked {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #destroyRef = inject(DestroyRef);
  protected readonly chat = inject(ChatService);
  protected readonly auth = inject(AuthService);
  protected readonly presence = inject(PresenceService);
  protected readonly conversationPartners = inject(ConversationPartnerService);

  protected readonly messageListRef = viewChild<ElementRef<HTMLElement>>('messageList');

  protected conversationId = signal('');
  protected messageText = signal('');
  protected showDeleteModal = signal(false);
  protected showEmojiPicker = signal(false);
  protected stagedImage = signal<string | null>(null);
  protected composerError = signal('');

  protected conversation = computed(() => this.chat.getConversation(this.conversationId()));

  protected partner = computed(() => {
    const conv = this.conversation();
    if (!conv) {
      return null;
    }
    return this.conversationPartners.fromConversation(conv);
  });

  protected messages = computed(() => this.chat.getMessages(this.conversationId()));
  protected isBlocked = computed(() => this.chat.isConversationBlocked(this.conversationId()));

  #prevMessageCount = 0;

  ngOnInit(): void {
    this.#route.paramMap.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe((params) => {
      const id = params.get('id') ?? '';
      if (id !== this.conversationId()) {
        this.messageText.set('');
        this.stagedImage.set(null);
        this.composerError.set('');
        this.showEmojiPicker.set(false);
      }
      this.conversationId.set(id);
      this.chat.markConversationRead(id);
      this.#prevMessageCount = 0;
    });
  }

  ngAfterViewChecked(): void {
    const msgs = this.messages();
    if (msgs.length !== this.#prevMessageCount) {
      this.#prevMessageCount = msgs.length;
      this.#scrollToBottom();
    }
  }

  #scrollToBottom(): void {
    const el = this.messageListRef()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  protected send(): void {
    const text = this.messageText().trim();
    const image = this.stagedImage();
    if (!text && !image) {
      return;
    }
    const result = this.chat.sendMessage(this.conversationId(), text, image ?? undefined);
    if (!result.success) {
      this.composerError.set(result.error ?? 'Could not send message.');
      return;
    }
    this.messageText.set('');
    this.stagedImage.set(null);
    this.composerError.set('');
    this.showEmojiPicker.set(false);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected updateMessageText(event: Event): void {
    this.messageText.set((event.target as HTMLTextAreaElement).value);
    this.composerError.set('');
  }

  // ── Emoji picker ────────────────────────────────────────────────────────

  protected toggleEmojiPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.showEmojiPicker.update((open) => !open);
  }

  protected closeEmojiPicker(): void {
    this.showEmojiPicker.set(false);
  }

  protected insertEmoji(emoji: string): void {
    this.messageText.update((t) => t + emoji);
    this.showEmojiPicker.set(false);
  }

  // ── Image attachment ────────────────────────────────────────────────────

  protected onFileSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.#stageImageFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  protected onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          this.#stageImageFile(file);
        }
        break;
      }
    }
  }

  #stageImageFile(file: File): void {
    this.composerError.set('');
    if (!file.type.startsWith('image/')) {
      this.composerError.set('Choose a valid image file.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.composerError.set('Images must be 2 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.stagedImage.set(reader.result as string);
    reader.onerror = () => this.composerError.set('Could not read that image.');
    reader.readAsDataURL(file);
  }

  protected clearStagedImage(): void {
    this.stagedImage.set(null);
    this.composerError.set('');
  }

  // ── Conversation actions ────────────────────────────────────────────────

  protected deleteMessage(messageId: string): void {
    this.chat.deleteMessage(messageId);
  }

  protected confirmDeleteConversation(): void {
    this.showDeleteModal.set(true);
  }

  protected doDeleteConversation(): void {
    this.chat.deleteConversation(this.conversationId());
    this.showDeleteModal.set(false);
    this.#router.navigate(['/conversations']);
  }

  protected cancelDelete(): void {
    this.showDeleteModal.set(false);
  }

  protected isMine(senderId: string): boolean {
    return senderId === this.auth.currentUser()?.id;
  }

  protected goBack(): void {
    this.#router.navigate(['/conversations']);
  }
}
