import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { type Brief, type Car } from "../lib/contracts";
import { createOptimization, dispatchOptimization, getOptimizationStatus, OptimizationDispatchError } from "../lib/optimization";

const originalFetch = globalThis.fetch;
let originalEnv: Record<string, string | undefined>;
beforeEach(() => {
  originalEnv = Object.fromEntries(["DARA_API_URL", "DARA_API_KEY", "OUTBOUND_CONTACT_ENABLED"].map((key) => [key, process.env[key]]));
  process.env.DARA_API_URL = "https://dara.example/jobs";
  process.env.DARA_API_KEY = "test-not-a-secret";
  process.env.OUTBOUND_CONTACT_ENABLED = "false";
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

const brief: Brief = {
  query: "Tesla in San Francisco under $30,000", budget: 30000, budget_basis: "advertised_price",
  city: "San Francisco", min_year: 2020, max_mileage: 60000, make: "Tesla", body_type: "",
  fuel_type: "electric", color: "", clean_title: true, no_reported_accidents: true,
  needed_by: "2026-10-10", priority: "best_fit",
};
const car: Car = {
  id: "tesla-1", make: "Tesla", model: "Model 3", year: 2022, trim: "Long Range",
  price: 27500, mileage: 40000, exterior_color: "Black", body_type: "sedan", fuel_type: "electric",
  city: "San Francisco", photos: [], description: "Dealer listing", accident_history: null,
  maintenance_history: null, title_status: "unknown", seller: { id: "seller-1", name: "Example dealer", type: "dealer", contact_available: true },
  source: "chris_api", listing_url: "https://example.com/tesla-1", observed_at: "2026-09-26T12:00:00Z",
  status: "active", available_from: null, mode: "live",
};

test("planning is deterministic and makes no claims of contact, discounts, or offers", () => {
  globalThis.fetch = async () => { throw new Error("Planning must not call a provider"); };
  const result = createOptimization([car], brief);
  assert.deepEqual(result, createOptimization([car], brief));
  assert.equal(result.mode, "planning");
  assert.equal(result.status, "ready");
  assert.equal(result.plans[0].target_price, null);
  assert.deepEqual(result.quotes, []);
  assert.match(result.summary, /No seller contact has occurred/);
  assert.match(result.plans[0].questions.join(" "), /VIN.*accident.*service.*battery.*out-the-door.*inspection/i);
  assert.equal(result.events.find((event) => event.label === "Seller contact")?.state, "pending");
});

test("disabled dispatch never makes a request", async () => {
  globalThis.fetch = async () => { throw new Error("Should not dispatch"); };
  await assert.rejects(dispatchOptimization([car], brief, "request-1"), (error) => error instanceof OptimizationDispatchError && error.code === "disabled");
});

test("sample, inactive, duplicate, and oversized selections cannot dispatch", async () => {
  process.env.OUTBOUND_CONTACT_ENABLED = "true";
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Should not dispatch"); };
  for (const cars of [[{ ...car, mode: "synthetic" as const }], [{ ...car, status: "sold" as const }], [car, car], [1, 2, 3, 4].map((id) => ({ ...car, id: String(id) }))]) {
    await assert.rejects(dispatchOptimization(cars, brief, "request-1"), (error) => error instanceof OptimizationDispatchError && error.code === "invalid_request");
  }
  assert.equal(calls, 0);
});

test("dispatch sends the approved scope, exact endpoint, safe listing, and stable idempotency key", async () => {
  process.env.OUTBOUND_CONTACT_ENABLED = "true";
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://dara.example/jobs");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "request-1");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-not-a-secret");
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.authorization, { scope: "availability_and_nonbinding_negotiation", purchase: false });
    assert.equal(body.request_id, "request-1");
    assert.equal(body.listings[0].private_phone, undefined);
    assert.equal(body.listings[0].seller.secret, undefined);
    return Response.json({ job_id: "dara-job-1", status: "queued" });
  };
  const enriched = { ...car, private_phone: "private", seller: { ...car.seller, secret: "private" } };
  const result = await dispatchOptimization([enriched], brief, "request-1");
  assert.equal(calls, 1);
  assert.equal(result.provider_job_id, "dara-job-1");
  assert.equal(result.mode, "live");
  assert.equal(result.status, "pending");
  assert.deepEqual(result.quotes, []);
  assert.match(result.summary, /API reports/);
});

