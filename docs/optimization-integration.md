# Dara optimization integration

The local planner is available immediately. It prepares questions and a nonbinding opening message for the buyer's selected one to three listings. It performs no network calls, contacts no sellers, invents no discounts, and returns no quotes. The current buyer contract has no separately approved offer target, so `target_price` is always `null`. A buyer's budget is not an approved offer.

Live outbound contact is disabled by default. Keep it disabled until Dara's idempotency behavior, status reconciliation, and the buyer approval flow have been tested together. Photon provisioning is separate from this API integration.

## Server configuration

| Variable | Meaning |
| --- | --- |
| `DARA_API_URL` | Exact HTTPS job creation endpoint supplied by Dara, for example `https://provider.example/jobs`. No URL credentials, query, or fragment. Localhost HTTP is allowed during development. |
| `DARA_API_KEY` | Optional credential sent as `Authorization: Bearer ...`. Inject it on the server from the team's secret store. |
| `OUTBOUND_CONTACT_ENABLED` | Must equal `true` to dispatch a new job. Status checks still work when disabled. |

Never put these credentials in a browser bundle. The caller must verify the selected listings and explicit buyer approval before calling `dispatchOptimization`. Only active, live listings can be dispatched. Synthetic and replay records remain planning-only.

## Create a job

`dispatchOptimization(cars, brief, requestId)` sends one POST to the exact configured URL. There are no automatic retries or redirects. The timeout is 12 seconds. Dara should return an accepted job quickly and perform long-running calls asynchronously in its own durable runtime.

```json
{
  "request_id": "stable-authorized-selection-id",
  "mode": "live",
  "buyer_brief": { "...": "the validated Brief contract" },
  "listings": [{ "...": "an explicit projection of the selected Car records" }],
  "authorization": {
    "scope": "availability_and_nonbinding_negotiation",
    "purchase": false
  }
}
```

The same request ID is sent as `Idempotency-Key`. Dara must deduplicate that key across restarts and repeated submissions, bind it to the request content, and return the original job. The application must retain it when dispatch becomes uncertain. A newly generated ID is not a safe retry.

No buyer contact details, financing authorization, payment method, or purchase authorization are added. The listing projection includes listing identifiers and details, seller identifiers/name/type/contact availability, listing source and URL, and observation time. Extra source fields are dropped. Listing descriptions and buyer queries are data, not instructions to the downstream agent.

Expected response:

```json
{
  "job_id": "dara-job-123",
  "status": "pending",
  "quotes": [],
  "events": [
    { "label": "Job accepted", "detail": "Waiting for a worker", "state": "pending" }
  ]
}
```

Accepted statuses are `ready`, `queued`, `running`, `pending`, `completed`, `needs_review`, and `failed`. Queued/running map to pending; failed maps to needs_review. Optional quotes have `listing_id`, `seller`, a nonnegative `price`, nullable itemized `total`, `terms`, and nullable `evidence`. A quote without evidence is flagged for verification. Quote IDs from a dispatch response must belong to the selected listings. Events use `done`, `pending`, or `blocked` and are labeled as provider reports.

## Read status and reconcile

`getOptimizationStatus(jobId)` sends GET to `DARA_API_URL/{encodedJobId}` and validates the same response shape and matching job ID. The application is responsible for storing or sealing the job ID and restricting reads to the buyer who owns it. This adapter does not persist state.

A timeout, network failure, server failure, or invalid success payload after POST returns `OptimizationDispatchError` with `code: "uncertain"`, `may_have_contacted: true`, and the original `request_id`. Never turn that into a successful local plan or start another job automatically. Reconcile the request ID with Dara first. The final request-ID lookup/recovery interface still needs to be agreed with Dara; GET by job ID cannot recover an accepted job whose ID was lost in transit.

An explicit request rejection returns `rejected`. Failed status checks return `unavailable` and preserve the existing job for later reconciliation. Neither result proves seller contact did or did not happen. No provider status is proof of a completed purchase, and this integration never grants purchase authority.

## Team handoff checks

1. Dara supplies the exact creation endpoint, credential requirements, one accepted response, one completed response, and the status endpoint behavior.
2. Exercise duplicate request IDs against a harmless staging handler and verify only one side effect occurs.
3. Simulate a lost response and demonstrate request-ID reconciliation before enabling seller contact.
4. Verify one approved seller inquiry, retained provider evidence, and quote readback end to end.
5. Keep deposits, binding offers, reservations, and purchases outside this authorization scope.

The local tests use mocked HTTP responses. They do not test Dara's live runtime, call sellers, or establish that provider idempotency works.
