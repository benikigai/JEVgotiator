# JEVcar

Tell JEVcar what car you need, by API or iMessage. It turns your request into a structured buyer brief, narrows a master listings database over San Francisco with SQL, has **Jev (TypeSafe AI)** score and rerank the survivors into a top 5–10, lets you pick 1–3 cars, and hands them to a negotiation agent that drafts outreach and works the price with the seller. Built at the AI Collective JEVathon.

## Team and ownership

| Owner | Area | Deliverable |
| --- | --- | --- |
| Ben | Integration, plan, entry points | README/spec, FastAPI service, clarify + Jev rerank, Photon/iMessage webhook, Railway deploy, demo |
| Dara | Intelligence / negotiation layer | `POST /v1/negotiate`, outreach drafting, seller contact, price negotiation, follow-up jobs |
| Chris | Master car database | Postgres schema, `GET /v1/listings`, `POST /v1/listings/ingest`, seed data, source normalization |
| Codex | Contributor | Contract fixtures and build spec (`codex/*` branches) |

## Architecture

```mermaid
flowchart TD
    U[User] -->|HTTP| API[FastAPI service on Railway]
    U -->|iMessage| Photon[Photon] -->|webhook| API

    API --> Clarify[2. Clarify LLM → ideal prompt package]
    Clarify --> Filter[3. Filter 1: SQL hard criteria]
    Filter --> Jev[4. Jev rerank → top N]
    Jev --> Pick[5. User selects 1–3 listings]
    Pick --> Neg[6. Negotiation worker: Dara]
    Neg -->|reply| API

    Seed[Synthetic seed] --> Ingest[/v1/listings/ingest]
    FB[FB Marketplace scraper: Browserbase + Stagehand + Jev] --> Ingest
    Dealer[CarMax / dealer feeds] --> Ingest
    Ingest --> PG[(Postgres: listings, sessions, conversations)]
    PG --> Filter
    API <--> PG
    Neg <--> PG
```

One FastAPI deploy, one Postgres. The "agent" is a background worker in the same Railway deploy (or a second Railway service on the same database). No separate agent infrastructure.

## Pipeline stages

| # | Stage | Input → Output | Logged |
| --- | --- | --- | --- |
| 1 | Intake | Raw text via `POST /v1/search` or Photon webhook → `session` row | channel, session_id |
| 2 | Clarify | Raw text → `PromptPackage` (budget, body type, must-haves, urgency, radius) | fields inferred vs. asked |
| 3 | Filter 1 | `PromptPackage` → SQL over `listings` (price, year, mileage, body type, radius, title) | `candidates_after_sql` |
| 4 | Jev rerank | Candidates → Jev scores → top N (5–10) with reasons | `candidates_scored`, `top_n`, latency, cost |
| 5 | Feedback | User picks 1–3 listing ids → `sessions.selected_listing_ids` | selection |
| 6 | Negotiate | Selections → outreach draft → seller contact → price negotiation → (stretch) purchase + follow-up | job events |
| 7 | Sources | Synthetic seed, FB Marketplace scraper prototype, CarMax/dealer feeds; every listing carries `source` | ingest counts per source |

Stage counts (`total → after_sql → scored → top_n`) are returned in every search response so judges can see recall/precision and cost-per-query.

## API spec

Base URL: `https://<railway-app>.up.railway.app`. All bodies are JSON. Stubs return `501` until implemented.

### `GET /health`
```json
{ "status": "ok", "db": "ok", "version": "0.1.0" }
```

### `POST /v1/clarify` — raw text → prompt package
Request:
```json
{ "text": "Need a reliable hybrid under 20k for commuting from the Mission, buying this month" }
```
Response:
```json
{
  "package": {
    "budget_max_usd": 20000,
    "body_type": ["sedan", "hatchback"],
    "fuel_type": ["hybrid"],
    "must_haves": ["clean title", "no accidents"],
    "nice_to_haves": ["low mileage"],
    "urgency": "this_month",
    "location": { "zip": "94110", "radius_miles": 15 },
    "year_min": 2015,
    "mileage_max": 100000
  },
  "questions": ["Is $20k the sticker price or out-the-door total?"]
}
```

### `POST /v1/search` — raw text → clarified package + ranked top N
Request:
```json
{ "text": "...", "channel": "api", "top_n": 5, "session_id": null }
```
Response:
```json
{
  "session_id": "ses_01J...",
  "package": { "...": "PromptPackage as above" },
  "counts": { "total": 1240, "after_sql": 87, "scored": 87, "top_n": 5 },
  "cost": { "jev_calls": 87, "latency_ms": 1830 },
  "results": [
    { "rank": 1, "score": 0.91, "reasons": ["hybrid", "one owner", "under budget by $1.8k"], "listing": { "...": "CarListing" } }
  ]
}
```

### `POST /v1/sessions/{id}/select` — pick 1–3 listings
```json
{ "listing_ids": ["lst_abc", "lst_def"] }
```
Response: `{ "session_id": "ses_01J...", "selected": ["lst_abc", "lst_def"], "next": "POST /v1/negotiate" }`

### `POST /v1/negotiate` — Dara
Request:
```json
{ "session_id": "ses_01J...", "listing_id": "lst_abc", "target_price_usd": 17500, "walk_away_usd": 18500, "mode": "simulated" }
```
Response:
```json
{
  "job_id": "neg_01J...",
  "status": "drafted",
  "outreach_draft": "Hi, is the 2019 Prius still available? ...",
  "events": [{ "at": "...", "type": "draft_created" }],
  "outcome": null
}
```
`mode: simulated` (demo default) runs against a mocked seller; `live` requires an approval flag.

