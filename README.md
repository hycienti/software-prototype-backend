# Havens Backend (API)

HTTP **JSON API** for the Haven product: **AdonisJS v6**, **TypeScript**, **PostgreSQL**, **Lucid ORM**, auth (user + therapist access tokens), AI/voice orchestration, payments, scheduling, messaging, file storage (Drive: `fs` | S3 | **R2** | GCS), email (Resend), and realtime (Pusher).  

This README explains how to run the API **locally** (with or without Docker), configure **environment variables**, run **migrations**, optional **seeds**, and verify the stack.

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | **22.x** matches the production Docker image (`node:22.12.0` in `Dockerfile`). **20+** usually works for local dev. |
| **pnpm** | **9.x** used in Docker (`pnpm@9.15.5`). Install: `corepack enable && corepack prepare pnpm@9.15.5 --activate`. |
| **PostgreSQL** | **16** recommended (Docker Compose uses `postgres:16-alpine`). Local install or container both work. |
| **Git** | Clone the repo. |

Optional:

- **Docker + Docker Compose** — fast path: DB + API in one stack (`docker-compose.dev.yml`).
- **curl** or **HTTP client** — smoke-test endpoints.

---

## Clone and install

```bash
git clone <your-remote-url> havens-backend
cd havens-backend
pnpm install
```

(`package-lock.json` may exist; the maintained lockfile for this project is **`pnpm-lock.yaml`**.)

---

## Environment configuration

### 1. Copy the example env file

```bash
cp .env.example .env
```

Edit **`.env`** — it is **not** committed. Never commit real secrets.

### 2. Generate `APP_KEY` (required)

Adonis encrypts cookies/sessions and uses `APP_KEY`. Generate a key:

```bash
node ace generate:key
```

Paste the output into `.env` as:

```env
APP_KEY=<the-generated-key>
```

### 3. Core variables (minimum to boot)

These are **validated** at startup (`start/env.ts`). Typo-safe summary:

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_URL` | Yes | Public base URL, e.g. `http://localhost:3333` for local dev. |
| `HOST` | Yes | Bind address, usually `localhost` or `0.0.0.0` (Docker). |
| `PORT` | Yes | HTTP port, default **3333**. |
| `NODE_ENV` | Yes | `development`, `production`, or `test`. |
| `LOG_LEVEL` | Yes | e.g. `info`, `debug`. |
| `APP_KEY` | Yes | From `node ace generate:key`. |
| `DB_HOST` | Yes | PostgreSQL host, e.g. `127.0.0.1` or `postgres` in Docker. |
| `DB_PORT` | Yes | Usually `5432`. |
| `DB_USER` | Yes | e.g. `postgres`. |
| `DB_PASSWORD` | Optional | Empty allowed for local trust auth; set in production. |
| `DB_DATABASE` | Yes | e.g. `haven`. |
| `DRIVE_DISK` | Yes | **`fs`**, **`s3`**, **`r2`**, or **`gcs`** — must match your storage setup. |

### 4. Local development with `fs` disk

For the quickest path without cloud storage:

```env
DRIVE_DISK=fs
```

R2/S3/GCS fields can remain empty if you truly only use local disk and code paths support it—**some features** (public URLs for attachments, therapist uploads) expect a **public base URL** for objects when using cloud disks (`R2_PUBLIC_URL` etc.). See `.env.example` comments.

### 5. Optional / feature-specific variables

Consult **`.env.example`** for the full list. Highlights:

| Area | Variables (examples) |
|------|----------------------|
| **OAuth** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_*`, `TWITTER_*` |
| **OpenAI** | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| **ElevenLabs** | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`, `ELEVENLABS_STT_MODEL_ID` |
| **Email (Resend)** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` — needed for OTP and notifications that send mail. |
| **Pusher** | `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `PUSHER_USE_TLS` |
| **Video (VideoSDK)** | `VIDEO_SDK_API_KEY`, `VIDEO_SDK_SECRET` (recommended) or `VIDEO_SDK_TOKEN` fallback |
| **Object storage** | `AWS_*`, `R2_*`, `R2_PUBLIC_URL`, `GCS_*` per `DRIVE_DISK` |

Docker Compose **development** injects dummy or placeholder values for several keys so the process starts; **replace** them for real features (OpenAI, Resend OTP email, etc.).

---

## Database setup

### Create database (bare metal PostgreSQL)

```bash
# Example using psql as superuser
createdb haven
# or
psql -U postgres -c "CREATE DATABASE haven;"
```

Ensure `DB_*` in `.env` match.

### Run migrations

```bash
node ace migration:run
```

Rollback (if needed):

```bash
node ace migration:rollback
```

