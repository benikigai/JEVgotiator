-- JEVgotiator Postgres schema. Single store for listings, sessions, negotiation.
-- Scope: used Tesla listings in San Francisco city proper (zip 941xx), populated by scraper/.
-- CREATE EXTENSION IF NOT EXISTS vector;  -- optional pgvector, not needed for v1

CREATE TABLE IF NOT EXISTS listings (
    id                  TEXT PRIMARY KEY,
    vin                 TEXT,
    make                TEXT NOT NULL DEFAULT 'Tesla',
    model               TEXT NOT NULL,                 -- 3 | Y | S | X | Cybertruck
    year                INT  NOT NULL,
    trim                TEXT,
    mileage             INT  NOT NULL,
    price               INT  NOT NULL,                 -- USD, advertised
    photos              JSONB NOT NULL DEFAULT '[]',
    accident_history    TEXT,
    maintenance_history TEXT,
    history_report      JSONB,                          -- {provider, url, summary}
    city                TEXT,
    zip                 TEXT,
    lat                 DOUBLE PRECISION,
    lng                 DOUBLE PRECISION,
    seller_type         TEXT CHECK (seller_type IN ('private', 'dealer')),
    seller_name         TEXT,
    seller_contact      TEXT,                           -- never exposed publicly
    source              TEXT NOT NULL CHECK (source IN ('fb_marketplace', 'craigslist', 'carmax', 'dealer', 'synthetic')),
    listing_url         TEXT,
    listed_at           TIMESTAMPTZ,
    title_status        TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (title_status IN ('clean', 'salvage', 'rebuilt', 'lien', 'unknown')),
    how_soon            TEXT,
    -- Tesla-specific (nullable)
    battery_range_mi    INT,
    autopilot_package   TEXT CHECK (autopilot_package IN ('none', 'AP', 'EAP', 'FSD')),
    color               TEXT,
    charging_included   BOOLEAN,
    battery_health_pct  NUMERIC(5,2),
    raw                 JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_filter_idx ON listings (price, year, mileage, title_status);
CREATE INDEX IF NOT EXISTS listings_source_idx ON listings (source);
CREATE INDEX IF NOT EXISTS listings_zip_idx    ON listings (zip);

CREATE TABLE IF NOT EXISTS sessions (
    id                   TEXT PRIMARY KEY,
    channel              TEXT NOT NULL CHECK (channel IN ('api', 'imessage')),
    user_handle          TEXT,
    raw_text             TEXT,
    package              JSONB,                         -- PromptPackage
    counts               JSONB,                         -- {total, after_sql, scored, top_n}
    result_ids           TEXT[] NOT NULL DEFAULT '{}',
    selected_listing_ids TEXT[] NOT NULL DEFAULT '{}',
    state                TEXT NOT NULL DEFAULT 'new'
                         CHECK (state IN ('new', 'clarified', 'ranked', 'selected', 'negotiating', 'done')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_handle);

CREATE TABLE IF NOT EXISTS negotiation_jobs (
    id               TEXT PRIMARY KEY,
    session_id       TEXT NOT NULL REFERENCES sessions (id),
    listing_id       TEXT NOT NULL REFERENCES listings (id),
    target_price_usd INT,
    walk_away_usd    INT,
    mode             TEXT NOT NULL DEFAULT 'simulated' CHECK (mode IN ('simulated', 'live')),
    status           TEXT NOT NULL DEFAULT 'queued',    -- queued|drafted|contacted|negotiating|agreed|failed
    outreach_draft   TEXT,
    outcome          JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS negotiation_events (
    id         BIGSERIAL PRIMARY KEY,
    job_id     TEXT NOT NULL REFERENCES negotiation_jobs (id),
    type       TEXT NOT NULL,
    payload    JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
