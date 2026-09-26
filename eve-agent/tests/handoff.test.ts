import test from "node:test";
import assert from "node:assert/strict";
import { planRequest, publicSearch, searchResponseSchema, type SearchSnapshot } from "../agent/lib/contracts";
import { callApi } from "../agent/lib/api";

function snapshot(id: string): SearchSnapshot {
  return {
    session_id: id, result_token: `private-token-${id}`, created_at: new Date().toISOString(),
    brief: { query: "A Tesla in San Francisco", budget: 30000, budget_basis: "advertised_price", city: "San Francisco", make: "Tesla", model: "", min_year: null, max_mileage: null, body_type: "", fuel_type: "", color: "", clean_title: false, no_reported_accidents: false, needed_by: null, priority: "best_fit" },
    results: [1, 2].map((i) => ({ listing: { id: `${id}-${i}`, make: "Tesla", model: "Model 3", year: 2020, price: 20000, mileage: 50000, exterior_color: "white", city: "San Francisco", mode: "synthetic", listing_url: null }, score: null, reasons: [], unknowns: [], verification_required: true })),
    counts: { total: 1000, eligible: 100, candidates: 30, scored: 0, shown: 2 },
    ranking: { mode: "unscored_fallback", model: null, warning: "No AI score", latency_ms: 1, estimated_cost_usd: 0 },
    catalog: { mode: "synthetic", warnings: ["Synthetic inventory"] },
  };
}

test("positions resolve from the supplied conversation snapshot without token leakage", () => {
  const alice = snapshot("alice"), bob = snapshot("bob");
  assert.deepEqual(planRequest(alice, [1]).listing_ids, ["alice-1"]);
  assert.deepEqual(planRequest(bob, [1]).listing_ids, ["bob-1"]);
  assert.equal(planRequest(alice, [2]).action, "plan");
  assert.doesNotMatch(JSON.stringify(publicSearch(alice)), /private-token|result_token/);
});
test("missing, expired, duplicated, and out-of-range selections fail closed", () => {
  assert.throws(() => planRequest(null, [1]), /missing or expired/);
  assert.throws(() => planRequest({ ...snapshot("old"), created_at: "2020-01-01T00:00:00.000Z" }, [1]), /expired/);
  assert.throws(() => planRequest(snapshot("a"), [1, 1]), /distinct/);
  assert.throws(() => planRequest(snapshot("a"), [3]), /not in this conversation/);
});
test("the public search retains Jev evidence while stripping unrecognized credential fields", () => {
  const data = snapshot("trace");
  const parsed = searchResponseSchema.parse({ ...data, ranking: { ...data.ranking, input_tokens: 123, trace: {
    outcome: "not_requested", request_sent: false, requested_model: "jev", returned_model: null,
    buyer_request: "Tesla under 30k", hard_filter_role: "deterministic", algorithm: "weighted", note: "No request",
    candidates: [], questions: [], answers: [], composition: [], api_key: "must-not-pass",
  } } });
  const output = publicSearch(parsed);
  assert.equal(output.ranking.input_tokens, 123);
  assert.equal(output.ranking.trace?.outcome, "not_requested");
  assert.doesNotMatch(JSON.stringify(output), /must-not-pass|api_key|private-token|result_token/);
});
test("the API client refuses contact dispatch and never follows redirects with credentials", async () => {
  const priorUrl = process.env.JEVGOTIATOR_API_URL, priorKey = process.env.JEVGOTIATOR_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.JEVGOTIATOR_API_URL = "https://buying.example.net";
  process.env.JEVGOTIATOR_API_KEY = "test-credential";
  let calls = 0;
  globalThis.fetch = async (_url, init) => { calls++; assert.equal(init?.redirect, "error"); assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-credential"); return Response.json({ mode: "planning" }); };
  try {
    await assert.rejects(callApi("optimize", { action: "contact" }), /planning only/);
    assert.equal(calls, 0);
    assert.deepEqual(await callApi("optimize", { action: "plan" }), { mode: "planning" });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (priorUrl === undefined) delete process.env.JEVGOTIATOR_API_URL; else process.env.JEVGOTIATOR_API_URL = priorUrl;
    if (priorKey === undefined) delete process.env.JEVGOTIATOR_API_KEY; else process.env.JEVGOTIATOR_API_KEY = priorKey;
  }
});
