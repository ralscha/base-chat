import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatService } from '../../../core/services/chat.service';
import { ChecklistComposerComponent } from './checklist-composer';

describe('ChecklistComposerComponent', () => {
  let fixture: ComponentFixture<ChecklistComposerComponent>;
  let element: HTMLElement;
  let sendChecklist: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendChecklist = vi.fn().mockReturnValue({ success: true });
    TestBed.configureTestingModule({
      providers: [{ provide: ChatService, useValue: { sendChecklist } }],
    });
    fixture = TestBed.createComponent(ChecklistComposerComponent);
    fixture.componentRef.setInput('conversationId', 'trip');
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  function fill(title: string, items: string): void {
    const titleInput = element.querySelector('input')!;
    titleInput.value = title;
    titleInput.dispatchEvent(new Event('input'));
    const itemsInput = element.querySelector('textarea')!;
    itemsInput.value = items;
    itemsInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submit(): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('focuses the title and sends nonempty lines as checklist items', () => {
    const sent = vi.fn();
    fixture.componentInstance.sent.subscribe(sent);
    expect(document.activeElement).toBe(element.querySelector('input'));
    fill('Weekend trip', ' Book tickets\r\n\n Pack snacks \n');
    submit();
    expect(sendChecklist).toHaveBeenCalledExactlyOnceWith('trip', 'Weekend trip', [
      'Book tickets',
      'Pack snacks',
    ]);
    expect(sent).toHaveBeenCalledOnce();
  });

  it('preserves inputs and shows the service error when sending fails', () => {
    const sent = vi.fn();
    fixture.componentInstance.sent.subscribe(sent);
    sendChecklist.mockReturnValue({ success: false, error: 'Could not save the checklist.' });
    fill('Weekend trip', 'Book tickets');
    submit();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not save the checklist.',
    );
    expect(element.querySelector('input')!.value).toBe('Weekend trip');
    expect(element.querySelector('textarea')!.value).toBe('Book tickets');
    expect(sent).not.toHaveBeenCalled();
  });

  it('disables empty checklists and blocks submissions when the contact is blocked', () => {
    const sendButton = element.querySelector<HTMLButtonElement>('[type="submit"]')!;
    expect(sendButton.disabled).toBe(true);
    fill('Weekend trip', '   ');
    expect(sendButton.disabled).toBe(true);
    fill('Weekend trip', 'Book tickets');
    expect(sendButton.disabled).toBe(false);
    fixture.componentRef.setInput('blocked', true);
    fixture.detectChanges();
    expect(sendButton.disabled).toBe(true);
    submit();
    expect(sendChecklist).not.toHaveBeenCalled();
  });
});
