# JEVgotiator

A Tesla buying dashboard for San Francisco. Describe what you need, confirm the structured brief, filter the inventory, rank up to 30 candidates with Jev, and select one to three cars for a negotiation plan.

The Next.js 16 app includes the dashboard and API. It ships with 1,000 clearly labeled synthetic Teslas. Dara's weighted intelligence rules from branch commit `163fa478` are ported for the buyer's selected cars, with a separately labeled synthetic negotiation scenario. Live catalog and seller-contact adapters still need verified endpoints. Jev runs when its server credential is configured; otherwise results are explicitly unscored. The [Eve agent](eve-agent/README.md) implements the Photon buyer conversation and calls the same API.

Open [the public site](https://jevgotiator.vercel.app) or [live sessions](https://jevgotiator.vercel.app/dashboard?view=activity). Vercel, Eve, and [Railway](https://jevgotiator-production.up.railway.app) serve verified revision `82ee96a`. A fresh Eve run completed clarification, live Jev search, and a two-car plan containing Dara scores and a labeled synthetic negotiation scenario. Seller contact is disabled. Use the short Vercel domain; the long team alias requires SSO.

The user confirmed a real Photon iMessage send-and-reply round trip. The durable Activity feed showed seven messages and five search results for that conversation. Activity polls every three seconds and connects messages, tool calls, shortlist, and Jev trace. Use the recipient line assigned to your Photon-registered sender; shared recipient assignments can differ between users. Personal sender numbers and credentials do not belong in this repository.

The landing page shows the architecture and stack. Text `/reset` to preserve prior iMessage history and start a fresh conversation on the next text; the user confirmed the reset acknowledgment and fresh reply. The dashboard’s **New web search** button separately clears browser search state and was verified in the live UI. Generate a new plan to show Dara intelligence; historical plans are not rewritten. Follow the [two-minute walkthrough](docs/demo-walkthrough.md).

## Run

Use Node.js 22 or 24.

```sh
npm ci
npm run dev
```

Open http://localhost:3000 for the landing page or http://localhost:3000/dashboard for the demo. Local development works with synthetic inventory, guided brief extraction, unscored search, and negotiation planning without provider credentials. The development launcher supplies a temporary session secret.

Inject secrets through 1Password or the host's environment settings. [.env.example](.env.example) lists variable names only.

| Variable | Purpose |
| --- | --- |
| `APP_SECRET`, `DEMO_ACCESS_CODE` | Required for production sessions and team access |
| `APP_ORIGIN` | Exact public dashboard origin, such as `https://your-service.up.railway.app`, for request-origin validation |
| `TYPESAFE_API_KEY` | Live Jev ranking |
| `AI_GATEWAY_API_KEY`, optional `CLARIFY_MODEL` | Model-assisted brief extraction; guided/manual entry remains available |
| `CATALOG_API_URL`, optional `CATALOG_API_KEY` | Chris's inventory export |
| `DARA_API_URL`, optional `DARA_API_KEY` | Dara's job submission and polling |
| `OUTBOUND_CONTACT_ENABLED` | Defaults to false; live contact also requires buyer approval and active live listings |
| `INTEGRATION_API_KEY` | Optional bearer access for trusted integration clients |
| `EVE_AGENT_URL`, `EVE_API_KEY` | Dashboard server access to the protected Eve activity feed; never sent to the browser |

```sh
npm test
npm run typecheck
npm run build
npm start
```

Regenerate the deterministic import dataset with `npm run seed:catalog`. It writes [data/catalog.json](data/catalog.json), not a database. [railway.toml](railway.toml) is a reference: Railway config-as-code is not active for this service. The remote service settings use `npm run build`, `npm start`, and `/api/v1/health`. The verified deployment was requested with an explicit commit SHA through `serviceInstanceDeploy`; branch-based auto-deploy remains unverified.

## Integration map

- **Chris:** catalog consolidation and the Eve/Photon integration. The agent implementation is in [eve-agent/](eve-agent/README.md). [Catalog contract](docs/catalog-integration.md) and [Eve API handoff](docs/eve-integration.md).
- **Dara:** implemented selected-car intelligence rules; seller contact and quote collection remain pending. [Intelligence port and simulation](docs/dara-integration.md), [live optimization contract](docs/optimization-integration.md).
- **Ben:** dashboard, clarification, hard filters, Jev ranking, integration, and deployment.
- **WhatsApp:** team coordination. **Buyer messaging:** Photon → Eve on Vercel → this API on Railway. Portable Photon credentials and the webhook signing secret connect `/eve/v1/photon`. The live dashboard Activity tab reads the selected Eve conversation through a protected server proxy. A real iMessage reply and matching Activity records are verified.

[BUILD-SPEC.md](BUILD-SPEC.md) describes the implemented architecture, routes, contracts, and remaining work. Runtime contracts live in [lib/contracts.ts](lib/contracts.ts). Files under `examples/` preserve the earlier design fixtures and are not the current HTTP request shapes.

## Known gaps

- Inventory is synthetic until Chris's API is connected. The 30-candidate scoring cap is explicit; ranking does not evaluate the entire eligible pool.
- This API has no application database, durable seller-job queue, scheduled follow-up, or persistent approval ledger. Eve stores conversation state and events in its existing durable workflow runtime; Activity adds no database. The shared bearer credential still does not provide backend per-buyer authentication.
- Dara's live adapter still needs an endpoint with durable job storage and idempotency. Local intelligence makes no network calls. Synthetic-only scenarios assume offers at 92%, counters at 98%, and settlement at 95% of asking; these are demo rules, not real quotes, market valuations, or predicted seller behavior. Actual target prices and provider quotes remain empty.
- Browserbase ingestion, seller contact, and provider quote delivery remain unverified. Photon send-and-reply transport is verified for the tested registered sender.
- Asking price does not prove an out-the-door budget. History, battery condition, availability, fees, and seller claims require verification.
- No purchase, payment, deposit, financing, signature, or title-transfer action exists. Final choice and JSON export are a handoff only.
