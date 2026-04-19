export interface User {
  id: string;
  username: string;
  email?: string;
  displayName: string;
  passwordHash: string; // mock — stored as plain text in this demo
  avatarInitials: string;
  avatarColor: string;
  createdAt: number;
  passkeys: PasskeyCredential[];
}

export interface PasskeyCredential {
  id: string;
  name: string;
  createdAt: number;
}

export interface AuthSession {
  userId: string;
  token: string;
  expiresAt: number;
}
