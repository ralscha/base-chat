# BaseChat Backend API Contract

## Scope

This document defines the backend contract required to support the current BaseChat UI.

Covered UI features:

- Password sign in
- Sign up
- Forgot password
- Reset password
- Passkey sign in
- Profile loading and profile update
- Change password
- Passkey registration and removal
- Contact list, add, remove, block, unblock
- Conversation list with unread counters
- Create or reopen direct conversation from a contact
- Message history, send message, delete own message
- Mark conversation as read
- Delete conversation for the current user
- Account deletion
- Realtime updates with Centrifugo

Not covered by the backend in the current UI:

- Theme selection can stay client-local. No backend endpoint is required unless you want theme sync across devices.

## Assumptions

- All timestamps are Unix epoch milliseconds as `number` to match the current frontend models.
- All entity IDs are opaque `string` values.
- The app supports direct messages only. A conversation always has exactly 2 participants.
- The client never publishes to Centrifugo channels. All state changes happen through HTTP endpoints. The server publishes the resulting events.
- Authentication uses a short-lived access token plus a refresh token. If you prefer cookie-only auth, the endpoint shapes can stay the same and only transport changes.

## Common Conventions

### Headers

Authenticated endpoints require:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Success Envelope

```ts
interface ApiResponse<T> {
  data: T;
  meta?: {
    nextCursor?: string | null;
  };
}
```

### Error Envelope

```ts
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
```

Example:

```json
{
  "error": {
    "code": "USERNAME_TAKEN",
    "message": "Username already taken.",
    "fields": {
      "username": "Already in use"
    }
  }
}
```

## Shared Data Types

```ts
type Id = string;
type TimestampMs = number;

type MessageStatus = 'sent' | 'delivered' | 'read';

interface UserSummaryDto {
  id: string;
  username: string;
  displayName: string;
  avatarInitials: string;
  avatarColor: string;
}

interface PasskeyDto {
  id: string;
  name: string;
  createdAt: number;
}

interface MeDto extends UserSummaryDto {
  createdAt: number;
  passkeys: PasskeyDto[];
}

interface ContactDto {
  id: string;
  ownerId: string;
  userId: string;
  displayName: string;
  avatarInitials: string;
  avatarColor: string;
  blocked: boolean;
  addedAt: number;
}

interface ConversationSummaryDto {
  id: string;
  participantIds: [string, string];
  partner: UserSummaryDto;
  lastMessage: string;
  lastMessageAt: number;
  lastMessageSenderId: string;
  unreadCount: number;
  realtimeChannel: string;
}

interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: number;
  status: MessageStatus;
  deletedBySender: boolean;
  imageUrl?: string | null;
  reactions?: Record<string, string[]>;
}

interface SessionDto {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
  user: MeDto;
}

interface PresenceEntryDto {
  userId: string;
  isOnline: boolean;
  lastSeenAt: number | null;
}
```

## Auth Endpoints

### `POST /api/v1/auth/sign-up`

Creates a new user and returns a logged-in session.

Request:

```ts
interface SignUpRequest {
  username: string;
  email: string;
  displayName: string;
  password: string;
}
```

Validation rules:

- `username`: `string`, required, min length 3, pattern `^[a-zA-Z0-9_]+$`
- `email`: `string`, required, valid email format
- `displayName`: `string`, required, min length 2
- `password`: `string`, required, min length 8

Response `201 Created`:

```ts
ApiResponse<SessionDto>;
```

Possible errors:

- `409 USERNAME_TAKEN`
- `400 VALIDATION_ERROR`

### `POST /api/v1/auth/sign-in/password`

Signs in with username and password.

Request:

```ts
interface PasswordSignInRequest {
  username: string;
  password: string;
}
```

Response `200 OK`:

```ts
ApiResponse<SessionDto>;
```

Possible errors:

- `401 INVALID_CREDENTIALS`
- `404 USER_NOT_FOUND`

