import assert from "node:assert/strict";

const started = performance.now();
const base = new URL(process.env.SMOKE_BASE_URL || "http://localhost:3008");
const apiKey = process.env.SMOKE_API_KEY;
let cookie = "";
let step = "configuration";
const timings = {};
const query = "Tesla Model Y under $35000, under 70000 miles in San Francisco";

async function request(path, body, expectedStatus = 200) {
  const requestStarted = performance.now();
  const response = await fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json", Origin: base.origin }),
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(45_000),
    redirect: "error",
  });
  timings[step] = Math.round(performance.now() - requestStarted);
  assert.equal(response.status, expectedStatus, `${step}: expected HTTP ${expectedStatus}, received ${response.status}`);
  let data;
  try { data = await response.json(); } catch { throw new Error(`${step}: response was not JSON`); }
  return { response, data };
}

try {
  assert.ok(["http:", "https:"].includes(base.protocol) && !base.username && !base.password && !base.search && !base.hash,
    "SMOKE_BASE_URL must be an HTTP(S) URL without embedded credentials, a query, or a fragment");

  step = "health";
  const { data: health } = await request("/api/v1/health");
  assert.equal(health.service, "JEVgotiator", "Unexpected service name");

  if (!apiKey) {
    step = "session";
    const { response, data } = await request("/api/session", { code: process.env.SMOKE_DEMO_CODE || "" });
    assert.equal(data.authenticated, true, "Demo session was not authenticated");
    const sessionCookie = response.headers.getSetCookie().find((value) => value.startsWith("jvg_session="));
    assert.ok(sessionCookie, "Demo session cookie was not returned");
    cookie = sessionCookie.split(";", 1)[0];
  }

  step = "clarify";
  const { data: clarification } = await request("/api/v1/clarify", { text: query });
  assert.ok(["guided", "live_model"].includes(clarification.mode), "Unexpected clarification mode");
  assert.equal(clarification.draft?.model, "Model Y", "Clarification did not extract Model Y");
  assert.equal(clarification.draft?.budget, 35000, "Clarification did not extract the purchase budget");
  assert.equal(clarification.draft?.max_mileage, 70000, "Clarification did not extract the mileage limit");
  assert.ok(Array.isArray(clarification.questions), "Clarification questions were not returned");

  // This explicit confirmation prevents an extraction change from weakening the search assertions.
  const brief = {
    query,
    budget: 35000,
    budget_basis: "advertised_price",
    city: "San Francisco",
    min_year: null,
    max_mileage: 70000,
    make: "Tesla",
    model: "Model Y",
    body_type: "",
    fuel_type: "",
    color: "",
    clean_title: false,
    no_reported_accidents: false,
    needed_by: null,
    priority: "best_fit",
  };

  step = "search";
  const { data: search } = await request("/api/v1/search", { brief });
  assert.ok(typeof search.result_token === "string" && search.result_token.length > 20, "Search context token was not returned");
  assert.ok(Array.isArray(search.results), "Search results were not returned");
  assert.ok(Number.isInteger(search.counts?.eligible) && search.counts.eligible >= 0, "Missing eligible count");
  assert.equal(search.counts.shown, search.results.length, "Shown count differs from the result count");
  assert.equal(search.results.length, Math.min(5, search.counts.eligible), "Expected up to five eligible results");
  assert.ok(search.results.length >= 2, "This smoke test needs at least two matching cars to exercise the shortlist");
  if (search.catalog?.mode === "synthetic") {
    assert.equal(search.counts.total, 1000, "Synthetic catalog must contain 1,000 records");
    assert.ok(search.results.every((result) => result.listing?.mode === "synthetic"), "Synthetic catalog contains a result with another mode");
  }
  for (const { listing } of search.results) {
    assert.equal(listing.make, "Tesla", "A different make passed the Tesla filter");
    assert.equal(listing.model, "Model Y", "A different model passed the Model Y filter");
    assert.equal(listing.city, "San Francisco", "A car outside San Francisco passed the city filter");
    assert.ok(typeof listing.price === "number" && listing.price >= 0 && listing.price <= 35000, "A car violates the price limit");
    assert.ok(typeof listing.mileage === "number" && listing.mileage >= 0 && listing.mileage <= 70000, "A car violates the mileage limit");
    assert.equal(listing.status, "active", "An inactive listing passed the search filter");
  }
  if (process.env.SMOKE_REQUIRE_JEV === "true") {
    assert.equal(search.ranking?.mode, "live_jev", "Live Jev scoring was required but unavailable");
    assert.ok(search.ranking.input_tokens > 0, "Live Jev scoring returned no input token usage");
    assert.equal(search.counts.scored, search.counts.candidates, "Not every candidate was scored");
  }

  const selected = search.results.slice(0, 2).map((result) => result.listing);
  const selection = { result_token: search.result_token, listing_ids: selected.map((listing) => listing.id) };
  step = "plan";
  const { data: plan } = await request("/api/v1/optimize", { ...selection, action: "plan" });
  assert.equal(plan.mode, "planning", "Local planning unexpectedly entered live mode");
  assert.equal(plan.status, "ready", "Seller plan is not ready");
  assert.equal(plan.plans?.length, 2, "Expected plans for the two selected cars");
  assert.deepEqual(plan.quotes, [], "Planning must not invent seller quotes");
  assert.equal(plan.provider_job_id, null, "Planning must not create a provider job");
  assert.ok(plan.plans.every((item) => item.target_price === null), "Planning must not invent an approved target price");

  step = "invalid_selection";
  let invalidId = "smoke-id-outside-this-result-set";
  while (search.results.some((result) => result.listing.id === invalidId)) invalidId += "-invalid";
  const { data: invalidSelection } = await request("/api/v1/optimize", {
    result_token: search.result_token, listing_ids: [invalidId], action: "plan",
  }, 409);
  assert.ok(typeof invalidSelection.error === "string", "Invalid listing selection did not return an error");

  let contactGuard = "skipped_live_inventory";
  // Only synthetic records are eligible for this negative test. Never request contact for live cars.
  if (selected.every((listing) => listing.mode === "synthetic")) {
    step = "synthetic_contact_guard";
    const { data: contact } = await request("/api/v1/optimize", {
      ...selection, action: "contact", contact_approved: true,
    }, 409);
    assert.ok(typeof contact.error === "string", "Synthetic contact attempt did not return an error");
    assert.ok(/not enabled|synthetic|replay/i.test(contact.error), "Contact was not rejected by the expected pre-dispatch guard");
    assert.ok(!contact.provider_job_id && contact.may_have_contacted !== true, "Synthetic contact reached an uncertain provider dispatch");
    contactGuard = "rejected_before_dispatch";
  }

  console.log(JSON.stringify({
    ok: true,
    modes: { catalog: search.catalog.mode, clarification: clarification.mode, ranking: search.ranking.mode, optimization: plan.mode },
    counts: { ...search.counts, planned: plan.plans.length },
    contact_guard: contactGuard,
    input_tokens: search.ranking.input_tokens,
    estimated_cost_usd: search.ranking.estimated_cost_usd,
    timing_ms: { ...timings, jev: search.ranking.latency_ms, total: Math.round(performance.now() - started) },
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, step, reason: error instanceof Error ? error.message : "Smoke test failed" }));
  process.exitCode = 1;
}
