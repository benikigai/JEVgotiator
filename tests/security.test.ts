import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { POST as optimize } from "../app/api/v1/optimize/route";
import { GET as getDemoSession, POST as postDemoSession } from "../app/api/session/route";
import { jsonBody, matches, seal, session, signInResponse, unseal } from "../lib/security";
import type { Brief, Car, RankedCar } from "../lib/contracts";

const originalFetch = globalThis.fetch;
const envKeys = ["APP_SECRET", "APP_ORIGIN", "NODE_ENV", "INTEGRATION_API_KEY", "OUTBOUND_CONTACT_ENABLED", "DARA_API_URL", "CATALOG_API_URL", "OPEN_DEMO", "DEMO_ACCESS_CODE"];
let originalEnv: Record<string, string | undefined>;
let fetchCalls = 0;
beforeEach(() => {
  originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  process.env.APP_SECRET = "security-test-only-key-not-a-credential";
  process.env.INTEGRATION_API_KEY = "integration-test-only-key";
  process.env.OUTBOUND_CONTACT_ENABLED = "true";
  process.env.DARA_API_URL = "https://dara.example/jobs";
  delete process.env.CATALOG_API_URL;
  delete process.env.APP_ORIGIN;
  fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls++; throw new Error("Unexpected outbound request in a blocked-action test"); };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

const brief: Brief = {
  query: "Tesla commuter in San Francisco", budget: 30000, budget_basis: "advertised_price",
  city: "San Francisco", min_year: 2020, max_mileage: 60000, make: "Tesla", body_type: "",
  fuel_type: "electric", color: "", clean_title: false, no_reported_accidents: false,
  needed_by: null, priority: "best_fit",
};
const car: Car = {
  id: "fixture-tesla", make: "Tesla", model: "Model 3", year: 2022, trim: null,
  price: 27500, mileage: 40000, exterior_color: "Black", body_type: "sedan", fuel_type: "electric",
  city: "San Francisco", photos: [], description: "Synthetic listing", accident_history: null,
  maintenance_history: null, title_status: "unknown",
  seller: { id: "fixture-seller", name: "Example seller", type: "dealer", contact_available: true },
  source: "synthetic", listing_url: null, observed_at: "2026-09-26T12:00:00Z",
  status: "active", available_from: null, mode: "synthetic",
};

function resultToken(listing = car, owner = "buyer-a", purpose = "result") {
  const results: RankedCar[] = [{ listing, score: null, factors: [], reasons: [], unknowns: [], verification_required: true }];
  return seal({ id: "search-1", brief, results }, purpose, owner);
}
function request(body: object, owner = "buyer-a") {
  return new Request("https://jevgotiator.example/api/v1/optimize", {
    method: "POST",
    headers: {
      "content-type": "application/json", origin: "https://jevgotiator.example",
      cookie: `jvg_session=${seal(owner, "session", owner)}`,
    },
    body: JSON.stringify(body),
  });
}

test("sealed results are encrypted, randomized, and bound to purpose and owner", () => {
  const value = { listing_id: "private-listing-123" };
  const first = seal(value, "result", "buyer-a");
  assert.notEqual(first, seal(value, "result", "buyer-a"));
  assert.doesNotMatch(Buffer.from(first, "base64url").toString(), /private-listing-123/);
  assert.deepEqual(unseal(first, "result", "buyer-a"), value);
  assert.throws(() => unseal(first, "job", "buyer-a"));
  assert.throws(() => unseal(first, "result", "buyer-b"));
});

test("IV, authentication tag, ciphertext tampering and malformed tokens reject", () => {
  const token = seal({ listing_id: "car-1" }, "result", "buyer-a");
  for (const offset of [0, 12, 28]) {
    const bytes = Buffer.from(token, "base64url");
    bytes[offset] ^= 1;
    assert.throws(() => unseal(bytes.toString("base64url"), "result", "buyer-a"));
  }
  for (const invalid of ["", "malformed", token.slice(0, 20), "a".repeat(150001)]) {
    assert.throws(() => unseal(invalid, "result", "buyer-a"));
  }
});

test("expired tokens and tokens from a previous signing key reject", () => {
  assert.throws(() => unseal(seal({ id: "car" }, "result", "buyer-a", -1), "result", "buyer-a"));
  const token = seal("buyer-a", "session", "buyer-a");
  process.env.APP_SECRET = "rotated-test-only-key";
  assert.throws(() => unseal(token, "session"));
});

test("session accepts signed cookies or the configured bearer and rejects invalid credentials", () => {
  assert.equal(session(request({})), "buyer-a");
  assert.equal(session(new Request("https://jevgotiator.example", { headers: { authorization: "Bearer integration-test-only-key" } })), "integration-client");
  assert.throws(() => session(new Request("https://jevgotiator.example")));
  assert.throws(() => session(new Request("https://jevgotiator.example", { headers: { authorization: "Bearer wrong-key" } })));
  assert.throws(() => session(new Request("https://jevgotiator.example", { headers: { cookie: `jvg_session=${seal("buyer-a", "result", "buyer-a")}` } })));
  assert.equal(matches("same", "same"), true);
  assert.equal(matches("different-length", "same"), false);
});

test("sign-in produces an HttpOnly, SameSite=Lax, Secure cookie on HTTPS", () => {
  const response = signInResponse(new Request("https://jevgotiator.example/api/session"));
  const cookie = response.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /Path=\//i);
  const owner = session(new Request("https://jevgotiator.example", { headers: { cookie: cookie.split(";")[0] } }));
  assert.match(owner, /^[\da-f-]{36}$/);
});

test("hackathon demo issues a session without a code and can restore the gate", async () => {
  process.env.DEMO_ACCESS_CODE = "test-code";
  delete process.env.OPEN_DEMO;
  const request = () => new Request("https://jevgotiator.example/api/session", { method: "POST", headers: { origin: "https://jevgotiator.example" }, body: "{}" });
  assert.equal((await (await getDemoSession(new Request("https://jevgotiator.example/api/session"))).json()).code_required, false);
  assert.equal((await postDemoSession(request())).status, 200);
  process.env.OPEN_DEMO = "false";
  assert.equal((await (await getDemoSession(new Request("https://jevgotiator.example/api/session"))).json()).code_required, true);
  assert.equal((await postDemoSession(request())).status, 401);
});

test("cross-origin and oversized JSON requests reject", async () => {
  await assert.rejects(jsonBody(new Request("https://jevgotiator.example/api/v1/optimize", { method: "POST", headers: { origin: "https://attacker.example" }, body: "{}" })), /origin/);
  await assert.rejects(jsonBody(new Request("https://jevgotiator.example/api/v1/optimize", { method: "POST", body: "a".repeat(160001) })), /too large/);
});

test("proxy origin uses the configured public origin or development Host and rejects other origins", async () => {
  const local = new Request("http://0.0.0.0:3000/api/session", { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000" }, body: "{}" });
  assert.deepEqual(await jsonBody(local), {});
  process.env.APP_ORIGIN = "https://public-production.example";
  const proxied = new Request("http://0.0.0.0:3000/api/session", { method: "POST", headers: { host: "internal:3000", origin: "https://public-production.example" }, body: "{}" });
  assert.deepEqual(await jsonBody(proxied), {});
  await assert.rejects(jsonBody(new Request("http://0.0.0.0:3000/api/session", { method: "POST", headers: { host: "attacker.example", origin: "https://attacker.example" }, body: "{}" })), /origin/);
});

test("production sessions set Secure even when the reverse proxy uses internal HTTP", () => {
  Object.assign(process.env, { NODE_ENV: "production" });
  const response = signInResponse(new Request("http://0.0.0.0:3000/api/session"));
  assert.match(response.headers.get("set-cookie")!, /Secure/i);
});

test("planning synthetic cars is local and never dispatches seller contact", async () => {
  const response = await optimize(request({ result_token: resultToken(), listing_ids: [car.id], action: "plan", contact_approved: true }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.mode, "planning");
  assert.equal(body.provider_job_id, null);
  assert.match(body.summary, /No seller contact/);
  assert.equal(fetchCalls, 0);
});

test("synthetic and replay cars cannot contact even with both approval gates enabled", async () => {
  for (const mode of ["synthetic", "replay"] as const) {
    const response = await optimize(request({ result_token: resultToken({ ...car, mode }), listing_ids: [car.id], action: "contact", contact_approved: true }));
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /Synthetic or replay/);
  }
  assert.equal(fetchCalls, 0);
});

test("contact requires explicit boolean consent and the server enablement gate", async () => {
  const token = resultToken({ ...car, mode: "live" });
  for (const approval of [false, undefined, "true"]) {
    const response = await optimize(request({ result_token: token, listing_ids: [car.id], action: "contact", contact_approved: approval }));
    assert.equal(response.status, 409);
  }
  process.env.OUTBOUND_CONTACT_ENABLED = "false";
  const response = await optimize(request({ result_token: token, listing_ids: [car.id], action: "contact", contact_approved: true }));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /not enabled/);
  assert.equal(fetchCalls, 0);
});

test("optimize rejects another owner's result and another token purpose before dispatch", async () => {
  for (const token of [resultToken(car, "buyer-b"), resultToken(car, "buyer-a", "job")]) {
    const response = await optimize(request({ result_token: token, listing_ids: [car.id], action: "contact", contact_approved: true }));
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /another session/);
  }
  assert.equal(fetchCalls, 0);
});

test("buyer selection cannot add out-of-shortlist cars, duplicates or more than three cars", async () => {
  for (const ids of [["not-in-result"], [car.id, car.id], [car.id, "b", "c", "d"]]) {
    const response = await optimize(request({ result_token: resultToken(), listing_ids: ids, action: "contact", contact_approved: true }));
    assert.equal(response.status, 409);
  }
  assert.equal(fetchCalls, 0);
});

test("unauthenticated optimize requests are rejected before any provider call", async () => {
  const response = await optimize(new Request("https://jevgotiator.example/api/v1/optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result_token: resultToken(), listing_ids: [car.id], action: "contact", contact_approved: true }) }));
  assert.equal(response.status, 409);
  assert.equal(fetchCalls, 0);
});

test("uncertain dispatch preserves its request ID and contact warning without retrying", async () => {
  const liveCar: Car = { ...car, mode: "live", source: "tesla" };
  process.env.CATALOG_API_URL = "https://catalog.example/cars";
  let dispatchCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://catalog.example/cars") return Response.json({ cars: [liveCar] });
    assert.equal(String(url), "https://dara.example/jobs");
    dispatchCalls++;
    throw new DOMException("No response", "TimeoutError");
  };
  const response = await optimize(request({ result_token: resultToken(liveCar), listing_ids: [liveCar.id], action: "contact", contact_approved: true }));
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.code, "uncertain");
  assert.equal(body.may_have_contacted, true);
  assert.match(body.request_id, /^[\da-f]{64}$/);
  assert.match(body.error, /Reconcile/);
  assert.equal(dispatchCalls, 1);
});