### `POST /api/v1/auth/refresh`

Issues a new access token and refresh token pair.

Request:

```ts
interface RefreshRequest {
  refreshToken: string;
}
```

Response `200 OK`:

```ts
ApiResponse<SessionDto>;
```

Possible errors:

- `401 INVALID_REFRESH_TOKEN`
- `401 SESSION_EXPIRED`

### `POST /api/v1/auth/sign-out`

Invalidates the current session.

Request:

```ts
interface SignOutRequest {
  refreshToken: string;
}
```

Response `204 No Content`

### `POST /api/v1/auth/password/forgot`

Starts the forgot-password flow.

The current UI only asks for `username`. In production, the backend should resolve the account, create a reset token, and deliver it out-of-band by email or another trusted channel.

Request:

```ts
interface ForgotPasswordRequest {
  username: string;
}
```

Response `202 Accepted`:

```ts
interface ForgotPasswordResponse {
  accepted: boolean;
}

ApiResponse<ForgotPasswordResponse>;
```

Notes:

- Return `202` even when the username does not exist if you do not want account enumeration.
- If you intentionally keep the current demo behavior, you may return `404 USER_NOT_FOUND`.

### `POST /api/v1/auth/password/reset`

Completes the password reset.

The current UI only provides `username` and `password`. A secure implementation should also require a reset token. If you do not want to change the visible form, the token can be passed in a query parameter and copied into this request body by the frontend.

Request:

```ts
interface ResetPasswordRequest {
  username: string;
  password: string;
  resetToken: string;
}
```

Response `200 OK`:

```ts
interface ResetPasswordResponse {
  success: boolean;
}

ApiResponse<ResetPasswordResponse>;
```

Possible errors:

- `400 INVALID_RESET_TOKEN`
- `404 USER_NOT_FOUND`
- `400 VALIDATION_ERROR`

## Passkey Auth Endpoints

These endpoints are needed for the sign-in passkey button and the profile passkey management UI.

### `POST /api/v1/auth/passkeys/authentication/options`

Starts a WebAuthn authentication ceremony.

Request:

```ts
interface PasskeyAuthenticationOptionsRequest {
  username?: string;
}
```

Response `200 OK`:

```ts
interface PublicKeyCredentialRequestOptionsJson {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: Array<'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid'>;
  }>;
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

interface PasskeyAuthenticationOptionsResponse {
  requestId: string;
  publicKey: PublicKeyCredentialRequestOptionsJson;
}

ApiResponse<PasskeyAuthenticationOptionsResponse>;
```

### `POST /api/v1/auth/passkeys/authentication/verify`

Verifies the browser-generated WebAuthn assertion and returns a session.

Request:

```ts
interface PasskeyAuthenticationVerifyRequest {
  requestId: string;
  credential: {
    id: string;
    rawId: string;
    type: 'public-key';
    response: {
      clientDataJSON: string;
      authenticatorData: string;
      signature: string;
      userHandle?: string | null;
    };
    clientExtensionResults?: Record<string, unknown>;
  };
}
```

Response `200 OK`:

```ts
ApiResponse<SessionDto>;
```

Possible errors:

- `401 PASSKEY_AUTH_FAILED`
- `400 INVALID_WEBAUTHN_PAYLOAD`

## Current User Endpoints

### `GET /api/v1/me`

Returns the authenticated user profile.

Response `200 OK`:

```ts
ApiResponse<MeDto>;
```

### `PATCH /api/v1/me`

Updates profile fields used by the UI.

Request:

```ts
interface UpdateMeRequest {
  displayName: string;
}
```

Response `200 OK`:

```ts
ApiResponse<MeDto>;
```

Backend behavior:

- Recompute `avatarInitials` when `displayName` changes, or return the newly derived value.
- Publish `profile.updated` on the user channel for the same user.

### `POST /api/v1/me/password`

Changes the current password.

Request:

```ts
interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
```

