# BaseChat

BaseChat is the **frontend foundation** for a real-time chat application. It provides an Angular UI for authentication, contact management, and direct messaging, ready to be paired with a compatible backend.

The repository currently runs in demo mode: users, sessions, contacts, conversations, messages, checklists, and personal bookmarks are stored in browser `localStorage`. Passkey ceremonies, presence, delivery, and password recovery are simulated. No credentials or message data leave the browser.

## Tech Stack

| Layer           | Technology                                                                   |
| --------------- | ---------------------------------------------------------------------------- |
| Framework       | [Angular](https://angular.dev) 22                                            |
| Styling         | [Tailwind CSS](https://tailwindcss.com) 4 + [daisyUI](https://daisyui.com) 5 |
| Language        | TypeScript 6.0                                                               |
| Package Manager | [pnpm](https://pnpm.io)                                                      |
| Linting         | ESLint + angular-eslint                                                      |
| Formatting      | Prettier                                                                     |

## Features

- **Authentication**: sign in, sign up, forgot/reset password, simulated passkey flows
- **Contacts**: contact list, add, remove, block, unblock
- **Direct Messaging**: conversation list, message history, send/delete messages, unread badges
- **Quoted replies**: reply to a message, preview its context, and jump to the original
- **Shared checklists**: create lists inside conversations, then add, remove, and check off items
- **Personal bookmarks**: save messages, organize them into named collections, search, and open the original
- **Profile**: view and update profile, change password, passkey management, account deletion
- **Real-time contract**: documented event and channel conventions for a future Centrifugo client
- **Theming**: light/dark mode toggle with daisyUI themes

## Getting Started

Use Node.js 22.22.3+, 24.15.0+, or 26+ and the pnpm version pinned in `package.json`.
Commit `pnpm-lock.yaml` when updating dependencies; automated installs should use
`pnpm install --frozen-lockfile`.

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm start

# Build for production
pnpm build

# Lint
pnpm lint

# Run unit tests
pnpm test

# Format
pnpm format
```

The dev server runs at `http://localhost:4200`.

`pnpm-workspace.yaml` records the native build scripts required by the Angular tooling and
pins Vite to a patched release until Angular updates its bundled version. TypeScript stays
on 6.0 because that is the compiler version supported by Angular 22.

Use `me` / `password123` to explore the seeded demo. Other seeded usernames are listed in `MockDataService`; their short passwords exist only for demo sign-in compatibility.

### Try replies, checklists, and bookmarks

- Open a conversation and use a message's **Message actions** menu to reply or save it.
  Replies keep a reference to the original message; an unavailable original is shown without its content.
- Use **Create checklist** in the composer to share a titled list. Either participant can check
  off, add, or remove items. Sign out and sign in as the other seeded participant in the same browser
  to try editing from both sides (for example, `alice` / `pass1`).
- Open **Saved** to search bookmarks, create collections, and move messages between them.
  Bookmarks belong to the signed-in account and are not shared with conversation partners.

These features persist across reloads in the same browser. Cross-device collaboration still requires
a backend; the demo does not synchronize independent browser sessions.

## Backend Contract

The [backend API contract](docs/backend-api.md) defines the expected HTTP endpoints and Centrifugo channel conventions. The frontend is designed to connect to any backend that implements this contract.

## Project Structure

```
src/app/
|-- core/           # Guards, models, services
|-- features/       # Feature areas: auth, chat, bookmarks, contacts, profile
|-- layouts/        # Auth layout and main layout
`-- shared/         # Reusable components, pipes
```
