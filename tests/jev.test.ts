import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { rankCars } from "../lib/jev";
import type { Brief, Car } from "../lib/contracts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.TYPESAFE_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = originalKey;
});

const brief: Brief = {
  query: "An efficient commuter car with documented maintenance.", budget: 30000,
  budget_basis: "advertised_price", city: "San Francisco", min_year: 2015,
  max_mileage: 100000, make: "Tesla", body_type: "", fuel_type: "", color: "",
  clean_title: false, no_reported_accidents: false, needed_by: null, priority: "best_fit",
};

function car(id: string, price: number, maintenance: string | null = "Oil changed at 45,000 miles; service receipts available."): Car {
  return {
    id, make: "Toyota", model: "Prius", year: 2019, trim: null, price, mileage: 50000,
    exterior_color: "black", body_type: "hatchback", fuel_type: "hybrid", city: "San Francisco",
    photos: [], description: "Hybrid commuter hatchback with service receipts.",
    accident_history: null, maintenance_history: maintenance, title_status: "unknown",
    seller: { id: "seller", name: "Example seller", type: "private", contact_available: false },
    source: "test_fixture", listing_url: null, observed_at: "2026-09-26T12:00:00Z",
    status: "active", available_from: null, mode: "synthetic",
  };
}

function response(answers: Record<string, unknown>, tokens = 1000) {
  return new Response(JSON.stringify({ model: "jev-1.13.0", answers, usage: { input_tokens: tokens, output_tokens: 40 } }), { status: 200 });
}

test("missing credentials gives deterministic unscored results without an API call", async () => {
  delete process.env.TYPESAFE_API_KEY;
  globalThis.fetch = (() => { throw new Error("must not call fetch"); }) as typeof fetch;
  const result = await rankCars([car("expensive", 24000), car("cheap", 19000)], brief);
  assert.equal(result.mode, "unscored_fallback");
  assert.equal(result.model, null);
  assert.deepEqual(result.results.map((item) => [item.listing.id, item.score]), [["cheap", null], ["expensive", null]]);
  assert.match(result.warning!, /not configured/);
  assert.equal(result.estimated_cost_usd, 0);
});

test("valid batch scores keep evidence, explicit candidate paths, ranking and actual usage", async () => {
  process.env.TYPESAFE_API_KEY = "unit-test-key";
  globalThis.fetch = (async (url, init) => {
    assert.equal(url, "https://api.typesafe.ai/v1/systemone");
    const request = JSON.parse(init!.body as string);
    assert.equal(request.model, "jev-1.13.0");
    assert.equal(Object.keys(request.questions).length, 4);
    assert.match(request.questions.fit_1.instructions, /state\.listings\[1\]/);
    assert.match(request.questions.maintenance_0.instructions, /state\.listings\[0\]\.maintenance_history/);
    assert.ok(init!.signal);
    return response({ fit_0: { type: "noul", noul: 0.3 }, maintenance_0: { type: "noul", noul: 0.8 }, fit_1: { type: "noul", noul: 0.9 }, maintenance_1: { type: "noul", noul: 0.7 } }, 2500);
  }) as typeof fetch;
  const result = await rankCars([car("a", 20000), car("b", 22000)], brief);
  assert.equal(result.mode, "live_jev");
  assert.equal(result.results[0].listing.id, "b");
  assert.ok(Math.abs(result.results[0].score! - 0.87) < 1e-10);
  assert.equal(result.results[0].factors[1].evidence, "Oil changed at 45,000 miles; service receipts available.");
  assert.equal(result.results[0].verification_required, true);
  assert.ok(result.results[0].unknowns.some((value) => value.includes("Accident history")));
  assert.equal(result.input_tokens, 2500);
  assert.equal(result.estimated_cost_usd, 2500 * 0.042 / 1_000_000);
});

test("missing maintenance is unknown, not fabricated or treated as poor maintenance", async () => {
  process.env.TYPESAFE_API_KEY = "unit-test-key";
  globalThis.fetch = (async (_url, init) => {
    const request = JSON.parse(init!.body as string);
    assert.deepEqual(Object.keys(request.questions), ["fit_0"]);
    return response({ fit_0: { type: "noul", noul: 0.7 } });
  }) as typeof fetch;
  const result = await rankCars([car("a", 22000, null)], brief);
  assert.equal(result.mode, "live_jev");
  assert.equal(result.results[0].factors.length, 1);
  assert.equal(result.results[0].score, 0.7);
  assert.ok(result.results[0].unknowns.includes("Maintenance records are not supplied."));
});

test("partial, invalid, and out-of-range answers fail closed to unscored results", async () => {
  process.env.TYPESAFE_API_KEY = "unit-test-key";
  for (const answers of [
    { fit_0: { type: "noul", noul: 0.8 } },
    { fit_0: { type: "noul", noul: 1.5 }, maintenance_0: { type: "noul", noul: 0.8 } },
    { fit_0: { type: "noul", noul: "0.8" }, maintenance_0: { type: "noul", noul: 0.8 } },
  ]) {
    globalThis.fetch = (async () => response(answers)) as typeof fetch;
    const result = await rankCars([car("a", 20000)], brief);
    assert.equal(result.mode, "unscored_fallback");
    assert.equal(result.results[0].score, null);
    assert.match(result.warning!, /incomplete or invalid/);
    assert.equal(result.input_tokens, 1000);
  }
});

test("provider HTTP failure does not expose response bodies or secret material", async () => {
  process.env.TYPESAFE_API_KEY = "unit-test-key";
  globalThis.fetch = (async () => new Response("private provider diagnostic", { status: 401 })) as typeof fetch;
  const result = await rankCars([car("a", 20000)], brief);
  assert.equal(result.mode, "unscored_fallback");
  assert.doesNotMatch(JSON.stringify(result), /private provider diagnostic|unit-test-key/);
});

test("deadline also bounds a fetch implementation that ignores abort", async (context) => {
  process.env.TYPESAFE_API_KEY = "unit-test-key";
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = ((_url, init) => {
    signal = init?.signal;
    return new Promise<Response>(() => {});
  }) as typeof fetch;
  const pending = rankCars([car("a", 20000)], brief);
  context.mock.timers.tick(14_000);
  const result = await pending;
  assert.equal(signal?.aborted, true);
  assert.equal(result.mode, "unscored_fallback");
  assert.match(result.warning!, /14-second deadline/);
});

test("empty candidates make no API call", async () => {
  process.env.TYPESAFE_API_KEY = "unit-test-key";
  globalThis.fetch = (() => { throw new Error("must not call fetch"); }) as typeof fetch;
  const result = await rankCars([], brief);
  assert.deepEqual(result.results, []);
  assert.equal(result.input_tokens, 0);
});

test("price priority is a transparent deterministic factor", async () => {
  process.env.TYPESAFE_API_KEY = "unit-test-key";
  globalThis.fetch = (async () => response({ fit_0: { type: "noul", noul: 0.7 }, fit_1: { type: "noul", noul: 0.7 } })) as typeof fetch;
  const result = await rankCars([car("expensive", 24000, null), car("cheap", 18000, null)], { ...brief, priority: "lowest_price" });
  assert.equal(result.results[0].listing.id, "cheap");
  assert.equal(result.results[0].factors[1].name, "Relative asking price");
  assert.equal(result.results[0].factors[1].score, 1);
});
