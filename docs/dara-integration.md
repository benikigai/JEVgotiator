# Dara intelligence and demo negotiation

`lib/dara-intelligence.ts` ports `mapListing` from `dara-sample/api/listings.js` and `scoreListing` from `dara-sample/app.js` at branch commit `163fa4787cb9151b76af917f643483ddb0f7f97e`. It evaluates only the buyer's selected cars after Jev produces its shortlist. It preserves the original Jev results.

Dara's original evidence trace uses value 26, evidence 23, road trip 18, model fit 8, and mileage/year/battery 25. The evidence composite weights photo coverage 55%, title records 25%, and the neutral battery baseline 20%. Price, mileage, model, year, photos, and title map from the canonical car contract. Missing VIN receives no credit. Unknown battery remains Dara's 50 baseline and is explicitly labeled unknown. All cars still require inspection.

The dashboard has a user-approved, static Dara profile lens. Its initial re-rank weights are value 21, well-kept evidence 28, road-trip readiness 16, personal lens 10, and the remaining vehicle evidence. The profile image and tags are bundled with the app from a public profile the buyer explicitly approved. It does not connect to Instagram, authenticate a social account, import posts at runtime, or make sensitive inferences. The buyer can change every weight, while the original Jev evidence trace remains available.

The branch contains a MarketCheck inventory adapter but no negotiation or contact implementation. This integration makes no MarketCheck request and adds no credential or dependency.

For selections consisting entirely of priced synthetic listings, the plan also contains a separate `synthetic_scenario`: opening offer at 92% of asking, assumed counter at 98%, assumed settlement at 95%. These are disclosed demo rules we added, not Dara's market valuation or predicted seller behavior. Candidate order follows Dara's intelligence score. Savings exclude taxes and fees; out-the-door budget fit remains unverified.

`target_price` stays null, actual quotes stay empty, and no provider job exists. Replay, live, mixed, or unpriced selections never receive simulated seller outcomes. Outbound contact remains behind the existing live-inventory and approval gates. Eve preserves both structured outputs and must explicitly label every scenario in its reply.

Run `npm test` and `npm run typecheck` in the root and `eve-agent` folders. Tests cover formula parity, numeric bounds, synthetic-only behavior, no network access, and preservation through the activity projection. Production verification requires new plan output after deployment; historical conversations are not rewritten.