Response `200 OK`:

```ts
interface ChangePasswordResponse {
  success: boolean;
}

ApiResponse<ChangePasswordResponse>;
```

Possible errors:

- `400 CURRENT_PASSWORD_INCORRECT`
- `400 VALIDATION_ERROR`

### `DELETE /api/v1/me`

Deletes the current account and all user-owned data needed by the UI.

Expected backend side effects:

- Delete or anonymize the user record.
- Delete that user's contact entries.
- Mark that user's authored messages deleted if you want parity with current UI behavior, or hard delete them if product rules allow it.
- Remove the user from all sessions.
- Publish `account.deleted` on the user channel before the session is invalidated.

Response `204 No Content`

## Passkey Management Endpoints

### `GET /api/v1/me/passkeys`

Returns all passkeys for the current user.

Response `200 OK`:

```ts
ApiResponse<PasskeyDto[]>;
```

### `POST /api/v1/me/passkeys/registration/options`

Starts a WebAuthn registration ceremony.

Request:

```ts
interface PasskeyRegistrationOptionsRequest {
  name: string;
}
```

Response `200 OK`:

```ts
interface PublicKeyCredentialCreationOptionsJson {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number;
  }>;
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct' | 'enterprise';
  authenticatorSelection?: {
    residentKey?: 'discouraged' | 'preferred' | 'required';
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  excludeCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: Array<'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid'>;
  }>;
}

interface PasskeyRegistrationOptionsResponse {
  requestId: string;
  name: string;
  publicKey: PublicKeyCredentialCreationOptionsJson;
}

ApiResponse<PasskeyRegistrationOptionsResponse>;
```

### `POST /api/v1/me/passkeys/registration/verify`

Finishes passkey registration.

Request:

```ts
interface PasskeyRegistrationVerifyRequest {
  requestId: string;
  name: string;
  credential: {
    id: string;
    rawId: string;
    type: 'public-key';
    response: {
      clientDataJSON: string;
      attestationObject: string;
      transports?: Array<'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid'>;
    };
    clientExtensionResults?: Record<string, unknown>;
  };
}
```

Response `201 Created`:

```ts
ApiResponse<PasskeyDto>;
```

Realtime side effect:

- Publish `passkey.created` on the user's personal channel.

### `DELETE /api/v1/me/passkeys/{passkeyId}`

Deletes one registered passkey.

Path params:

- `passkeyId`: `string`

Response `204 No Content`

Realtime side effect:

- Publish `passkey.deleted` on the user's personal channel.

## Contacts Endpoints

### `GET /api/v1/contacts`

Returns all contacts for the signed-in user.

Response `200 OK`:

```ts
ApiResponse<ContactDto[]>;
```

Notes:

- The UI does contact search locally, so a server-side search endpoint is optional, not required.

### `POST /api/v1/contacts`

Adds a contact by username, which matches the current add-contact modal.

Request:

```ts
interface AddContactRequest {
  username: string;
}
```

Response `201 Created`:

```ts
ApiResponse<ContactDto>;
```

Possible errors:

- `404 USER_NOT_FOUND`
- `409 CONTACT_ALREADY_EXISTS`
- `400 CANNOT_ADD_SELF`

Realtime side effect:

- Publish `contact.upsert` on the user's personal channel.

### `PATCH /api/v1/contacts/{contactId}`

Updates mutable contact fields. The current UI only needs block and unblock.

Path params:

- `contactId`: `string`

Request:

```ts
interface UpdateContactRequest {
  blocked: boolean;
}
```

Response `200 OK`:

```ts
ApiResponse<ContactDto>;
```

Realtime side effect:

- Publish `contact.upsert` on the user's personal channel.

### `DELETE /api/v1/contacts/{contactId}`

Removes a contact from the current user's address book.

Path params:

- `contactId`: `string`

Response `204 No Content`

Realtime side effect:

- Publish `contact.deleted` on the user's personal channel.

