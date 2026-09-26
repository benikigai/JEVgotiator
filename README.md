# JEVgotiator

A Tesla buying dashboard for San Francisco. Describe what you need, confirm the structured brief, filter the inventory, rank up to 30 candidates with Jev, and select one to three cars for a negotiation plan.

The Next.js 16 app includes the dashboard and API. It ships with 1,000 clearly labeled synthetic Teslas. Live catalog and optimization adapters are implemented but require Chris's and Dara's endpoints. Jev runs when its server credential is configured; otherwise results are explicitly unscored. The [Eve agent](eve-agent/README.md) implements the Photon buyer conversation and calls the same API.

Open [jevgotiator.vercel.app](https://jevgotiator.vercel.app), the canonical public dashboard. Vercel and [Railway](https://jevgotiator-production.up.railway.app) each host the dashboard and API. Last verified revision: `ecfd8ca`. Both passed model clarification, live Jev scoring, and local planning: 1,000 records → 82 eligible → 30 scored → five shown → two selected plans. Vercel root/health requests returned HTTP 200, and team login and origin validation passed. Seller contact is disabled; Railway also rejected synthetic contact dispatch. These are test-query results, not real inventory or seller outreach. Use the short Vercel domain; the long team alias requires Vercel SSO.

Eve production revision `4211660` passed a real three-turn HTTP operator test: model clarification → five search results → a plan for option one. Health and authenticated operator requests returned HTTP 200; unauthenticated session creation returned 401, and an unsigned Photon request returned 400 for a missing signature. This is HTTP operator evidence, not an iMessage test.

The next demo starts with an iMessage to **+1 (415) 605-7073** from a Photon-registered personal sender. Eve clarifies the request, asks for confirmation, searches Railway, and prepares a plan after the buyer picks one to three cars. The staged **Activity** tab polls durable Eve records every three seconds and shows that conversation's messages, tool calls, shortlist, and Jev trace. The Photon webhook is created and its signing secret stored; Activity deployment verification and an actual received iMessage reply are still pending. Follow the [two-minute walkthrough](docs/demo-walkthrough.md). Personal sender numbers and credentials do not belong in this repository.

## Run

Use Node.js 22 or 24.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Local development works with synthetic inventory, guided brief extraction, unscored search, and negotiation planning without provider credentials. The development launcher supplies a temporary session secret.

Inject secrets through the vault or the host's environment settings. [.env.example](.env.example) lists variable names only.

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
- **Dara:** optimization, seller contact, and quote collection. [Optimization contract](docs/optimization-integration.md).
- **Ben:** dashboard, clarification, hard filters, Jev ranking, integration, and deployment.
- **WhatsApp:** team coordination. **Buyer messaging:** Photon → Eve on Vercel → this API on Railway. Portable Photon credentials and the webhook signing secret connect `/eve/v1/photon`. The staged dashboard Activity tab reads the selected Eve conversation through a protected server proxy. An actual iMessage round trip remains unverified.

[BUILD-SPEC.md](BUILD-SPEC.md) describes the implemented architecture, routes, contracts, and remaining work. Runtime contracts live in [lib/contracts.ts](lib/contracts.ts). Files under `examples/` preserve the earlier design fixtures and are not the current HTTP request shapes.

## Known gaps

- Inventory is synthetic until Chris's API is connected. The 30-candidate scoring cap is explicit; ranking does not evaluate the entire eligible pool.
- This API has no application database, durable seller-job queue, scheduled follow-up, or persistent approval ledger. Eve stores conversation state and events in its existing durable workflow runtime; Activity adds no database. The shared bearer credential still does not provide backend per-buyer authentication.
- Dara's adapter needs a verified endpoint with durable job storage and idempotency. Local planning makes no calls and invents no negotiated prices.
- Photon, Browserbase ingestion, seller contact, and provider quote delivery are not established as working integrations by configuration alone.
- Asking price does not prove an out-the-door budget. History, battery condition, availability, fees, and seller claims require verification.
- No purchase, payment, deposit, financing, signature, or title-transfer action exists. Final choice and JSON export are a handoff only.
