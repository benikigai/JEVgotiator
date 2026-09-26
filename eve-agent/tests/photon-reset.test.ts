import test from "node:test";
import assert from "node:assert/strict";
import { resetPhotonConversation } from "../agent/channels/photon";
import { planRequest } from "../agent/lib/contracts";

function fixture() {
  const history = new Map<string, string[]>([["old", ["Old search and selection"]]]);
  let current: string | null = "old";
  let resets = 0;
  const replies: string[] = [];
  return {
    history, replies, get current() { return current; }, get resets() { return resets; },
    newMessage() { if (!current) { current = "new"; history.set("new", []); } return { sessionId: current, snapshot: null }; },
    ops: {
      async resolveSession() {
        if (!current) return undefined;
        const id = current;
        return {
          id,
          async getEventStream() { return new ReadableStream({ start(controller) { controller.enqueue({ type: "session.started", meta: { at: id === "old" ? "2026-09-26T12:00:00.000Z" : "2026-09-26T12:02:00.000Z" } }); } }); },
          async reset() { resets++; if (current === id) current = null; return { status: "reset" as const, previousSessionId: id }; },
        };
      },
      async reply(text: string) { replies.push(text); },
    },
  };
}

test("reset retires the current session, keeps history, and starts the next request without an old selection", async () => {
  const f = fixture();
  assert.equal(await resetPhotonConversation({ text: "/reset", sentAt: new Date("2026-09-26T12:01:00.000Z") }, f.ops), true);
  assert.equal(f.current, null);
  assert.equal(f.resets, 1);
  assert.deepEqual(f.history.get("old"), ["Old search and selection"]);
  const next = f.newMessage();
  assert.equal(next.sessionId, "new");
  assert.throws(() => planRequest(next.snapshot, [1]), /missing or expired/);
  assert.match(f.replies[0], /previous conversation is saved/);
});

test("a delayed duplicate reset cannot retire the replacement session", async () => {
  const f = fixture(), input = { text: "/new", sentAt: new Date("2026-09-26T12:01:00.000Z") };
  await resetPhotonConversation(input, f.ops);
  f.newMessage();
  await resetPhotonConversation(input, f.ops);
  assert.equal(f.current, "new");
  assert.equal(f.resets, 1);
  assert.equal(f.replies.length, 1);
});

test("ordinary buyer text and malformed reset timestamps do not reset a session", async () => {
  const f = fixture();
  assert.equal(await resetPhotonConversation({ text: "reset my budget to 25000", sentAt: new Date() }, f.ops), false);
  assert.equal(await resetPhotonConversation({ text: "/reset", sentAt: new Date("invalid") }, f.ops), true);
  assert.equal(f.resets, 0);
  assert.equal(f.current, "old");
});