test("network failure is uncertain and never retried or replaced with a planner result", async () => {
  process.env.OUTBOUND_CONTACT_ENABLED = "true";
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new DOMException("Timed out", "TimeoutError"); };
  await assert.rejects(dispatchOptimization([car], brief, "request-uncertain"), (error) => {
    assert.ok(error instanceof OptimizationDispatchError);
    assert.equal(error.code, "uncertain");
    assert.equal(error.may_have_contacted, true);
    assert.equal(error.request_id, "request-uncertain");
    return true;
  });
  assert.equal(calls, 1);
});

test("invalid success payload and unrelated quotes are uncertain", async () => {
  process.env.OUTBOUND_CONTACT_ENABLED = "true";
  for (const response of [
    { status: "completed" },
    { job_id: "job-1", status: "completed", quotes: [{ listing_id: "not-selected", seller: "Other", price: 100, terms: "Cash" }] },
  ]) {
    globalThis.fetch = async () => Response.json(response);
    await assert.rejects(dispatchOptimization([car], brief, "request-1"), (error) => error instanceof OptimizationDispatchError && error.code === "uncertain");
  }
});

test("status reads work with outbound disabled and require the requested job ID", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://dara.example/jobs/job%2F1");
    assert.equal(init?.method, "GET");
    return Response.json({ job_id: "job/1", status: "completed", quotes: [{ listing_id: car.id, seller: "Example dealer", price: 27000, total: null, terms: "Awaiting fees", evidence: null }] });
  };
  const result = await getOptimizationStatus("job/1");
  assert.equal(result.status, "completed");
  assert.match(result.warning ?? "", /no supporting evidence/);
  globalThis.fetch = async () => Response.json({ job_id: "another-job", status: "completed" });
  await assert.rejects(getOptimizationStatus("job/1"), (error) => error instanceof OptimizationDispatchError && error.code === "unavailable");
});

test("synthetic negotiation uses bounded deterministic assumptions without any outbound calls", () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("No scenario may contact a provider"); };
  const selected = [{ ...car, mode: "synthetic" as const }, { ...car, id: "tesla-2", price: 23000, mode: "synthetic" as const }];
  const result = createOptimization(selected, { ...brief, budget_basis: "out_the_door" });
  assert.deepEqual(result, createOptimization(selected, { ...brief, budget_basis: "out_the_door" }));
  assert.equal(result.simulation?.mode, "synthetic_scenario");
  for (const candidate of result.simulation!.candidates) {
    assert.ok(candidate.opening_offer <= candidate.simulated_agreed_price);
    assert.ok(candidate.simulated_agreed_price <= candidate.simulated_counter);
    assert.ok(candidate.simulated_counter <= candidate.asking_price);
    assert.equal(candidate.simulated_savings, Math.round((candidate.asking_price - candidate.simulated_agreed_price) * 100) / 100);
  }
  assert.equal(result.simulation!.candidates[0].listing_id, result.intelligence!.candidates[0].listing_id);
  assert.match(result.simulation!.disclaimer, /SIMULATION ONLY/);
  assert.match(result.simulation!.assumptions.join(" "), /out-the-door.*Taxes.*unknown/);
  assert.ok(result.plans.every((plan) => plan.target_price === null));
  assert.deepEqual(result.quotes, []);
  assert.equal(result.provider_job_id, null);
  assert.equal(calls, 0);
});

test("live, replay, mixed, and unpriced selections never receive simulated seller outcomes", () => {
  for (const cars of [[car], [{ ...car, mode: "replay" as const }], [car, { ...car, id: "synthetic-1", mode: "synthetic" as const }], [{ ...car, mode: "synthetic" as const, price: null }]]) {
    assert.equal(createOptimization(cars, brief).simulation, undefined);
  }
});

test("selected-car intelligence ports Dara's exact formula with missing evidence disclosed", () => {
  const result = createOptimization([car], brief);
  assert.equal(result.intelligence!.source, "dara-sample");
  assert.equal(result.intelligence!.source_commit, "163fa4787cb9151b76af917f643483ddb0f7f97e");
  assert.equal(result.intelligence!.candidates[0].score, 70);
  assert.equal(result.intelligence!.candidates[0].signals.evidence, 30.5);
  assert.match(result.intelligence!.candidates[0].unknowns.join(" "), /Battery condition is unknown.*VIN is absent/);
  assert.equal(result.simulation, undefined);
});
