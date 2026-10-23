# Stash

Stash is a notes workspace. You write pages, keep them in folders, search them, and share them with a role or a public link.

| Folder | What it is | Default URL |
| --- | --- | --- |
| `client` | React app (Vite, TypeScript, Tailwind) | http://localhost:5173 |
| `server` | REST API (Express, TypeScript, MongoDB, Socket.IO) | http://localhost:5000 |

## Prerequisites

- Node.js 20 or newer
- MongoDB 7 or 8 on `127.0.0.1:27017`

## Run locally

```bash
cd server
cp .env.example .env
# Set JWT_SECRET to a long random string
npm install
npm run dev
```

```bash
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` and `/socket.io` to port 5000, so the browser stays on one origin and the refresh cookie is sent.

## Scripts

Server:

- `npm run dev` starts the API with reload
- `npm run test` runs Vitest against `stash_test`
- `npm run seed` creates `ada@stash.test` / `password123` with a few pages, if that account does not exist
- `npm run typecheck` and `npm run lint`

Client:

- `npm run dev`, `npm run test`, `npm run lint`, `npm run build`

## Product notes

- Access tokens travel in the `Authorization` header. Refresh tokens are httpOnly cookies on `/api/v1/auth`.
- In development, password-reset links are printed in the API log. Set `SMTP_HOST` to send real mail.
- Web Push needs `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Reminders still land in the in-app notification list without them.
- Uploads are stored on local disk under `server/uploads` unless S3 variables are set.
- Pro and Team on the pricing page start a 14-day plan on the account. There is no card checkout.
