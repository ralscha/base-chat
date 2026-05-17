import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-chat-empty',
  host: { class: 'flex flex-col flex-1 min-h-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-empty.html',
})
export class ChatEmptyComponent {}
