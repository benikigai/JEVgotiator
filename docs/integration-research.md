# Integration research

Checked September 26, 2026. This is documentation evidence, not proof that JEVgotiator's integrations are configured.

| Provider | Verified documentation | Design implication |
| --- | --- | --- |
| [TypeSafe API](https://docs.typesafe.ai/api) | Evaluates state with typed questions; returns answers, served model and usage. Question keys are not sent to inference. | Put the actual criterion and candidate reference in instructions/state; retain usage and model. |
| [TypeSafe introduction](https://docs.typesafe.ai/introduction) | Choice, Score and Noul decisions rather than generated prose. | Use a conversational model for clarification and templates/evidence for ranked-card explanations. |
| [TypeSafe models](https://docs.typesafe.ai/models) | Versioned Jev models and model-specific pricing. | Start with the already smoke-tested `jev-1.13.0`; pin during evaluation. |
| [Vercel Workflows](https://vercel.com/docs/workflows) | Persisted steps, retries, event waits and recovery. | Suitable proposed host for negotiation and follow-up jobs. External effects still require application idempotency. |
| [Photon managed iMessage](https://photon.codes/docs/spectrum-ts/providers/imessage) | Spectrum supports managed lines; transport requires Node.js/Bun compatible gRPC. | Use a Node API adapter. Do not assume an Edge runtime or local Mac library will deploy unchanged. |
| [Photon webhooks](https://photon.codes/docs/spectrum-ts/webhooks) | HMAC-SHA256 verification, timestamp replay window, at-least-once delivery and message-ID deduplication. Convenience callback runs after HTTP response. | Preserve raw body; ensure persistence and dispatch before acknowledgment or verify a supported lifecycle adapter. |
| [Photon Spectrum repository](https://github.com/photon-hq/spectrum-ts) | Conversation send/reply methods. | Wrap sending behind a channel adapter and retain returned provider receipts. |
| [Browserbase Jev article](https://www.browserbase.com/blog/what-is-jev) | Describes Jev classifying actions, choosing candidates, and falling back to an LLM. Links a prototype PR stack. | Browser action selection and car relevance scoring are separate uses. Pin and test the team's prototype. |
| [Stagehand prototype PR](https://github.com/browserbase/stagehand/pull/2993/files) | Referenced implementation work; not proof of the team's installed version. | Do not declare native support production-ready from the article alone. |

The team reports an existing Facebook Marketplace scraping prototype. Its URL, revision, access method, output and live behavior were not supplied or tested in this review.

Earlier checks in the current planning session verified a real TypeSafe request and Vercel account access. They did not deploy this repo or test its end-to-end search, calls, Photon delivery, or purchase flow.

Architecture review identified the main integration risks: unknown history treated as clean; advertised prices mistaken for final totals; stale selections; duplicate external actions after retries; and chat messages bypassing explicit approval. The initial specification includes checks for each.
