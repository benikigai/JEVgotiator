# JEVgotiator Eve agent

An Eve 0.67.1 agent with Photon iMessage and three tools: clarify a buyer brief, search the Railway API, and prepare a plan for selected cars. Result tokens stay in Eve's durable per-session state and never appear in tool output. Optional shell, filesystem, web, and delegation tools are disabled. There is no seller-contact or purchase tool.

## Run

Requires Node.js 24. This is an independent package; install and run from `eve-agent/`.

```sh
npm ci
npm test
npm run typecheck
npm run dev
```

For an HTTP development server without the terminal UI, use `npm exec -- eve dev --no-ui`. Production build/start commands are `npm run build` and `npm start`. Set the Vercel project's root directory to `eve-agent` when deploying separately from the Railway dashboard.

Inject values from the vault into the server environment. `.env.example` contains names only. `JEVGOTIATOR_API_URL` points to the Railway API; `JEVGOTIATOR_API_KEY` must match its `INTEGRATION_API_KEY`. The agent model is `openai/gpt-4.1-mini` through AI Gateway, authenticated by Vercel OIDC on Vercel or `AI_GATEWAY_API_KEY` locally.

Photon supports either `PHOTON_CONNECTOR_ID` for Vercel Connect or portable `IMESSAGE_PROJECT_ID`, `IMESSAGE_PROJECT_SECRET`, and `IMESSAGE_WEBHOOK_SECRET`. Keep the connector ID returned by provisioning. The route is `/eve/v1/photon`; the portable webhook must have its signing secret. Vercel Connect uses the framework's same-project OIDC verifier by default. HTTP conversation routes accept a server-held `EVE_API_KEY` for operator testing, same-project Vercel OIDC, or local development authentication. They reject unauthenticated production requests. The operator key is separate from the Railway integration key and is not a buyer identity.

The official provisioning command is `npm exec -- eve add channel/photon-imessage`. Provisioning and deployment are separate operator actions; the channel source already exists here, so review any overwrite prompt and preserve the environment-based credential loader. Do not run setup just to compile the agent.

## Known gaps

The agent is deployed at [jevgotiator-agent.vercel.app](https://jevgotiator-agent.vercel.app). The existing Photon project has a signed webhook registered at `/eve/v1/photon`. A user-sent iMessage and observed reply are still needed to verify the transport end to end.

Railway currently uses a shared integration owner. Eve's state isolates the last result by conversation, but the backend does not provide per-buyer authentication for that bearer key. Search tokens expire after one hour. The agent keeps only the latest shortlist and requires a new search after expiry. Current bundled listings are synthetic; a live Jev response does not make them real inventory.

Tests cover position-to-listing mapping, private-token omission, expiry and invalid selections, and the client-side ban on contact dispatch. They do not substitute for two live Photon conversations with separate durable state.

Verification on September 26, 2026: TypeScript and four tests passed. A normal Vercel Node.js 24 build succeeded. Production health returned 200, unauthenticated session creation returned 401, and an unsigned Photon request returned 400 with `missing signature headers`. An authenticated operator conversation completed clarification, API search, and option-to-plan selection through the live model. It returned five synthetic Model 3 listings and a plan without contacting a seller. This verifies the model and API path, not iMessage delivery or separate Photon conversations.

Framework references: [tools](https://eve.dev/docs/tools), [durable state](https://eve.dev/docs/concepts/state), [Photon](https://eve.dev/docs/channels/photon).
