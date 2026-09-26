# scraper — plan (Codex owns implementation)

Standalone tool, independent of the API stack: Browserbase (remote browser) + Stagehand (TypeScript; `extract()` with a zod schema mirroring `CarListing` in `api/models.py`). Outputs JSON to `data/listings.json`; loaded into Postgres via `POST /v1/listings/ingest` or a small loader script.

Sources:
- **Primary — Facebook Marketplace**: `facebook.com/marketplace/sanfrancisco/vehicles?query=tesla`, small radius (~8 mi), logged-out. Extract result cards, visit each listing for Tesla fields (`model`, `trim`, `battery_range_mi`, `autopilot_package`, `color`, `charging_included`, `battery_health_pct`), then keep only SF-proper zips (941xx) or "San Francisco" location text. Risk: login interstitial.
- **Fallback — Craigslist SF**: `sfbay.craigslist.org/search/sfc/cta?query=tesla` (`sfc` = SF city). Plain HTML, no login wall; same adapter shape.

Env: `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `OPENAI_API_KEY` (Stagehand extract model, `STAGEHAND_MODEL` override). See `.env.example`. Do not run against live sites without keys set.

Rate/ethics: read-only, logged-out, public listings only; cap ~20 listings per run, no loops; never extract seller contact (`seller.contact` stays null — outreach goes through the negotiation layer with user approval). Synthetic rows only as fallback, always `source=synthetic`.
