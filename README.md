# AutoMuse · JEVgotiator

**A used-Tesla finder with taste and receipts.** Built for the AI Collective JEVathon with [TypeSafe JEV](https://docs.typesafe.ai/) and [MarketCheck](https://developers.marketcheck.com/).

AutoMuse creates a clearly synthetic buyer profile, pulls Tesla listings, and shows the five strongest matches. Change the filters or move the priority sliders to re-rank them instantly.

## What it includes

- Synthetic buyer profile for city driving, road trips, cargo, and visual style
- Live MarketCheck inventory: prices, mileage, photos, and listing links
- Filters for model, budget, mileage, and black exterior
- Match weights for value, visible evidence, road-trip readiness, and profile fit
- An **INSPECT** label on every live car until its VIN, battery, and physical condition are checked

## Run it

The app is in [`dara-sample/`](./dara-sample).

```bash
cd dara-sample
cp .env.example .env.local
# Add MARKETCHECK_API_KEY to .env.local
vercel dev
```

For a no-key UI preview, serve `dara-sample` with any static server. It will use clearly marked synthetic inventory.

## How the match works

```text
buyer controls + synthetic profile + MarketCheck listings
                         ↓
                    weighted ranking
                         ↓
                 five Tesla recommendations
```

JEV is the decision layer for structured photo, history, and service-record evidence. MarketCheck gives listing facts; it does not prove battery health, accident history, or hidden damage.

## Deploy

Import the repository into Vercel, set the root directory to `dara-sample`, add `MARKETCHECK_API_KEY`, and deploy. The browser never receives the key.

## Project files

```text
dara-sample/
├── api/listings.js  # Server-side MarketCheck proxy
├── app.js           # UI and ranking logic
├── index.html       # Dashboard
└── styles.css       # Visual design
```

AutoMuse is a shortlist tool. Check the VIN history, title, battery, and vehicle in person before buying.
