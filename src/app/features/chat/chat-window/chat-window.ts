import {
  Component,
  inject,
  computed,
  signal,
  OnInit,
  AfterViewChecked,
  ChangeDetectionStrategy,
  DestroyRef,
  viewChild,
  ElementRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { ContactsService } from '../../../core/services/contacts.service';
import { PresenceService } from '../../../core/services/presence.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar';
import { MessageBubbleComponent } from '../message-bubble/message-bubble';
import { EmojiPickerComponent } from '../../../shared/components/emoji-picker/emoji-picker';

@Component({
  selector: 'app-chat-window',
  host: { class: 'flex flex-col flex-1 min-h-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, AvatarComponent, MessageBubbleComponent, EmojiPickerComponent],
  templateUrl: './chat-window.html',
})
export class ChatWindowComponent implements OnInit, AfterViewChecked {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #destroyRef = inject(DestroyRef);
  protected readonly chat = inject(ChatService);
  protected readonly auth = inject(AuthService);
  protected readonly contacts = inject(ContactsService);
  protected readonly presence = inject(PresenceService);

  protected readonly messageListRef = viewChild<ElementRef<HTMLElement>>('messageList');

  protected conversationId = signal('');
  protected messageText = signal('');
  protected showDeleteModal = signal(false);
  protected showEmojiPicker = signal(false);
  protected stagedImage = signal<string | null>(null);

  protected conversation = computed(() => this.chat.getConversation(this.conversationId()));

  protected partner = computed(() => {
    const conv = this.conversation();
    if (!conv) {
      return null;
    }
    const otherId = this.chat.getOtherParticipantId(conv);
    const contact = this.contacts.getContactByUserId(otherId);
    const user = this.auth.getUserById(otherId);
    return {
      userId: otherId,
      displayName: contact?.displayName ?? user?.displayName ?? 'Unknown',
      initials: contact?.avatarInitials ?? user?.avatarInitials ?? '?',
      color: contact?.avatarColor ?? user?.avatarColor ?? 'bg-primary',
    };
  });

  protected messages = computed(() => this.chat.getMessages(this.conversationId()));

  #prevMessageCount = 0;

  ngOnInit(): void {
    this.#route.paramMap.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe((params) => {
      const id = params.get('id') ?? '';
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
    this.chat.sendMessage(this.conversationId(), text, image ?? undefined);
    this.messageText.set('');
    this.stagedImage.set(null);
    this.showEmojiPicker.set(false);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  // ── Emoji picker ────────────────────────────────────────────────────────

  protected toggleEmojiPicker(): void {
    const next = !this.showEmojiPicker();
    this.showEmojiPicker.set(next);
    if (next) {
      const close = () => {
        this.showEmojiPicker.set(false);
        document.removeEventListener('click', close);
      };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
  }

  protected insertEmoji(emoji: string): void {
    this.messageText.update((t) => t + emoji);
    this.showEmojiPicker.set(false);
  }

  // ── Image attachment ────────────────────────────────────────────────────

  protected onFileSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    this.#readImageFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  protected onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) this.#readImageFile(file);
        break;
      }
    }
  }

  #readImageFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => this.stagedImage.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  protected clearStagedImage(): void {
    this.stagedImage.set(null);
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
