# Turso Setup

This repo now includes:

- bootstrap and import scripts for Turso
- a runtime sync bridge for Vercel and local Node runs

The current production mode is:

- local SQLite remains the fast in-process working store
- Turso acts as the remote persistence layer
- on cold start / refresh, MatchBuzz hydrates local SQLite from Turso
- after successful write APIs, MatchBuzz pushes the current local snapshot back to Turso

## What these scripts do

- `scripts/turso-bootstrap.mjs`
  - creates a Turso group if needed
  - creates a Turso database if needed
  - mints a database auth token
  - applies the current MatchBuzz schema
  - writes `.env.turso`

- `scripts/turso-import-local.mjs`
  - reads the local SQLite database
  - imports the current product data into Turso

## Required environment variables

Platform bootstrap:

- `TURSO_PLATFORM_API_TOKEN`
- `TURSO_ORG_SLUG`

Optional bootstrap inputs:

- `TURSO_DB_NAME=matchbuzz-prod`
- `TURSO_GROUP_NAME=default`
- `TURSO_GROUP_LOCATION=lhr`
- `TURSO_DB_TOKEN_EXPIRATION=never`
- `TURSO_DB_TOKEN_AUTHORIZATION=full-access`

Database import:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Optional import inputs:

- `LOCAL_SQLITE_PATH=./data/matchbuzz.sqlite`
- `TURSO_TRUNCATE_FIRST=1`

## Commands

Bootstrap a database:

```bash
TURSO_PLATFORM_API_TOKEN=... \
TURSO_ORG_SLUG=... \
TURSO_DB_NAME=matchbuzz-prod \
node scripts/turso-bootstrap.mjs
```

Import the current local SQLite data:

```bash
TURSO_DATABASE_URL=libsql://matchbuzz-prod-your-org.turso.io \
TURSO_AUTH_TOKEN=... \
LOCAL_SQLITE_PATH=./data/matchbuzz.sqlite \
TURSO_TRUNCATE_FIRST=1 \
node scripts/turso-import-local.mjs
```

## Vercel env vars after bootstrap

Add these to Vercel:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `TURSO_SYNC_INTERVAL_MS=15000`

Recommended existing app env vars:

- `SITE_URL=https://matchbuzz.vercel.app`
- `GMI_API_URL`
- `GMI_API_KEY`
- `GMI_MODEL`

## Runtime note

The app runtime is now a low-cost hybrid bridge:

- synchronous business logic still runs on local SQLite
- Turso is used as the persistent remote database
- this avoids a large async refactor before launch

## Next step if you want a cleaner long-term architecture

For a full Vercel-native pure-Turso runtime, the storage layer should eventually be refactored from synchronous `node:sqlite` calls to async `@libsql/client` calls.

That is no longer a blocker for launch, but it is still the right long-term direction.
