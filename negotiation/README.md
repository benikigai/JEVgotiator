# negotiation

Dara's intelligence/negotiation layer. Consumes `negotiation_jobs` rows (see `db/schema.sql`), drafts outreach, contacts the seller, negotiates toward `target_price_usd` without exceeding `walk_away_usd`, and appends `negotiation_events`. Exposed via `POST /v1/negotiate`; runs in the background worker.

`mode=simulated` (demo default) uses a mocked seller. Purchase + follow-up is a stretch goal.

Stub only; no implementation yet.
