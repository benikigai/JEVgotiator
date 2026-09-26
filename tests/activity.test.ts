import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeActivity, readActivity } from "../lib/activity";
import { conversationsForParticipant } from "../lib/activity-contract";

const id = "wrun_01ABCDEF0123456789ABCDEFGH";
const sample = {
  source: "eve", status: "live", fetched_at: "2026-09-26T20:00:00Z",
  conversations: [{ id, title: "A Tesla search", channel: "photon", status: "waiting", updated_at: "2026-09-26T20:00:00Z", phone: "secret phone" }],
  selected_id: id, messages: [{ id: "event-1", role: "user", text: "Find a Tesla", created_at: "2026-09-26T20:00:00Z", secret: "hidden" }],
  tools: [], search: null, optimization: null, warning: null, result_token: "hidden",
};

test("activity projection strips unknown provider fields and never needs a result token", () => {
  const output = normalizeActivity(sample);
  assert.equal(output.conversations[0].channel, "photon");
  assert.equal(output.messages[0].text, "Find a Tesla");
  assert.ok(!JSON.stringify(output).includes("hidden"));
  assert.ok(!JSON.stringify(output).includes("secret phone"));
});

test("activity projection rejects a selected conversation outside the authorized list", () => {
  assert.throws(() => normalizeActivity({ ...sample, selected_id: "different-session" }));
});

test("activity preserves allowlisted participant names and keeps older feeds compatible", () => {
  for (const participant_label of ["Ben", "Chris", "Dara"]) {
    const output = normalizeActivity({ ...sample, conversations: [{ ...sample.conversations[0], participant_label }] });
    assert.equal(output.conversations[0].participant_label, participant_label);
  }
  assert.equal(normalizeActivity(sample).conversations[0].participant_label, undefined);
});

test("unmatched participant labels cannot expose arbitrary identities", () => {
  for (const participant_label of ["private@example.test", "+15550001111", { phone: "private" }, null]) {
    const output = normalizeActivity({ ...sample, conversations: [{ ...sample.conversations[0], participant_label }] });
    assert.equal(output.conversations[0].participant_label, undefined);
    assert.ok(!JSON.stringify(output).includes("private"));
    assert.ok(!JSON.stringify(output).includes("+15550001111"));
  }
});

test("person filters preserve session order and never fall back to another person", () => {
  const base = normalizeActivity(sample).conversations[0];
  const conversations = [
    { ...base, id: "ben-new", participant_label: "Ben" as const },
    { ...base, id: "chris", participant_label: "Chris" as const },
    { ...base, id: "ben-old", participant_label: "Ben" as const },
    { ...base, id: "operator", channel: "http" as const },
  ];
  assert.deepEqual(conversationsForParticipant(conversations, "Ben").map(item => item.id), ["ben-new", "ben-old"]);
  assert.deepEqual(conversationsForParticipant(conversations, "Dara"), []);
  assert.deepEqual(conversationsForParticipant(conversations, "unknown").map(item => item.id), ["operator"]);
  assert.deepEqual(conversationsForParticipant(conversations, ""), conversations);
});

test("unconfigured activity returns an explicit empty state without network access", async () => {
  const env = process.env.EVE_AGENT_URL;
  const fetch = globalThis.fetch;
  delete process.env.EVE_AGENT_URL;
  globalThis.fetch = async () => { throw new Error("Must not fetch"); };
  try {
    const output = await readActivity();
    assert.equal(output.status, "unconfigured");
    assert.deepEqual(output.messages, []);
    assert.equal(output.search, null);
  } finally {
    globalThis.fetch = fetch;
    if (env !== undefined) process.env.EVE_AGENT_URL = env;
  }
});

test("activity preserves labeled simulation while stripping unrelated private provider data", () => {
  const simulation = {
    mode: "synthetic_scenario", assumptions: ["Fixed demo percentages, not market value."],
    candidates: [{ listing_id: "sample-1", asking_price: 30000, opening_offer: 27600, simulated_counter: 29400, simulated_agreed_price: 28500, simulated_savings: 1500, recommendation: "Scenario rank 1", private_secret: "hidden" }],
    actions: [{ label: "Simulated agreement", detail: "No actual agreement exists.", state: "done" }], disclaimer: "SIMULATION ONLY", token: "hidden",
  };
  const output = normalizeActivity({ ...sample, optimization: { id: "plan-1", mode: "planning", status: "ready", summary: "No seller contact.", plans: [], warning: null, simulation } });
  assert.equal(output.optimization!.simulation!.candidates[0].simulated_agreed_price, 28500);
  assert.equal(output.optimization!.simulation!.disclaimer, "SIMULATION ONLY");
  assert.deepEqual(output.optimization!.quotes, []);
  assert.ok(!JSON.stringify(output).includes("hidden"));
});
