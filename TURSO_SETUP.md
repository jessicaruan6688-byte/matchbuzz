# Turso Setup

This repo now includes bootstrap and import scripts for Turso.

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

## Important note

The current production runtime still uses synchronous local SQLite access in `server.js`.
That means these Turso scripts handle database provisioning and migration, but the live runtime is not yet fully switched to Turso.

For a full Vercel-native Turso runtime migration, the storage layer must be refactored from synchronous `node:sqlite` calls to async `@libsql/client` calls.

That is the next engineering step after database creation and data import.
