# MatchBuzz

MatchBuzz is a World Cup-focused football interaction product for overseas audiences.

It is no longer just a front-end demo. The current codebase includes:

- bilingual product pages in English and Chinese
- a real Node backend in [server.js](./server.js)
- SQLite-backed members, sessions, points, referrals, reservations, and sponsor leads
- GMI-backed content generation and page-intel calls
- real football fixtures from TheSportsDB
- SEO routes for `robots.txt` and `sitemap.xml`

## Product surfaces

- `/` and `/zh/index.html`
  Home, Studio, live interaction, share cards, member loop
- `/matches.html` and `/zh/matches.html`
  Real fixture list
- `/match.html?id=...` and `/zh/match.html?id=...`
  Real fixture detail pages
- `/community.html` and `/zh/community.html`
  Fan-room list
- `/community-room.html?id=...` and `/zh/community-room.html?id=...`
  Individual player or team rooms
- `/watch-parties.html` and `/zh/watch-parties.html`
  Real reservation flow with points credits
- `/partners.html` and `/zh/partners.html`
  Sponsor packages with real lead submission
- `/growth.html` and `/zh/growth.html`
  Growth, referral, and SEO operations board
- `/admin.html` and `/zh/admin.html`
  Internal ops dashboard

## Key backend routes

- `GET /api/system/status`
- `GET /api/growth/overview?language=en|zh`
- `GET /api/news/football`
- `GET /api/briefing?language=en|zh`
- `GET /api/real/fixtures?scope=upcoming|recent&language=en|zh`
- `GET /api/real/fixtures/:id?language=en|zh`
- `GET /api/community/rooms?language=en|zh`
- `GET /api/watch-parties?language=en|zh`
- `GET /api/sponsor-packages?language=en|zh`
- `GET /api/member/overview?language=en|zh`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/member/check-in`
- `POST /api/member/redeem`
- `POST /api/generate`
- `POST /api/polls`
- `POST /api/watch-parties/:id/reserve`
- `POST /api/sponsor-leads`

## Local run

1. Copy `.env.example` to `.env`
2. Fill in at least `GMI_API_KEY`
3. Start the server

```bash
cp .env.example .env
npm start
```

Default local address:

```bash
http://127.0.0.1:3000
```

## Environment variables

Required for real model calls:

```bash
GMI_API_URL=https://api.gmi-serving.com/v1/chat/completions
GMI_API_KEY=
GMI_MODEL=MiniMaxAI/MiniMax-M2.7
```

Recommended for deployment:

```bash
APP_HOST=0.0.0.0
SITE_URL=https://your-domain.com
```

Real fixtures:

```bash
REAL_FIXTURE_API_URL=https://www.thesportsdb.com/api/v1/json/123
REAL_FIXTURE_LEAGUE_ID=4328
REAL_FIXTURE_SEASON=2025-2026
REAL_FIXTURE_CACHE_MS=300000
```

Optional remote custom match feed:

```bash
MATCH_DATA_API_URL=
MATCH_DATA_API_KEY=
MATCH_DATA_API_STYLE=matchbuzz-json
```

Notes:

- `.env` is read automatically in local development.
- the GMI playground UUID `b55d47ed-0d1e-467e-ae93-f1500402d184` is internally mapped to `MiniMaxAI/MiniMax-M2.7`
- if GMI is unavailable, generation falls back to local templates
- if remote match feeds are unavailable, the app falls back to built-in match data
- `SITE_URL` is important for correct `canonical` and `sitemap.xml` output after deployment

## Data storage

SQLite database path:

```bash
data/matchbuzz.sqlite
```

Current persisted entities include:

- members
- member sessions
- member points ledger
- campaigns
- polls
- watch-party reservations
- watch-party point redemptions
- sponsor leads
- LLM call logs

## GMI usage tracking

The admin page now shows:

- total GMI calls
- prompt tokens
- completion tokens
- total tokens
- latest GMI requests by scope

You can also inspect this through:

```bash
curl -s http://127.0.0.1:3000/api/system/status
```

## SEO support

The backend now serves:

- `/robots.txt`
- `/sitemap.xml`

Important SEO behavior:

- public product pages are indexable
- `auth` and `admin` pages are `noindex`
- English and Chinese pages expose `hreflang`
- homepage, growth page, fixtures page, and match page include structured metadata

## Docker

Build:

```bash
docker build -t matchbuzz .
```

Run:

```bash
docker run -p 3000:3000 --env-file .env matchbuzz
```

The Docker image binds to `0.0.0.0` by default.

## Deployment recommendation

This project is not a pure static site anymore. Do not deploy it to GitHub Pages.

Use a Node-capable host instead, for example:

- Render
- Railway
- Fly.io
- VPS with Docker

The minimum deployment checklist is:

1. push the repo to GitHub
2. deploy as a Node web service
3. set `GMI_API_KEY`
4. set `SITE_URL` to the final public domain
5. keep `APP_HOST=0.0.0.0`
6. verify `/api/system/status`, `/robots.txt`, and `/sitemap.xml`

## Render example

See [render.yaml](./render.yaml).
