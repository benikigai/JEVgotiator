# AutoMuse · JEVgotiator

**A car finder with taste and receipts.** AutoMuse turns a buyer's practical constraints and a clearly synthetic lifestyle profile into a ranked shortlist of five used Teslas.

Built for the AI Collective JEVathon with [TypeSafe JEV](https://docs.typesafe.ai/) and [MarketCheck](https://developers.marketcheck.com/).

## What the demo does

- Creates a **synthetic buyer profile** from low-stakes preferences such as city driving, road trips, cargo needs, and visual style.
- Pulls **live Tesla inventory** from MarketCheck when deployed with a server-side API key.
- Applies hard filters for model, maximum price, maximum mileage, and black exterior.
- Ranks the **five strongest matches** with adjustable weights for value, visible-condition evidence, road-trip readiness, and profile fit.
- Displays listing photos and links, but keeps every live vehicle marked **INSPECT** until its VIN history, battery health, and physical condition are verified.

The profile is a product-demo persona, never a real person. It is intentionally prevented from overriding the buyer's price, safety, vehicle-history, or battery constraints.

## How it works

```mermaid
flowchart LR
  P[Synthetic buyer profile] --> R[Ranking preferences]
  U[Buyer controls] --> R
  M[MarketCheck live inventory] --> A[/api/listings]
  A --> R
  R --> T[Top 5 Tesla matches]
  V[Photos + VIN records] -. structured evidence via JEV .-> R
  T --> I[Inspect before purchase]
```

The current MarketCheck route provides real listing facts: price, mileage, photos, model, VIN, seller link, and title-history hints. It does **not** claim that a photo proves a car is mechanically sound. JEV is the decision layer for turning later photo inspection, VIN-history, and service-record assessments into explicit condition signals before they influence the ranking.

## Run it

The dashboard lives in [`dara-sample/`](./dara-sample).

### Static UI preview

The UI works without credentials and shows clearly labelled synthetic inventory:

```bash
cd dara-sample
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173). A static server cannot run the live API route, so it intentionally falls back to the demo listings.

### Live MarketCheck inventory

The live route is a Vercel serverless function at [`dara-sample/api/listings.js`](./dara-sample/api/listings.js). Keep the MarketCheck credential in the server environment:

```bash
cd dara-sample
cp .env.example .env.local
# Add MARKETCHECK_API_KEY to .env.local
vercel dev
```

`MARKETCHECK_API_KEY` is ignored by Git and is never sent to the browser. The client calls `/api/listings`; the server fetches MarketCheck and returns only the fields the dashboard needs.

## Deploy on Vercel

1. Import this GitHub repository into Vercel.
2. Set the project's **Root Directory** to `dara-sample`.
3. Add `MARKETCHECK_API_KEY` under **Environment Variables**.
4. Deploy.

The dashboard will switch from **SYNTHETIC PREVIEW** to **LIVE MARKETCHECK INVENTORY** once `/api/listings` is available.

## Ranking inputs

| Input | Role in the match |
| --- | --- |
| Price and mileage | Hard filters plus value score |
| Model and exterior color | Hard filters |
| Model year | Fixed quality signal |
| Listing photo coverage | Evidence coverage only; it is not a condition verdict |
| Clean-title field | A title-history hint, not a full accident report |
| Road-trip fit | Model/cargo preference score |
| Synthetic profile fit | Low-stakes tie-breaker only |

The controls at the top of the dashboard re-rank the shortlist immediately. **Refresh matches** also requests a new live-inventory set using the current hard filters.

## Project structure

```text
dara-sample/
├── api/listings.js    # Server-side MarketCheck proxy and conservative listing mapper
├── app.js             # UI controls, ranking logic, synthetic fallback inventory
├── index.html         # Dashboard structure
├── styles.css         # Responsive visual design
├── .env.example       # Environment-variable template (contains no secret)
└── README.md          # Component-level setup notes
```

## Decision boundaries

AutoMuse is a shortlist tool, not an automatic car buyer. Before a purchase, the buyer should review the VIN history, confirm title status, inspect the vehicle in person, and verify battery health. The app presents those gaps directly so a high match score is never mistaken for proof of quality.
