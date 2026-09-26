# Search comparison, September 26, 2026

Brief: black Tesla Model 3, model year 2019 or newer, advertised price at most $30,000, at most 80,000 miles, in San Francisco city.

| Measure | Assisted public-browser search | JEVgotiator API |
| --- | --- | --- |
| Observed elapsed time | More than 4 minutes, from 22:42:43 to after 22:46:54 UTC | 728 ms wall time for one production POST |
| Path | Google search, TrueCar, CARFAX | `/api/v1/search` on Vercel, 1,000-row synthetic catalog, TypeSafe Jev |
| Work | TrueCar human verification interrupted the path. CARFAX required separate year, price, mileage, color and exact-city inspection. The inspected first page did not yield a verified exact-city black match. | 19 eligible, 19 scored, five shown |
| Model usage | Not metered. This was an assisted browser proxy, not an authenticated Muse run. | 8,167 Jev input tokens, `jev-1.13.0` |
| Model cost | Unknown | $0.000343 estimated input cost from the app's configured rate; output, platform, and other costs excluded |
| Data quality | Public listing data, incomplete validation | Synthetic inventory, no real sellers |

This is a live workflow demonstration, not a controlled quality or model-cost benchmark. The two paths use different inventories. CARFAX returned nearby cities in its San Francisco area search, so a nearby black Tesla does not count as a city match. The browser run's AI tokens were unavailable, and no 4–5 minute wait was inserted into the API run. Repeating the API request may change latency, token count, ranking, or price estimate.

The API request used `budget_basis=advertised_price`, `city=San Francisco`, `min_year=2019`, `max_mileage=80000`, `make=Tesla`, `model=Model 3`, and `color=black`, with no additional title or accident constraint. The response was `live_jev` with 220 ms reported Jev latency and no warning. No seller contact occurred.