## Conversations Endpoints

### `GET /api/v1/conversations`

Returns the conversation list for the current user, already filtered for conversations not deleted by that user.

Query params:

- `cursor?: string`
- `limit?: number`

Response `200 OK`:

```ts
ApiResponse<ConversationSummaryDto[]>;
```

Notes:

- The UI currently sorts by `lastMessageAt` descending.
- The UI searches conversation partners locally, so server-side search is optional.

### `POST /api/v1/conversations/direct`

Creates or returns the direct conversation for the current user and another user.

Used when the user taps "Open chat" from contacts.

Request:

```ts
interface GetOrCreateDirectConversationRequest {
  participantUserId: string;
}
```

Response `200 OK` or `201 Created`:

```ts
ApiResponse<ConversationSummaryDto>;
```

Behavior:

- If the conversation already exists, return it.
- If it exists but was deleted by the current user, restore it for that user.
- If it does not exist, create it.

Realtime side effect:

- Publish `conversation.upsert` on the current user's personal channel.
- If a new conversation is created, publish `conversation.upsert` on the other participant's personal channel too.

### `DELETE /api/v1/conversations/{conversationId}`

Deletes the conversation only for the current user. This is a soft delete from the current user's list.

Path params:

- `conversationId`: `string`

Response `204 No Content`

Realtime side effect:

- Publish `conversation.deleted` on the current user's personal channel.

### `POST /api/v1/conversations/{conversationId}/read`

Marks incoming messages as read and clears the unread counter.

Path params:

- `conversationId`: `string`

Request:

```ts
interface MarkConversationReadRequest {
  lastReadMessageId?: string | null;
}
```

Response `200 OK`:

```ts
interface MarkConversationReadResponse {
  conversationId: string;
  unreadCount: number;
  readAt: number;
}

ApiResponse<MarkConversationReadResponse>;
```

Realtime side effects:

- Publish `conversation.upsert` on the current user's personal channel with `unreadCount: 0`.
- Publish `message.status.updated` on the conversation channel for the affected messages.

## Message Endpoints

### `GET /api/v1/conversations/{conversationId}/messages`

Returns messages for one conversation.

Path params:

- `conversationId`: `string`

Query params:

- `cursor?: string`
- `limit?: number`

Response `200 OK`:

```ts
ApiResponse<MessageDto[]>;
```

Rules:

- Messages must be sorted by `timestamp` ascending for direct rendering in the current UI.
- Messages deleted by the sender should not be returned to that sender.

### `POST /api/v1/conversations/{conversationId}/messages`

Creates a new message.

Path params:

- `conversationId`: `string`

Request:

```ts
interface SendMessageRequest {
  text: string;
  imageUrl?: string | null;
}
```

Validation rules:

- `text`: `string`, required unless `imageUrl` is provided, trimmed
- `imageUrl`: `string`, optional URL of a previously uploaded image (see `POST /api/v1/uploads/images`)

Response `201 Created`:

```ts
ApiResponse<MessageDto>;
```

Backend behavior:

- Store the new message with initial `status: 'sent'`.
- Update the conversation summary for both participants.
- Increment `unreadCount` for the receiving participant.

Realtime side effects:

- Publish `message.created` on `conversation:{conversationId}`.
- Publish `conversation.upsert` on both personal user channels.

### `POST /api/v1/uploads/images`

Uploads an image and returns a URL that can be referenced in `SendMessageRequest.imageUrl`.

Request: `multipart/form-data` with a single `file` field containing the image.

Response `201 Created`:

```ts
interface ImageUploadResponse {
  url: string;
}

ApiResponse<ImageUploadResponse>;
```

Possible errors:

- `400 UNSUPPORTED_MEDIA_TYPE` — file is not an image
- `413 FILE_TOO_LARGE`

### `POST /api/v1/messages/{messageId}/reactions`

Toggles an emoji reaction for the current user on a message. If the reaction already exists for this user, it is removed; otherwise it is added.

