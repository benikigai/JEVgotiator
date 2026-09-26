import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeActivity, readActivity } from "../lib/activity";

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