### `GET /v1/listings` — Chris
Query: `?make=Toyota&price_max=20000&year_min=2015&zip=94110&radius_miles=15&source=fb_marketplace&limit=50`
Response: `{ "count": 87, "items": [ CarListing, ... ] }`

### `POST /v1/listings/ingest` — Chris
Request: `{ "source": "synthetic", "items": [ CarListing, ... ] }`
Response: `{ "inserted": 40, "updated": 3, "rejected": [{ "index": 7, "error": "price missing" }] }`

### `POST /webhooks/photon` — iMessage inbound
Photon posts the inbound message; we look up/create the session by sender handle, run search or select depending on state, and reply via Photon's send API.
```json
{ "from": "+14155550123", "text": "hybrid under 20k", "message_id": "..." }
```
Response: `{ "ok": true, "session_id": "ses_01J...", "action": "search" }`

## Data schema

### `CarListing` (pydantic: `api/models.py`; SQL: `db/schema.sql`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `lst_...` |
| `vin` | string \| null | |
| `make`, `model`, `trim` | string | trim nullable |
| `year` | int | |
| `mileage` | int | miles |
| `price` | int | USD, advertised |
| `photos` | string[] | URLs |
| `accident_history` | string \| null | e.g. `none_reported`, `minor`, `major` |
| `maintenance_history` | string \| null | free text / summary |
| `history_report` | object \| null | `{ provider: carmax\|carfax\|autocheck, url, summary }` |
| `location` | object | `{ city, zip, lat, lng }` |
| `seller` | object | `{ type: private\|dealer, name, contact }` — contact never returned publicly |
| `source` | enum | `fb_marketplace \| carmax \| dealer \| synthetic` |
| `listing_url` | string | |
| `listed_at` | datetime | |
| `title_status` | enum | `clean \| salvage \| rebuilt \| lien \| unknown` |
| `how_soon` | string \| null | availability timeline, e.g. `now`, `this_week`, `after_2026-10-01` |

### `PromptPackage` — output of Clarify
`budget_max_usd, body_type[], fuel_type[], must_haves[], nice_to_haves[], urgency (asap|this_week|this_month|flexible), location {zip, radius_miles}, year_min, mileage_max`.

### `sessions`
`id, channel (api|imessage), user_handle, raw_text, package jsonb, counts jsonb, result_ids text[], selected_listing_ids text[], state (new|clarified|ranked|selected|negotiating|done), created_at, updated_at`. Conversations/negotiation events go in `negotiation_events` keyed by session.

## Hosting / deploy

- **Railway project** with two things: `web` (FastAPI via uvicorn, exposes `/v1/*`, `/webhooks/photon`, `/health`) and **Postgres** (Railway plugin; pgvector optional, not required for v1).
- **Agent worker**: a background task loop inside the same deploy (`python -m worker`) or a second Railway service using the same `DATABASE_URL`. It polls `negotiation_jobs` and runs Dara's logic.
- Secrets via Railway env vars (see `.env.example`): `DATABASE_URL`, `TYPESAFE_API_KEY`, `OPENAI_API_KEY` (clarify LLM), `PHOTON_API_KEY`, `PHOTON_WEBHOOK_SECRET`, `BROWSERBASE_API_KEY`.
- Photon webhook URL → `https://<app>/webhooks/photon`.

## Repo layout

```text
api/            FastAPI app: main.py (routes), models.py (pydantic schemas)
db/schema.sql   listings, sessions, negotiation_jobs/events
scraper/        FB Marketplace prototype (Browserbase + Stagehand + Jev) — README stub
negotiation/    Dara's layer — README stub
worker/         background job loop (stub)
.env.example, requirements.txt, Procfile
```

Codex's contract fixtures and `BUILD-SPEC.md` live on `codex/*` branches and will be merged into `examples/` and `docs/`.

## Demo script (3 min)

1. **0:00** Text the Photon number from a phone: "reliable hybrid under 20k, Mission, need it this month". Show the reply asking one clarifying question; answer it.
2. **0:45** Show the terminal log: `total=1240 → after_sql=87 → jev_scored=87 → top_n=5`, latency and cost-per-query.
3. **1:15** iMessage shows 5 ranked cars with one-line Jev reasons and links. Reply "1 and 3".
4. **1:45** Negotiation agent (simulated seller) drafts outreach, seller replies, agent counters; final agreed price shown vs. asking.
5. **2:30** Show `GET /v1/listings?source=fb_marketplace` proving scraped + synthetic sources in one DB, and the Railway dashboard (one service + Postgres).

## What's mocked

- Seller side of negotiation is simulated (`mode: simulated`); no real messages leave the system.
- Purchase, deposit, and follow-up are not implemented (stretch).
- Listings are mostly synthetic seed data; FB Marketplace scraper is a prototype with a handful of real rows, clearly tagged `source=fb_marketplace`.
- CarMax/dealer feeds are static fixtures.
- History reports are placeholders unless a listing carries a real report URL.

## Open questions

- Node.js/Vercel (Codex's draft spec) vs. FastAPI/Railway (this README): this README is the decision; reconcile `BUILD-SPEC.md` when merging.
- Clarify LLM: which model, and how many clarifying questions before searching (proposal: max 1 round for demo).
- Jev call shape: one scoring call per candidate vs. batched; cap candidates at ~50 before rerank?
- Budget semantics: advertised price vs. out-the-door.
- Photon: sender identity → session mapping and reply rate limits.
- Whether Dara's worker needs a persistent socket (voice) → second Railway service.
