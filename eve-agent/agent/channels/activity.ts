import { createHash, timingSafeEqual } from "node:crypto";
import { createWorld } from "@workflow/world-vercel";
import { defineChannel, GET, type Session } from "eve/channels";
import { projectEvents, redactActivityText } from "../lib/activity";
import { allowedParticipantLabel, PARTICIPANT_ATTRIBUTE } from "../lib/participants";

const MAX_EVENTS = 1000;
async function boundedEvents(session: Session) {
  const tail = await session.getStreamTailIndex();
  if (tail < 0) return { events: [], truncated: false };
  const start = Math.max(0, tail - MAX_EVENTS + 1);
  const reader = (await session.getEventStream({ startIndex: start })).getReader();
  const events: unknown[] = [];
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Activity stream timed out")), 6000); });
  try {
    while (events.length <= tail - start) {
      const next = await Promise.race([reader.read(), timeout]);
      if (next.done) break;
      events.push(next.value);
    }
  } finally {
    clearTimeout(timer!);
    await reader.cancel().catch(() => {});
  }
  return { events, truncated: start > 0 };
}

export default defineChannel({
  routes: [GET("/jevgotiator/activity", async (request, { attachSession }) => {
    const expected = process.env.EVE_API_KEY;
    const provided = request.headers.get("authorization")?.replace(/^Bearer /i, "");
    if (!expected || !provided || !timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(provided).digest())) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    try {
      const requested = new URL(request.url).searchParams.get("conversation_id");
      if (requested && !/^wrun_[A-Za-z0-9]{26}$/.test(requested)) return Response.json({ error: "Invalid conversation ID" }, { status: 400 });
      // Canonical metadata avoids analytics ingestion lag for a newly received iMessage.
      const world = createWorld();
      const page = await world.runs.list({ resolveData: "none", pagination: { limit: 100, sortOrder: "desc" } });
      const conversations = page.data.filter((run) => run.attributes["$eve.type"] === "session").map((run) => {
        const trigger = run.attributes["$eve.trigger"] ?? "";
        const channel: "photon" | "http" | "unknown" = /photon/i.test(trigger) ? "photon" : /http|eve/i.test(trigger) ? "http" : "unknown";
        return { id: run.runId, title: redactActivityText(run.attributes["$eve.title"] || `${channel === "photon" ? "iMessage" : "Agent"} conversation`, 160), channel, participant_label: allowedParticipantLabel(run.attributes[PARTICIPANT_ATTRIBUTE]), status: run.status === "running" ? "active" : run.status, updated_at: run.updatedAt.toISOString() };
      }).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 30);
      const selected = requested ? conversations.find((conversation) => conversation.id === requested) : conversations.find((conversation) => conversation.channel === "photon") ?? conversations[0];
      if (requested && !selected) return Response.json({ error: "Conversation was not found in the recent session list" }, { status: 404 });
      const read = selected ? await boundedEvents(attachSession(selected.id)) : { events: [], truncated: false };
      const projection = projectEvents(read.events);
      if (selected && read.events.length) { selected.status = projection.status; selected.updated_at = projection.updated_at ?? selected.updated_at; }
      return Response.json({
        source: "eve", status: "live", fetched_at: new Date().toISOString(), conversations,
        selected_id: selected?.id ?? null, messages: projection.messages, tools: projection.tools,
        search: projection.search, optimization: projection.optimization,
        warning: read.truncated ? "Showing the most recent 1,000 durable events; older results may be outside this window."
          : page.hasMore ? "Showing recent conversations. Older workflow runs are outside this bounded view." : null,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ error: "Durable Eve activity is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  })],
});
