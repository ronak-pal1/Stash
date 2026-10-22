# Stash

Stash is a notes platform. You keep personal notes, pin or archive them, and attach private files.

The repo has two apps:

| Folder | What it is | Default URL |
| --- | --- | --- |
| `client` | React app (Vite, TypeScript, Tailwind, React Router) | http://localhost:5173 |
| `server` | REST API (Express, TypeScript, MongoDB, JWT, S3) | http://localhost:5000 |

The client and the API are separate packages. Each has its own `package.json`. The API does not serve the frontend.

API setup, environment variables, and endpoints are documented in [server/README.md](server/README.md).

## Prerequisites

- Node.js 20 or newer
- MongoDB, for the API
- An S3 bucket, only if you want note attachments

Start Mongo locally with Docker:

```bash
docker run -d --name stash-mongo -p 27017:27017 mongo:7
```

## Run locally

Use two terminals.

API:

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Client:

```bash
cd client
npm install
npm run dev
```

`CLIENT_URL` in the API defaults to `http://localhost:5173`, which matches the Vite dev server. CORS allows that origin.

Before you share `server/.env`, replace `JWT_SECRET` with a long random value:

```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

## Scripts

From `client`:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck and build the static app |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

From `server`:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the API with reload on file changes |
| `npm run typecheck` | Typecheck without emitting files |
| `npm run build` | Compile to `server/dist` |
| `npm start` | Run the compiled API |

## Layout

```
client/          React app
server/          Express API
  src/
    config/      environment, database, upload limits
    models/      User and Note schemas
    validators/  request schemas
    services/    auth, notes, and S3
    controllers/ HTTP handlers
    routes/      routes mounted at /api
    middlewares/ auth, validation, uploads, errors
    libs/        JWT, S3, shared helpers
```
