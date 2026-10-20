import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { GET as activity } from "../app/api/v1/activity/route";
import { POST as optimize } from "../app/api/v1/optimize/route";
import { POST as clarifyRoute } from "../app/api/v1/clarify/route";
import { GET as getDemoSession, POST as postDemoSession } from "../app/api/session/route";
import { seal, sessionInfo } from "../lib/security";
import type { Brief, Car, RankedCar } from "../lib/contracts";

const envKeys = ["APP_SECRET", "APP_ORIGIN", "NODE_ENV", "INTEGRATION_API_KEY", "OUTBOUND_CONTACT_ENABLED", "DARA_API_URL", "CATALOG_API_URL", "OPEN_DEMO", "DEMO_ACCESS_CODE", "EVE_AGENT_URL", "EVE_API_KEY", "AI_GATEWAY_API_KEY"];
const originalFetch = globalThis.fetch;
let originalEnv: Record<string, string | undefined>;
let fetched: string[] = [];
beforeEach(() => {
  originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
  process.env.APP_SECRET = "tier-test-only-key-not-a-credential";
  process.env.DEMO_ACCESS_CODE = "team-test-code";
  process.env.EVE_AGENT_URL = "https://eve.example";
  process.env.EVE_API_KEY = "eve-test-only-key";
  fetched = [];
  globalThis.fetch = async (url) => { fetched.push(String(url)); throw new Error("Unexpected outbound request"); };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

const origin = "https://jevgotiator.example";
async function signIn(code?: string) {
  const response = await postDemoSession(new Request(`${origin}/api/session`, { method: "POST", headers: { origin }, body: JSON.stringify(code === undefined ? {} : { code }) }));
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  return { status: response.status, body: await response.json(), cookie };
}
const withCookie = (cookie: string, path = "/api/v1/activity") => new Request(`${origin}${path}`, { headers: { cookie, origin } });

test("open demo without a code issues a public session; only the correct code is team", async () => {
  const open = await signIn();
  assert.equal(open.status, 200);
  assert.equal(open.body.tier, "public");
  assert.equal(sessionInfo(withCookie(open.cookie!)).tier, "public");
  const team = await signIn("team-test-code");
  assert.equal(team.body.tier, "team");
  assert.equal(sessionInfo(withCookie(team.cookie!)).tier, "team");
  const wrong = await signIn("not-the-code");
  assert.equal(wrong.status, 401);
  assert.equal(wrong.cookie, undefined);
  assert.equal((await (await getDemoSession(withCookie(team.cookie!, "/api/session"))).json()).tier, "team");
});

test("closed demo still requires the code", async () => {
  process.env.OPEN_DEMO = "false";
  assert.equal((await signIn()).status, 401);
  assert.equal((await signIn("team-test-code")).body.tier, "team");
});

test("tokens issued before tiers are public, and rotating the code revokes team sessions", async () => {
  assert.equal(sessionInfo(withCookie(`jvg_session=${seal("legacy-id", "session", "legacy-id")}`)).tier, "public");
  assert.equal(sessionInfo(withCookie(`jvg_session=${seal({ id: "no-fingerprint", tier: "team" }, "session", "no-fingerprint")}`)).tier, "public");
  const team = await signIn("team-test-code");
  process.env.DEMO_ACCESS_CODE = "rotated-code";
  assert.equal(sessionInfo(withCookie(team.cookie!)).tier, "public");
});

test("development without a configured code is team; production without one is public", async () => {
  delete process.env.DEMO_ACCESS_CODE;
  assert.equal((await signIn()).body.tier, "team");
  assert.equal(sessionInfo(withCookie(`jvg_session=${seal("legacy-id", "session", "legacy-id")}`)).tier, "team");
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.equal((await signIn()).body.tier, "public");
});

test("integration bearer clients keep team access", () => {
  process.env.INTEGRATION_API_KEY = "integration-test-only-key";
  assert.deepEqual(sessionInfo(new Request(origin, { headers: { authorization: "Bearer integration-test-only-key" } })), { id: "integration-client", tier: "team" });
});

test("public sessions get the synthetic replay and never call the live Eve feed", async () => {
  const { cookie } = await signIn();
  const response = await activity(withCookie(cookie!));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "replay");
  assert.ok(body.conversations.length >= 2);
  assert.ok(body.messages.length > 0);
  const other = body.conversations[1].id;
  const second = await (await activity(withCookie(cookie!, `/api/v1/activity?conversation_id=${other}`))).json();
  assert.equal(second.selected_id, other);
  assert.equal((await activity(withCookie(cookie!, "/api/v1/activity?conversation_id=wrun_0000000000000000000000NOPE"))).status, 400);
  assert.deepEqual(fetched, []);
});

test("team sessions read the live Eve feed, and a live feed claiming replay is rejected", async () => {
  const { cookie } = await signIn("team-test-code");
  const id = "wrun_01ABCDEF0123456789ABCDEFGH";
  let status = "live";
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    return Response.json({ source: "eve", status, fetched_at: "2026-09-26T20:00:00Z", conversations: [{ id, title: "Live", channel: "photon", status: "waiting", updated_at: "2026-09-26T20:00:00Z" }], selected_id: id, messages: [], tools: [], search: null, optimization: null, warning: null });
  };
  const live = await (await activity(withCookie(cookie!))).json();
  assert.equal(live.status, "live");
  assert.equal(fetched.length, 1);
  assert.match(fetched[0], /^https:\/\/eve\.example\/jevgotiator\/activity/);
  status = "replay";
  assert.equal((await (await activity(withCookie(cookie!))).json()).status, "unavailable");
});

test("public sessions cannot request seller contact and clarify skips paid model calls", async () => {
  process.env.OUTBOUND_CONTACT_ENABLED = "true";
  process.env.AI_GATEWAY_API_KEY = "gateway-test-only-key";
  const { cookie, body } = await signIn();
  const owner = sessionInfo(withCookie(cookie!)).id;
  assert.equal(body.tier, "public");
  const brief: Brief = { query: "Tesla commuter in San Francisco", budget: 30000, budget_basis: "advertised_price", city: "San Francisco", min_year: 2020, max_mileage: 60000, make: "Tesla", body_type: "", fuel_type: "", color: "", clean_title: false, no_reported_accidents: false, needed_by: null, priority: "best_fit" };
  const car = { id: "live-car", make: "Tesla", model: "Model 3", year: 2022, trim: null, price: 27500, mileage: 40000, exterior_color: "Black", body_type: "sedan", fuel_type: "electric", city: "San Francisco", photos: [], description: "", accident_history: null, maintenance_history: null, title_status: "unknown", seller: { id: "s", name: "s", type: "dealer", contact_available: true }, source: "tesla", listing_url: null, observed_at: "2026-09-26T12:00:00Z", status: "active", available_from: null, mode: "live" } as Car;
  const results: RankedCar[] = [{ listing: car, score: null, factors: [], reasons: [], unknowns: [], verification_required: true }];
  const response = await optimize(new Request(`${origin}/api/v1/optimize`, { method: "POST", headers: { cookie: cookie!, origin }, body: JSON.stringify({ result_token: seal({ id: "s1", brief, results }, "result", owner), listing_ids: [car.id], action: "contact", contact_approved: true }) }));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /reserved for the team/);
  const clarified = await (await clarifyRoute(new Request(`${origin}/api/v1/clarify`, { method: "POST", headers: { cookie: cookie!, origin }, body: JSON.stringify({ text: "Model 3 under $25k in San Francisco" }) }))).json();
  assert.equal(clarified.mode, "guided");
  assert.deepEqual(fetched, []);
});
