import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Message } from '../../../core/models/message.model';
import { ChatService } from '../../../core/services/chat.service';
import { ChecklistCardComponent } from './checklist-card';

describe('ChecklistCardComponent', () => {
  let fixture: ComponentFixture<ChecklistCardComponent>;
  let element: HTMLElement;
  let message: Message;
  let toggleChecklistItem: ReturnType<typeof vi.fn>;
  let addChecklistItem: ReturnType<typeof vi.fn>;
  let removeChecklistItem: ReturnType<typeof vi.fn>;
  const blocked = signal(false);

  beforeEach(() => {
    blocked.set(false);
    toggleChecklistItem = vi.fn().mockReturnValue({ success: true });
    addChecklistItem = vi.fn().mockReturnValue({ success: true });
    removeChecklistItem = vi.fn().mockReturnValue({ success: true });
    message = {
      id: 'checklist',
      conversationId: 'trip',
      senderId: 'other',
      text: '',
      timestamp: Date.now(),
      status: 'read',
      deletedBySender: false,
      checklist: {
        title: 'Weekend trip',
        items: [
          { id: 'tickets', text: 'Book tickets', completed: false },
          { id: 'snacks', text: 'Pack snacks', completed: true },
        ],
      },
    };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ChatService,
          useValue: {
            isConversationBlocked: blocked,
            toggleChecklistItem,
            addChecklistItem,
            removeChecklistItem,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ChecklistCardComponent);
    fixture.componentRef.setInput('message', message);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('shows progress and lets a recipient toggle another participant’s checklist', () => {
    expect(element.textContent).toContain('1 of 2 completed');
    element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    expect(toggleChecklistItem).toHaveBeenCalledExactlyOnceWith('checklist', 'tickets');
    fixture.componentRef.setInput('message', {
      ...message,
      checklist: {
        ...message.checklist!,
        items: message.checklist!.items.map((item) => ({ ...item, completed: true })),
      },
    });
    fixture.detectChanges();
    expect(element.textContent).toContain('2 of 2 completed');
  });

  it('restores checkbox state and explains failed writes', () => {
    toggleChecklistItem.mockReturnValue({ success: false, error: 'Browser storage is full.' });
    const checkbox = element.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    checkbox.click();
    fixture.detectChanges();
    expect(checkbox.checked).toBe(false);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Browser storage is full.',
    );
  });

  it('preserves an added item after failure and clears it after success', () => {
    addChecklistItem.mockReturnValueOnce({ success: false, error: 'Could not save this item.' });
    const input = element.querySelector<HTMLInputElement>('[aria-label="New checklist item"]')!;
    input.value = 'Bring a camera';
    input.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(input.value).toBe('Bring a camera');
    expect(element.textContent).toContain('Could not save this item.');
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(addChecklistItem).toHaveBeenLastCalledWith('checklist', 'Bring a camera');
    expect(input.value).toBe('');
  });

  it('removes individual items and supports an empty list', () => {
    element.querySelector<HTMLButtonElement>('[aria-label="Remove item: Book tickets"]')!.click();
    expect(removeChecklistItem).toHaveBeenCalledExactlyOnceWith('checklist', 'tickets');
    fixture.componentRef.setInput('message', {
      ...message,
      checklist: { title: 'Weekend trip', items: [] },
    });
    fixture.detectChanges();
    expect(element.textContent).toContain('No items yet. Add the first one below.');
    expect(element.textContent).toContain('0 of 0 completed');
  });

  it('disables checklist editing for blocked conversations', () => {
    blocked.set(true);
    fixture.detectChanges();
    const controls = Array.from(
      element.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'),
    );
    expect(controls.every((control) => control.disabled)).toBe(true);
    expect(element.textContent).toContain('Unblock this contact to update the checklist.');
  });
});
