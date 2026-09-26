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

Inject values from 1Password into the server environment. `.env.example` contains names only. `JEVGOTIATOR_API_URL` points to the Railway API; `JEVGOTIATOR_API_KEY` must match its `INTEGRATION_API_KEY`. The agent model is `openai/gpt-4.1-mini` through AI Gateway, authenticated by Vercel OIDC on Vercel or `AI_GATEWAY_API_KEY` locally.

Photon supports either `PHOTON_CONNECTOR_ID` for Vercel Connect or portable `IMESSAGE_PROJECT_ID`, `IMESSAGE_PROJECT_SECRET`, and `IMESSAGE_WEBHOOK_SECRET`. Keep the connector ID returned by provisioning. The route is `/eve/v1/photon`; the portable webhook must have its signing secret. Vercel Connect uses the framework's same-project OIDC verifier by default. HTTP conversation routes retain the generated fail-closed authentication policy.

The official provisioning command is `npm exec -- eve add channel/photon-imessage`. Provisioning and deployment are separate operator actions; the channel source already exists here, so review any overwrite prompt and preserve the environment-based credential loader. Do not run setup just to compile the agent.

## Known gaps

The agent package can be built without provisioning Photon. A build does not verify the line, webhook delivery, model credentials, or a successful iMessage reply. Live channel testing remains necessary.

Railway currently uses a shared integration owner. Eve's state isolates the last result by conversation, but the backend does not provide per-buyer authentication for that bearer key. Search tokens expire after one hour. The agent keeps only the latest shortlist and requires a new search after expiry. Current bundled listings are synthetic; a live Jev response does not make them real inventory.

Tests cover position-to-listing mapping, private-token omission, expiry and invalid selections, and the client-side ban on contact dispatch. They do not substitute for two live Photon conversations with separate durable state.

Local verification: TypeScript and three tests passed; `eve info` reported zero diagnostics and exactly the three authored tools. `eve build --skip-sandbox-prewarm` compiled a Node-host output that returned HTTP 200 on `/eve/v1/health` and HTTP 401 for unauthenticated session creation. The temporary server was stopped. Sandbox preparation was skipped, so run the normal fresh Vercel build for deployment instead of uploading this local output.

Framework references: [tools](https://eve.dev/docs/tools), [durable state](https://eve.dev/docs/concepts/state), [Photon](https://eve.dev/docs/channels/photon).