Path params:

- `messageId`: `string`

Request:

```ts
interface ToggleReactionRequest {
  emoji: string;
}
```

Response `200 OK`:

```ts
ApiResponse<MessageDto>;
```

Realtime side effect:

- Publish `message.reaction.updated` on `conversation:{conversationId}`.

### `DELETE /api/v1/messages/{messageId}`

Deletes a message for its sender only.

This matches the current UI, where only your own messages can be deleted and the delete is not a global delete for all participants.

Path params:

- `messageId`: `string`

Response `204 No Content`

Realtime side effects:

- Publish `message.deleted` on the conversation channel.
- Publish `conversation.upsert` on the sender's personal channel only if the deleted message affected the visible conversation preview.

## Realtime Bootstrap Endpoint

### `POST /api/v1/realtime/centrifugo/token`

Returns everything the frontend needs to connect to Centrifugo.

Request:

```ts
interface CentrifugoTokenRequest {}
```

Response `200 OK`:

```ts
interface CentrifugoSubscriptionDto {
  channel: string;
  token?: string;
}

interface CentrifugoConnectionDto {
  wsUrl: string;
  token: string;
  expiresAt: number;
  subscriptions: CentrifugoSubscriptionDto[];
}

ApiResponse<CentrifugoConnectionDto>;
```

Required baseline subscriptions:

- `user:{currentUserId}`
- `presence:contacts:{currentUserId}`

Conversation channels can be added dynamically by the frontend after it loads the conversation list:

- `conversation:{conversationId}`

## Centrifugo Channel Design

The client only subscribes. It never publishes.

All writes go through HTTP endpoints. After the write commits, the server publishes one or more events into Centrifugo.

### Channel: `user:{userId}`

Private personal channel for the signed-in user.

Use it for:

- Conversation list updates
- Contact list updates
- Current user profile updates
- Passkey list updates
- Account deletion notification

Event payload envelope:

```ts
interface UserChannelEvent<T> {
  type:
    | 'conversation.upsert'
    | 'conversation.deleted'
    | 'contact.upsert'
    | 'contact.deleted'
    | 'profile.updated'
    | 'passkey.created'
    | 'passkey.deleted'
    | 'account.deleted';
  emittedAt: number;
  data: T;
}
```

#### `conversation.upsert`

```ts
interface ConversationUpsertEventData {
  conversation: ConversationSummaryDto;
}
```

Use after:

- new message
- read state change
- conversation creation
- conversation restore

#### `conversation.deleted`

```ts
interface ConversationDeletedEventData {
  conversationId: string;
}
```

#### `contact.upsert`

```ts
interface ContactUpsertEventData {
  contact: ContactDto;
}
```

#### `contact.deleted`

```ts
interface ContactDeletedEventData {
  contactId: string;
}
```

#### `profile.updated`

```ts
interface ProfileUpdatedEventData {
  user: MeDto;
}
```

#### `passkey.created`

```ts
interface PasskeyCreatedEventData {
  passkey: PasskeyDto;
}
```

#### `passkey.deleted`

```ts
interface PasskeyDeletedEventData {
  passkeyId: string;
}
```

#### `account.deleted`

```ts
interface AccountDeletedEventData {
  userId: string;
  reason: 'self_deleted' | 'admin_deleted';
}
```

### Channel: `presence:contacts:{userId}`

Private personal presence channel containing only the users relevant to this signed-in user, usually contacts plus current conversation partners.

Use it for:

- Initial presence snapshot
- Online and offline transitions
- Last-seen updates

Event payload envelope:

```ts
interface PresenceChannelEvent<T> {
  type: 'presence.snapshot' | 'presence.changed';
  emittedAt: number;
  data: T;
}
```

#### `presence.snapshot`

Send this immediately after subscription so the UI can paint the full online/offline state without waiting for a delta.

```ts
interface PresenceSnapshotEventData {
  entries: PresenceEntryDto[];
}
```

