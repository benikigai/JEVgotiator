import assert from "node:assert/strict";
import { test } from "node:test";
import fixture from "../data/demo-activity.json";
import catalog from "../data/catalog.json";
import { normalizeActivity, readReplayActivity, replayActivityFrom } from "../lib/activity";

const catalogIds = new Set((catalog as { id: string }[]).map((car) => car.id));

test("the committed replay fixture passes the same activity validation as the live feed", () => {
  assert.equal(fixture.status, "replay");
  assert.ok(fixture.conversations.length >= 2 && fixture.conversations.length <= 3);
  for (const conversation of fixture.conversations) {
    assert.match(conversation.id, /^wrun_[A-Za-z0-9]{26}$/);
    const run = replayActivityFrom(fixture, conversation.id);
    assert.equal(run.status, "replay");
    assert.equal(run.selected_id, conversation.id);
    assert.ok(run.messages.some((message) => message.role === "user") && run.messages.some((message) => message.role === "assistant"));
    assert.ok(run.search, "every demo run includes a search");
    for (const result of run.search!.results) {
      assert.ok(catalogIds.has(result.listing.id), `${result.listing.id} is a synthetic catalog listing`);
      assert.equal(result.listing.mode, "synthetic");
    }
    for (const plan of run.optimization?.plans ?? []) assert.ok(catalogIds.has(plan.listing_id));
    for (const tool of run.tools) assert.ok(["clarify_car_request", "search_teslas", "prepare_deal_plan"].includes(tool.name));
  }
  const all = fixture.conversations.map((conversation) => replayActivityFrom(fixture, conversation.id));
  assert.ok(all.some((run) => run.optimization && run.optimization.plans.length > 0 && run.optimization.plans.every((plan) => plan.opening_message.length > 0)));
  for (const name of ["clarify_car_request", "search_teslas", "prepare_deal_plan"]) assert.ok(all.some((run) => run.tools.some((tool) => tool.name === name)));
});

test("the replay uses fictional buyers only and cannot pass as live", () => {
  const text = JSON.stringify(fixture);
  // Team names never appear as participants; "Dara's rules" / "Dara score" name the scoring method only.
  assert.doesNotMatch(text.replace(/Dara(?:'s|’s| score)/g, ""), /\b(Ben|Chris|Dara)\b/);
  for (const conversation of fixture.conversations) assert.ok(!("participant_label" in conversation));
  assert.ok(!/\+1\s?\(?\d{3}|@[a-z]+\.[a-z]/i.test(text), "no phone numbers or emails");
  const { runs, ...header } = fixture;
  const first = fixture.conversations[0].id;
  assert.throws(() => normalizeActivity({ ...header, selected_id: first, ...(runs as Record<string, object>)[first] }, "live"));
});

test("replay selection rejects unknown or malformed conversation IDs", () => {
  assert.equal(readReplayActivity().selected_id, fixture.conversations[0].id);
  assert.throws(() => readReplayActivity("wrun_0000000000000000000000NOPE"));
  assert.throws(() => readReplayActivity("../etc/passwd"));
});
