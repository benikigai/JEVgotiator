# Chris's catalog integration

The dashboard is currently scoped to Tesla inventory inside San Francisco city. It loads every returned record before filtering. The bundled 1,000-car catalog is synthetic and visibly labeled. Every record is located in San Francisco: 950 are active, 30 are sold, and 20 have unknown availability. It has no real seller contact details, images, or invented listing URLs.

## Reproduce and import the synthetic dataset

Run `node scripts/generate-catalog.mjs` to recreate `data/catalog.json` with the fixed seed `20260926`. This JSON array uses the normalized `Car` shape and stable `demo-tesla-0001` through `demo-tesla-1000` identifiers, ready for Chris to map into his database. Import by ID with upserts if reloading, and preserve `mode: "synthetic"` plus `source: "synthetic"`. Generation writes the local JSON file only; it does not connect to or mutate a database.

The sample includes 250 each of Model 3, Y, S, and X; model-appropriate years from 2015 through 2026; six colors; sedan and SUV bodies; private and dealer sellers; several trim, condition, title, maintenance, and accident-history states. Mileage increases with age and affects asking price. Prices are synthetic scenario values, not appraisals or current market evidence. All vehicles are electric. Unknown history and unavailable inventory remain explicit for testing. No unverified physical dimensions or battery range specifications are invented.

## Connect the export API

Set server-only `CATALOG_API_URL` to Chris's actual HTTP(S) export endpoint. Set `CATALOG_API_KEY` if it requires `Authorization: Bearer ...`. Never expose either value in a client component. The server uses an eight-second timeout per page and refuses redirects so credentials cannot follow a redirect to another host.

The endpoint may return an array or `{ "items": [...] }`, `{ "listings": [...] }`, or `{ "cars": [...] }`. It may include `total` and a relative or absolute `next_url` for pagination on the same origin. `next` is also accepted when it is a URL. At most 5,000 records across 20 pages and 8 MB per page are accepted. Larger exports fail explicitly. An unsupported cursor or a total greater than the received records produces an incomplete-coverage warning. A configured API failure never falls back to synthetic data.

Chris's current Pydantic `CarListing` fields are accepted: `id`, `make`, `model`, `year`, numeric `price` in USD, numeric `mileage` in miles, `location.city`, `seller`, `source`, and `listing_url`. The earlier documentation's `listing_id`, `mileage_miles`, and `price.advertised_price_cents` are also accepted. Currency must be USD. Invalid identity/year/location records and duplicate listing IDs are rejected and counted in warnings.

Chris must also export:

- `status: "active" | "sold" | "unknown"`, or `availability.status`. His initial Pydantic shape has no status field. Missing status stays unknown and is excluded from active search, but still appears in catalog counts.
- `observed_at` or `listed_at`, ideally the last time listing availability was checked. Missing timestamps produce a freshness warning.
- `available_from: "YYYY-MM-DD" | null` when known. A vague `how_soon` value is not converted into a made-up date.
- `body_type`, `fuel_type`, and `exterior_color` where known. Unknown required values cannot satisfy filters.
- A named source provider such as `fb_marketplace`, `carmax`, `carvana`, `dealer`, `local_dealer`, or `tesla`. A record from the configured API with one of these providers is labeled live unless it explicitly declares synthetic/replay mode. This establishes API provenance, not independent truth of seller claims. Unknown providers are labeled replay. Synthetic source labels always win.

Example export record:

```json
{
  "id": "provider-listing-id",
  "make": "Tesla",
  "model": "Model 3",
  "year": 2020,
  "price": 21000,
  "mileage": 45000,
  "location": { "city": "San Francisco", "zip": "94110" },
  "seller": { "type": "dealer", "name": "Dealer display name" },
  "source": "dealer",
  "listing_url": null,
  "status": "active",
  "observed_at": "2026-09-26T20:00:00Z",
  "available_from": null,
  "title_status": "unknown",
  "accident_history": null,
  "photos": []
}
```

## Filters and verification

Code always enforces Tesla, San Francisco city, active availability, and known advertised price within budget. Buyer-specified year, mileage, make, color, body type, fuel type, clean-title, and no-reported-accident constraints are hard filters. Missing values fail required criteria. No-reported-accident status requires an explicit supported value; a mention of the words inside a longer narrative is insufficient.

An out-the-door budget uses asking price only to create a provisional shortlist. This is never a verified total: taxes, registration, dealer fees, and quote evidence remain outstanding. The ranking/output layer must set `verification_required: true` for these results. It must also mark an unknown availability date for verification when the buyer has a deadline. Known availability later than the deadline is excluded. No filter is silently relaxed to create results.

Only the public normalized fields leave this adapter. Seller contact values, contact references, VINs, arbitrary raw provider objects, and private notes are omitted. Contact-like email addresses and phone numbers are redacted from free text. `contact_available` is a boolean hint; it is not a contact endpoint or authorization to contact anyone. Synthetic cars always have `contact_available: false`.

## Integration handoff

Supply the actual API URL, auth convention, one sanitized response, and pagination behavior. No endpoint or live database connection has been assumed. Keep source record IDs stable so Dara's optimization adapter can resolve selected listings server-side after the buyer authorizes contact.
