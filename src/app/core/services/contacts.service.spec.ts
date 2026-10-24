import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Contact } from '../models/contact.model';
import { User } from '../models/user.model';
import { AuthService } from './auth.service';
import { ContactsService } from './contacts.service';
import { MockDataService } from './mock-data.service';
import { StorageService } from './storage.service';

describe('ContactsService', () => {
  let auth: AuthService;
  let storage: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { navigate: vi.fn() } }],
    });
    TestBed.inject(MockDataService).seed();
    auth = TestBed.inject(AuthService);
    storage = TestBed.inject(StorageService);
    auth.signIn('me', 'password123');
  });

  afterEach(() => vi.restoreAllMocks());

  it('cannot modify contacts belonging to another account', () => {
    const contacts = TestBed.inject(ContactsService);
    auth.signIn('alice', 'pass1');
    contacts.addContact(auth.getUserById('user_me')!);
    const contact = contacts.myContacts()[0];
    auth.signIn('me', 'password123');

    contacts.toggleBlock(contact.id);
    contacts.removeContact(contact.id);
    expect(contacts.deleteUserData('user_alice')).toBe(false);

    auth.signIn('alice', 'pass1');
    expect(contacts.myContacts()).toEqual([contact]);
  });

  it('rejects an account deleted after it was found in search', () => {
    const contacts = TestBed.inject(ContactsService);
    const alice = auth.getUserById('user_alice')!;
    contacts.removeContact(contacts.getContactByUserId(alice.id)!.id);
    storage.set(
      'users',
      storage.get<User[]>('users')!.filter((user) => user.id !== alice.id),
    );

    expect(contacts.addContact(alice)).toEqual({ success: false, error: 'Account not found.' });
    expect(contacts.getContactByUserId(alice.id)).toBeUndefined();
  });

  it('uses the latest stored profile when adding a contact', () => {
    const contacts = TestBed.inject(ContactsService);
    const alice = auth.getUserById('user_alice')!;
    contacts.removeContact(contacts.getContactByUserId(alice.id)!.id);
    storage.set(
      'users',
      storage
        .get<User[]>('users')!
        .map((user) => (user.id === alice.id ? { ...user, displayName: 'Updated Alice' } : user)),
    );

    expect(contacts.addContact(alice).success).toBe(true);
    expect(contacts.getContactByUserId(alice.id)?.displayName).toBe('Updated Alice');
  });

  it('retains contacts and block status when persistence fails', () => {
    const contacts = TestBed.inject(ContactsService);
    const before = contacts.myContacts();
    const alice = contacts.getContactByUserId('user_alice')!;
    const saved = storage.get<Contact[]>('contacts');
    vi.spyOn(storage, 'set').mockReturnValue(false);

    expect(contacts.toggleBlock(alice.id).success).toBe(false);
    expect(contacts.removeContact(alice.id).success).toBe(false);
    expect(contacts.deleteUserData('user_me')).toBe(false);
    expect(contacts.myContacts()).toEqual(before);
    expect(storage.get('contacts')).toEqual(saved);
  });

  it('does not add an unsaved contact when persistence fails', () => {
    const contacts = TestBed.inject(ContactsService);
    auth.signIn('alice', 'pass1');
    vi.spyOn(storage, 'set').mockReturnValue(false);

    expect(contacts.addContact(auth.getUserById('user_me')!).success).toBe(false);
    expect(contacts.myContacts()).toEqual([]);
  });
});
