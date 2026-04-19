import {
  Component,
  inject,
  computed,
  signal,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { ContactsService } from '../../../core/services/contacts.service';
import { PresenceService } from '../../../core/services/presence.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar';
import { MessageBubbleComponent } from '../message-bubble/message-bubble';

@Component({
  selector: 'app-chat-window',
  host: { class: 'flex flex-col flex-1 min-h-0' },
  imports: [FormsModule, AvatarComponent, MessageBubbleComponent],
  templateUrl: './chat-window.html',
})
export class ChatWindowComponent implements OnInit, AfterViewChecked {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  protected readonly chat = inject(ChatService);
  protected readonly auth = inject(AuthService);
  protected readonly contacts = inject(ContactsService);
  protected readonly presence = inject(PresenceService);

  @ViewChild('messageList') private messageListRef!: ElementRef<HTMLElement>;

  protected conversationId = signal('');
  protected messageText = signal('');
  protected showDeleteModal = signal(false);

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
    this.#route.paramMap.subscribe((params) => {
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
    const el = this.messageListRef?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  protected send(): void {
    const text = this.messageText().trim();
    if (!text) {
      return;
    }
    this.chat.sendMessage(this.conversationId(), text);
    this.messageText.set('');
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

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
