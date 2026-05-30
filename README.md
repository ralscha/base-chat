# BaseChat

BaseChat is the **frontend foundation** for a real-time chat application. It provides the complete UI layer — authentication, contact management, and direct messaging — ready to be paired with a compatible backend.

## Tech Stack

| Layer         | Technology                                       |
| ------------- | ------------------------------------------------ |
| Framework     | [Angular](https://angular.dev) 21                |
| Styling       | [Tailwind CSS](https://tailwindcss.com) 4 + [daisyUI](https://daisyui.com) 5 |
| Language      | TypeScript 5.9                                   |
| Package Manager | [Bun](https://bun.sh)                           |
| Linting       | ESLint + angular-eslint                          |
| Formatting    | Prettier                                         |

## Features

- **Authentication** — sign in, sign up, forgot/reset password, passkey support
- **Contacts** — contact list, add, remove, block, unblock
- **Direct Messaging** — conversation list, message history, send/delete messages, unread badges
- **Profile** — view & update profile, change password, passkey management, account deletion
- **Real-time** — client ready for server-pushed events via [Centrifugo](https://centrifugal.dev)
- **Theming** — light/dark mode toggle (daisyUI themes)

## Getting Started

```bash
# Install dependencies
bun install

# Start the development server
bun start

# Build for production
bun run build

# Lint
bun run lint

# Format
bun run format
```

The dev server runs at `http://localhost:4200`.

## Backend Contract

The [backend API contract](docs/backend-api.md) defines the expected HTTP endpoints and Centrifugo channel conventions. The frontend is designed to connect to any backend that implements this contract.

## Project Structure

```
src/app/
├── core/           # Guards, models, services
├── features/       # Feature modules: auth, chat, contacts, profile
├── layouts/        # Auth layout & main layout (sidebar + content)
└── shared/         # Reusable components, pipes
```


