# MatchBuzz

MatchBuzz is a World Cup-focused bilingual football content and interaction site.

It includes:

- Home + Studio page for content generation and fan interaction
- About / Pricing / Admin pages for competition-style product presentation
- Mock-first architecture with remote provider hooks for real LLM APIs and real match data APIs
- Share card export, fan polls, moderation endpoint, and deployment-ready files

## Local run

```bash
npm start
```

Default address:

```bash
http://127.0.0.1:3000
```

## Environment variables

Copy `.env.example` and set the values in your deployment environment.

For public hosting platforms, set:

```bash
APP_HOST=0.0.0.0
```

Important variables:

```bash
GMI_API_URL=https://api.gmi-serving.com/v1/chat/completions
GMI_API_KEY=
GMI_MODEL=MiniMaxAI/MiniMax-M2.7
MATCH_DATA_API_URL=
MATCH_DATA_API_KEY=
```

Behavior:

- The app reads `.env` automatically in local development.
- If `GMI_API_KEY` is configured, generation will try the remote model first and fall back to local templates if needed.
- `MiniMaxAI/MiniMax-M2.7` is the default GMI model, and the internal playground id `b55d47ed-0d1e-467e-ae93-f1500402d184` is mapped to that model automatically.
- If `MATCH_DATA_API_*` is configured, match lists will try the remote source first and fall back to local demo data if needed.

## Pages

- `/` Home + Studio + Pulse + Share
- `/about.html` Product overview
- `/pricing.html` Commercial model page
- `/admin.html` Integration status page

## API routes

- `GET /api/system/status`
- `GET /api/matches`
- `GET /api/matches/:id`
- `POST /api/generate`
- `POST /api/generate/share-card`
- `POST /api/polls`
- `POST /api/polls/:id/vote`

## Docker

Build:

```bash
docker build -t matchbuzz .
```

Run:

```bash
docker run -p 3000:3000 -e APP_HOST=0.0.0.0 --env-file .env matchbuzz
```

## Notes

- The current remote LLM integration targets GMI's OpenAI-compatible chat endpoint by default.
- The current match data integration expects the remote endpoint to return either an array of matches or `{ "matches": [...] }`.
- Once you provide the real API documentation, the request/response adapters can be made exact.
- Poll state is stored in memory and resets when the server restarts.
