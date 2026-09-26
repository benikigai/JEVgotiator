# JEVgotiator

A Tesla buying dashboard for San Francisco. Describe what you need, confirm the structured brief, filter the inventory, rank up to 30 candidates with Jev, and select one to three cars for a negotiation plan.

The Next.js 16 app includes the dashboard and API. It ships with 1,000 clearly labeled synthetic Teslas. Live catalog and optimization adapters are implemented but require Chris's and Dara's endpoints. Jev runs when its server credential is configured; otherwise results are explicitly unscored. Railway hosts the planned dashboard and API deployment; configuration is ready and deployment verification is pending.

## Run

Use Node.js 22 or 24.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Local development works with synthetic inventory, guided brief extraction, unscored search, and negotiation planning without provider credentials. The development launcher supplies a temporary session secret.

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

```sh
npm test
npm run typecheck
npm run build
npm start
```

Regenerate the deterministic import dataset with `npm run seed:catalog`. It writes [data/catalog.json](data/catalog.json), not a database. [railway.toml](railway.toml) defines the production build, start command, and health endpoint.

## Integration map

- **Chris:** catalog consolidation and source freshness. [Catalog contract](docs/catalog-integration.md).
- **Dara:** optimization, seller contact, and quote collection. [Optimization contract](docs/optimization-integration.md).
- **Ben:** dashboard, clarification, hard filters, Jev ranking, integration, and deployment.
- **WhatsApp:** team coordination. **Photon:** planned buyer messaging; team number and webhook integration are pending.

[BUILD-SPEC.md](BUILD-SPEC.md) describes the implemented architecture, routes, contracts, and remaining work. Runtime contracts live in [lib/contracts.ts](lib/contracts.ts). Files under `examples/` preserve the earlier design fixtures and are not the current HTTP request shapes.

## Known gaps

- Inventory is synthetic until Chris's API is connected. The 30-candidate scoring cap is explicit; ranking does not evaluate the entire eligible pool.
- There is no database, durable job queue, scheduled follow-up, or persistent approval ledger. Searches use session-bound encrypted result tokens and browser session storage.
- Dara's adapter needs a verified endpoint with durable job storage and idempotency. Local planning makes no calls and invents no negotiated prices.
- Photon, Browserbase ingestion, seller contact, and provider quote delivery are not established as working integrations by configuration alone.
- Asking price does not prove an out-the-door budget. History, battery condition, availability, fees, and seller claims require verification.
- No purchase, payment, deposit, financing, signature, or title-transfer action exists. Final choice and JSON export are a handoff only.
