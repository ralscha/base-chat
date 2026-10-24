import { Message } from '../../core/models/message.model';

export function messagePreview(message: Message): string {
  if (message.checklist) {
    return `Checklist: ${message.checklist.title}`;
  }
  return message.text || (message.imageDataUrl ? 'Image attachment' : 'Message');
}
