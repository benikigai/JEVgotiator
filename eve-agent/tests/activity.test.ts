import assert from "node:assert/strict";
import { test } from "node:test";
import { projectEvents } from "../agent/lib/activity";

const at = "2026-09-26T20:00:00Z";
const event = (id: string, type: string, data: unknown) => ({ type, data, meta: { id, at } });

test("projects real messages and tool lifecycle without hidden reasoning or raw tool input", () => {
  const output = projectEvents([
    event("1", "message.received", { message: "Find a Model Y", turnId: "turn1" }),
    event("1", "message.received", { message: "Find a Model Y", turnId: "turn1" }),
    event("2", "reasoning.completed", { reasoning: "Do not expose reasoning" }),
    event("3", "actions.requested", { actions: [{ callId: "call1", toolName: "search_teslas", input: { api_key: "hidden" } }] }),
    event("4", "action.result", { status: "failed", result: { callId: "call1", toolName: "search_teslas", isError: true, output: { token: "hidden" } } }),
    event("5", "message.completed", { message: "The search failed.", turnId: "turn1", stepIndex: 1 }),
    event("6", "session.waiting", {}),
  ]);
  assert.equal(output.messages.length, 2);
  assert.equal(output.tools[0].status, "failed");
  assert.equal(output.status, "waiting");
  assert.equal(output.search, null);
  assert.ok(!JSON.stringify(output).includes("hidden"));
  assert.ok(!JSON.stringify(output).includes("reasoning"));
});

test("assistant deltas are replaced by completed messages and contact details are redacted", () => {
  const output = projectEvents([
    event("1", "message.appended", { messageDelta: "Hello ", turnId: "turn1", stepIndex: 0 }),
    event("2", "message.appended", { messageDelta: "there", turnId: "turn1", stepIndex: 0 }),
    event("3", "message.completed", { message: "Contact example@example.com", turnId: "turn1", stepIndex: 0 }),
  ]);
  assert.equal(output.messages.length, 1);
  assert.equal(output.messages[0].text, "Contact [contact withheld]");
});