Migrations live in `database/migrations/`.

---

## Running the API (local Node, no Docker)

1. PostgreSQL running and database created.  
2. `.env` filled (at least **APP_KEY**, **DB_***, **DRIVE_DISK**).  
3. Migrations applied.

Start the dev server with file watching:

```bash
pnpm dev
# runs: node ace serve --watch
```

Default URL: **`http://localhost:3333`** (unless `PORT`/`HOST` differ).

Quick health check:

```bash
curl -s http://localhost:3333/
```

You should see JSON with a status message.

### Other useful Ace commands

| Command | Purpose |
|---------|---------|
| `pnpm start` | Run compiled server (`node bin/server.js`) — typical after **build**. |
| `pnpm build` | `node ace build` — compile TypeScript to `build/`. |
| `pnpm test` | `node ace test` — test suite. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm lint` | ESLint. |

---

## Running with Docker (recommended for parity)

File: **`docker-compose.dev.yml`**.

### Before compose up

1. Copy `.env.example` → `.env`.  
2. Set a real **`APP_KEY`** (`node ace generate:key` on host is fine; paste into `.env`).  
3. Compose passes **`DB_HOST=postgres`** inside the API container; your **host** `.env` can still use `127.0.0.1` for local tools—the ** compose file overrides** DB host for the `api` service.

The compose file sets **`DRIVE_DISK=${DRIVE_DISK:-fs}`** for the API container, so a fresh stack boots without cloud storage. Override in `.env` if you need **`s3`**, **`r2`**, or **`gcs`** (and supply the matching keys in `.env`).

### Start stack

From `havens-backend` root:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Wait for Postgres **healthy**, then **migrate** (and optionally seed):

```bash
docker compose -f docker-compose.dev.yml exec api node ace migration:run
docker compose -f docker-compose.dev.yml exec api node ace seed:therapists
```

Convenience script (from `package.json` — reads same compose file):

```bash
pnpm run docker:up:detached
```

This brings containers up, waits, runs migrations, then **`seed:therapists`**.

### Logs

```bash
pnpm run docker:logs
# or
docker compose -f docker-compose.dev.yml logs -f api
```

### Stop

```bash
pnpm run docker:down
# or
docker compose -f docker-compose.dev.yml down
```

Postgres data persists in the **`postgres_data`** volume unless you remove volumes.

---

## API surface / HTTP

- **Root** `GET /` — liveness-style JSON.
- **Versioned REST** — under **`/api/v1`** (see `start/routes.ts`).
- **OpenAPI** — spec at `GET /docs/openapi.yml`; UI at `/docs` or `/swagger` (see routes).

Authentication:

- **Users (clients):** Bearer tokens with prefix **`hvn_`** (see `User` model access tokens).
- **Therapists:** separate guard; tokens use prefix **`oat_`** (see `Therapist` model).  

---

## Seeding

Therapist seed command (used in Docker helper):

```bash
node ace seed:therapists
```

Inside Docker:

```bash
docker compose -f docker-compose.dev.yml exec api node ace seed:therapists
# or
pnpm run docker:seed:therapists
```

Implementation: `commands/seed_therapists.ts`. Adjust or extend for your environment.

---

## Production build (overview)

```bash
pnpm build
pnpm start
```

Run `node bin/server.js` from the **`build/`** output directory as wired in `package.json` / Dockerfile **production** stage. Set **`NODE_ENV=production`**, strong **`APP_KEY`**, real **DB** and **DRIVE_DISK** credentials, **HTTPS** termination (reverse proxy), and secure CORS / rate limits per your deployment target.

---

## Troubleshooting

| Issue | Checks |
|-------|--------|
| **Env validation error on boot** | Every required key in `start/env.ts`; `DRIVE_DISK` must be exactly `fs`, `s3`, `r2`, or `gcs`. |
| **Cannot connect to DB** | `DB_HOST`/`PORT` from host vs Docker (`postgres` service name inside compose network). |
| **Migrations fail** | Postgres version, user permissions, existing schema conflicts. |
| **OTP email not sent** | `RESEND_*` keys and verified domain/sender with Resend. |
| **Video room errors** | `VIDEO_SDK_API_KEY` + `VIDEO_SDK_SECRET` (or valid `VIDEO_SDK_TOKEN`). |
| **Uploads / broken media URLs** | `DRIVE_DISK` config, `R2_PUBLIC_URL` (or equivalent) for public readability. |

---

## Related repository

- **Mobile app:** **Haven** (Expo) — see **`Haven/README.md`** for `EXPO_PUBLIC_API_URL`, simulators, and client/therapist app runbooks.

---

## License

Refer to `package.json` / your organization (`UNLICENSED` in current metadata).