#### `presence.changed`

```ts
interface PresenceChangedEventData {
  entries: PresenceEntryDto[];
}
```

`entries` can contain one or many changed users in the same event.

### Channel: `conversation:{conversationId}`

Private channel for one direct conversation. Only the two participants may subscribe.

Use it for:

- New messages
- Message status transitions
- Sender-side message deletion

Event payload envelope:

```ts
interface ConversationChannelEvent<T> {
  type:
    'message.created' | 'message.deleted' | 'message.status.updated' | 'message.reaction.updated';
  emittedAt: number;
  data: T;
}
```

#### `message.created`

```ts
interface MessageCreatedEventData {
  message: MessageDto; // includes imageUrl and reactions if present
}
```

When to publish:

- Immediately after `POST /api/v1/conversations/{conversationId}/messages` succeeds.

#### `message.deleted`

```ts
interface MessageDeletedEventData {
  messageId: string;
  conversationId: string;
  deletedBySender: boolean;
}
```

Notes:

- In the current product behavior, this event is mainly relevant for the sender's own UI state because the delete is sender-only.
- If the other participant should not see any change, you can publish only to the sender's subscription context or filter it on the consumer side.

#### `message.status.updated`

```ts
interface MessageStatusUpdatedEventData {
  messageId: string;
  conversationId: string;
  status: MessageStatus;
  updatedAt: number;
}
```

When to publish:

- `sent -> delivered` when the server accepts the message and the recipient can receive it
- `delivered -> read` when the recipient opens the conversation or the backend marks it read

#### `message.reaction.updated`

```ts
interface MessageReactionUpdatedEventData {
  messageId: string;
  conversationId: string;
  reactions: Record<string, string[]>;
}
```

`reactions` is the full updated reactions map for the message (emoji → array of user IDs).

When to publish:

- After `POST /api/v1/messages/{messageId}/reactions` succeeds.

## Minimum Event Flow Per Feature

### Sending a message

1. Client calls `POST /api/v1/conversations/{conversationId}/messages`.
2. Server persists the message.
3. Server publishes `message.created` on `conversation:{conversationId}`.
4. Server publishes `conversation.upsert` on `user:{senderId}`.
5. Server publishes `conversation.upsert` on `user:{recipientId}` with incremented `unreadCount`.
6. Server later publishes `message.status.updated` with `status: 'delivered'` and then `status: 'read'`.

### Opening a conversation

1. Client calls `GET /api/v1/conversations/{conversationId}/messages`.
2. Client calls `POST /api/v1/conversations/{conversationId}/read`.
3. Server publishes `conversation.upsert` to the current user's personal channel.
4. Server publishes `message.status.updated` events for messages that became `read`.

### Adding a contact

1. Client calls `POST /api/v1/contacts` with `username`.
2. Server creates the contact.
3. Server publishes `contact.upsert` on `user:{currentUserId}`.

### Blocking or unblocking a contact

1. Client calls `PATCH /api/v1/contacts/{contactId}`.
2. Server updates `blocked`.
3. Server publishes `contact.upsert` on `user:{currentUserId}`.

### Deleting a conversation

1. Client calls `DELETE /api/v1/conversations/{conversationId}`.
2. Server marks it deleted for the current user.
3. Server publishes `conversation.deleted` on `user:{currentUserId}`.

### Deleting the account

1. Client calls `DELETE /api/v1/me`.
2. Server deletes or anonymizes the account and revokes sessions.
3. Server publishes `account.deleted` on `user:{currentUserId}`.
4. Client signs out locally.

## Suggested Implementation Order

1. Auth and session endpoints
2. Current user and profile endpoints
3. Contacts endpoints
4. Conversations list and direct-conversation creation
5. Messages list and send/delete endpoints
6. Mark-read endpoint
7. Centrifugo token endpoint and the three channel types
8. Passkey registration and passkey sign-in
