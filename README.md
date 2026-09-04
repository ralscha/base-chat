# BaseChat

BaseChat is the **frontend foundation** for a real-time chat application. It provides an Angular UI for authentication, contact management, and direct messaging, ready to be paired with a compatible backend.

The repository currently runs in demo mode: users, sessions, contacts, conversations, and messages are stored in browser `localStorage`. Passkey ceremonies, presence, delivery, and password recovery are simulated. No credentials or message data leave the browser.

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
- **Profile**: view and update profile, change password, passkey management, account deletion
- **Real-time contract**: documented event and channel conventions for a future Centrifugo client
- **Theming**: light/dark mode toggle with daisyUI themes

## Getting Started

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

Use `me` / `password123` to explore the seeded demo. Other seeded usernames are listed in `MockDataService`; their short passwords exist only for demo sign-in compatibility.

## Backend Contract

The [backend API contract](docs/backend-api.md) defines the expected HTTP endpoints and Centrifugo channel conventions. The frontend is designed to connect to any backend that implements this contract.

## Project Structure

```
src/app/
|-- core/           # Guards, models, services
|-- features/       # Feature areas: auth, chat, contacts, profile
|-- layouts/        # Auth layout and main layout
`-- shared/         # Reusable components, pipes
```
