export interface Contact {
  id: string;
  ownerId: string; // the user who owns this contact entry
  userId: string; // the user being referenced
  displayName: string;
  avatarInitials: string;
  avatarColor: string;
  blocked: boolean;
  addedAt: number;
}
