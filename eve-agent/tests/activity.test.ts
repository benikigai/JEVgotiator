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

test("recorded plan retains labeled simulation and Dara provenance without secret fields", () => {
  const simulation = {
    mode: "synthetic_scenario", assumptions: ["Fixed demo percentages."],
    candidates: [{ listing_id: "sample-1", asking_price: 30000, opening_offer: 27600, simulated_counter: 29400, simulated_agreed_price: 28500, simulated_savings: 1500, recommendation: "Scenario rank 1" }],
    actions: [{ label: "Simulated agreement", detail: "No actual seller replied.", state: "done" }], disclaimer: "SIMULATION ONLY", result_token: "hidden",
  };
  const intelligence = { source: "dara-sample", source_commit: "163fa478", method: "Dara scoring", assumptions: [], candidates: [{ listing_id: "sample-1", rank: 1, score: 70, signals: { value: 90, evidence: 30.5, road_trip: 78, model_fit: 76, mileage_year_battery: 76 }, unknowns: ["Battery unknown"] }] };
  const output = projectEvents([event("1", "action.result", { status: "completed", result: { callId: "plan1", toolName: "prepare_deal_plan", output: { id: "plan-1", mode: "planning", status: "ready", summary: "No contact.", plans: [], warning: null, simulation, intelligence, api_key: "hidden" } } })]);
  assert.equal(output.optimization!.simulation!.candidates[0].simulated_agreed_price, 28500);
  assert.equal(output.optimization!.intelligence!.source, "dara-sample");
  assert.deepEqual(output.optimization!.quotes, []);
  assert.ok(!JSON.stringify(output).includes("hidden"));
});
