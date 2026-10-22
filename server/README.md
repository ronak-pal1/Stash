# Stash API

Backend for Stash, a personal notes platform. It handles accounts, notes, and private file attachments.

The React app in `client` is a separate package. This server does not serve the frontend.

## Stack

- Node.js 20+ and TypeScript
- Express
- MongoDB with Mongoose
- JWT access tokens
- Zod request validation
- AWS S3 for note attachments

## Project layout

```
src/
  index.ts                 process entry, database connection, shutdown
  app.ts                   Express app, CORS, security headers, body parsing
  config/                  environment variables, Mongo connection, upload limits
  models/                  User and Note schemas
  validators/              Zod schemas for request body, query, and params
  services/                auth, notes, and S3 storage
  controllers/             HTTP handlers
  routes/                  route tables mounted at /api
  middlewares/             auth, validation, uploads, rate limit, errors
  libs/                    JWT, S3 client, shared HTTP helpers
```

Requests move in this order: route, auth or rate limit, validation, controller, service, model or S3.

## Prerequisites

- Node.js 20 or newer
- A running MongoDB instance
- An S3 bucket, only if you want attachment uploads

Start Mongo locally with Docker:

```bash
docker run -d --name stash-mongo -p 27017:27017 mongo:7
```

## Setup

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

The API listens on `http://localhost:5000` unless `PORT` is changed. The Vite client defaults to `http://localhost:5173`, which is already set as `CLIENT_URL`.

Generate a real JWT secret before sharing the environment file:

```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the API with reload on file changes |
| `npm run typecheck` | Typecheck without emitting files |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |

## Environment

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | no | `development`, `test`, or `production`. Defaults to `development`. |
| `PORT` | no | HTTP port. Defaults to `5000`. |
| `CLIENT_URL` | no | Browser origin allowed by CORS. Defaults to `http://localhost:5173`. |
| `MONGODB_URI` | yes | Mongo connection string, for example `mongodb://127.0.0.1:27017/stash`. |
| `JWT_SECRET` | yes | Signing secret. At least 16 characters. |
| `JWT_EXPIRES_IN` | no | Access token lifetime. Defaults to `7d`. |
| `AWS_REGION` | for uploads | S3 region. |
| `AWS_ACCESS_KEY_ID` | for uploads | IAM access key. |
| `AWS_SECRET_ACCESS_KEY` | for uploads | IAM secret. |
| `AWS_S3_BUCKET` | for uploads | Private bucket name. |

The process exits on startup if Mongo or JWT settings are missing or invalid. Notes still work when the AWS variables are empty. Attachment routes then respond with `503` and name the missing variables.

In production the server trusts one reverse proxy, so the auth rate limit uses the client IP from that proxy.

## Authentication

Register and login return a signed JWT. Send it on later requests:

```
Authorization: Bearer <token>
```

Passwords are hashed with bcrypt and are never included in responses. Login uses the same error for an unknown email and a wrong password.

`/api/auth/register` and `/api/auth/login` allow 20 attempts per 15 minutes per IP.

## Response shape

Success:

```json
{
  "success": true,
  "message": "Note created",
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "message": "Validation failed",
  "details": [
    { "path": "email", "message": "Enter a valid email" }
  ]
}
```

`details` is only present for validation errors. `path` is the field name inside the body, query, or route params.

## API

Base path: `/api`

### Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | no | Process uptime and Mongo connection state |

### Auth

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | no | Create an account and return a token |
| `POST` | `/auth/login` | no | Return a token for an existing account |
| `GET` | `/auth/me` | yes | Return the current user |

Register body:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "password123"
}
```

Password length is 8 to 72 characters. Login uses `email` and `password`.

### Notes

Every note route requires a bearer token. Notes are private to the signed-in user. Another user's note id returns `404`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/notes` | List notes |
| `POST` | `/notes` | Create a note |
| `GET` | `/notes/:noteId` | Fetch one note |
| `PATCH` | `/notes/:noteId` | Update a note |
| `DELETE` | `/notes/:noteId` | Delete a note and its stored files |
| `POST` | `/notes/:noteId/attachments` | Upload one file as `multipart/form-data` field `file` |
| `DELETE` | `/notes/:noteId/attachments/:attachmentId` | Delete one attachment |
| `GET` | `/notes/:noteId/attachments/:attachmentId/url` | Return a temporary download URL |

Create body:

```json
{
  "title": "Meeting notes",
  "content": "Discuss the launch checklist.",
  "tags": ["work", "launch"],
  "isPinned": false
}
```

`title` is required. `content` can be omitted and is stored as an empty string. Tags are trimmed, lowercased, and de-duplicated. A note holds at most 20 tags and 20 attachments.

Update body accepts any of `title`, `content`, `tags`, `isPinned`, and `isArchived`. At least one field is required.

List query:

| Query | Description |
| --- | --- |
| `q` | Case-insensitive match against title and content |
| `tag` | Exact tag match |
| `archived` | `true` returns archived notes. Omitted or `false` hides them. |
| `page` | Page number, starting at 1. Default `1`. |
| `limit` | Page size, maximum 50. Default `20`. |

Pinned notes are listed before the others, then by most recently updated.

List `data`:

```json
{
  "notes": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

A note looks like this:

```json
{
  "id": "6717c0f0a1b2c3d4e5f67890",
  "ownerId": "6717c0f0a1b2c3d4e5f67891",
  "title": "Meeting notes",
  "content": "Discuss the launch checklist.",
  "tags": ["launch", "work"],
  "isPinned": false,
  "isArchived": false,
  "attachments": [
    {
      "id": "6717c0f0a1b2c3d4e5f67892",
      "fileName": "agenda.pdf",
      "mimeType": "application/pdf",
      "size": 12034
    }
  ],
  "createdAt": "2026-10-22T12:00:00.000Z",
  "updatedAt": "2026-10-22T12:00:00.000Z"
}
```

S3 object keys stay on the server. Clients use the attachment id.

## Attachments and S3

Uploads go through the API. The browser does not talk to S3 directly for uploads. Files are kept private. Download URLs are presigned and expire after 15 minutes.

Allowed types: JPEG, PNG, WebP, GIF, PDF, plain text, and Markdown. Maximum size is 8 MB per file.

The IAM user needs `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on the bucket. Block public access on the bucket.

If the browser fetches a presigned URL, the bucket also needs a CORS rule that allows `GET` from `CLIENT_URL`. Bucket CORS is separate from the Express CORS config.

Example:

```bash
curl -X POST http://localhost:5000/api/notes/NOTE_ID/attachments \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@./agenda.pdf"
```

## Quick check

```bash
curl http://localhost:5000/api/health

curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","password":"password123"}'

curl http://localhost:5000/api/notes \
  -H "Authorization: Bearer TOKEN"
```

Replace `TOKEN` with the `data.token` value from register or login.
