import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { BookmarksService } from '../../../core/services/bookmarks.service';
import { BookmarkButtonComponent } from './bookmark-button';

describe('BookmarkButtonComponent', () => {
  it('toggles the supplied message and keeps the action menu open for feedback', () => {
    const saved = signal(false);
    const save = vi.fn(() => {
      saved.set(true);
      return { success: true };
    });
    const remove = vi.fn(() => {
      saved.set(false);
      return { success: true };
    });
    TestBed.configureTestingModule({
      providers: [{ provide: BookmarksService, useValue: { isSaved: saved, save, remove } }],
    });
    const fixture = TestBed.createComponent(BookmarkButtonComponent);
    fixture.componentRef.setInput('messageId', 'message-one');
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    const event = new MouseEvent('click', { bubbles: true });
    const stop = vi.spyOn(event, 'stopPropagation');
    button.dispatchEvent(event);
    fixture.detectChanges();

    expect(save).toHaveBeenCalledWith('message-one');
    expect(stop).toHaveBeenCalled();
    expect(button.textContent).toContain('Remove bookmark');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    fixture.detectChanges();
    expect(remove).toHaveBeenCalledWith('message-one');
    expect(button.textContent).toContain('Save message');
  });

  it('announces a failed storage write without claiming the message was saved', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BookmarksService,
          useValue: {
            isSaved: () => false,
            save: () => ({ success: false, error: 'Browser storage is full.' }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(BookmarkButtonComponent);
    fixture.componentRef.setInput('messageId', 'message-one');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Browser storage is full.',
    );
    expect(fixture.nativeElement.querySelector('button').getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});
