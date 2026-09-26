import { z } from "zod";
import { searchResponseSchema, planResponseSchema } from "./contracts";

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const publicSearchSchema = searchResponseSchema.omit({ result_token: true });
const planSchema = planResponseSchema;

export function redactActivityText(value: unknown, max = 6000): string {
  if (typeof value !== "string") return "";
  let text = value.slice(0, max);
  for (const name of ["EVE_API_KEY", "JEVGOTIATOR_API_KEY", "IMESSAGE_PROJECT_SECRET", "IMESSAGE_WEBHOOK_SECRET", "AI_GATEWAY_API_KEY"]) {
    const secret = process.env[name];
    if (secret && secret.length >= 8) text = text.replaceAll(secret, "[credential withheld]");
  }
  return text.replace(/\b(?:vcp_|sk-)[A-Za-z0-9_-]{12,}\b/g, "[credential withheld]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[contact withheld]")
    .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, (match) => match.replace(/\D/g, "").length >= 10 ? "[contact withheld]" : match);
}

function scrub<T>(value: T): T {
  if (typeof value === "string") return redactActivityText(value) as T;
  if (Array.isArray(value)) return value.map(scrub) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key === "input_tokens" || !/token|secret|password|authorization|api.?key|credential/i.test(key)).map(([key, child]) => [key, scrub(child)])) as T;
  return value;
}

export function projectEvents(events: unknown[]) {
  const messages: { id: string; role: "user" | "assistant"; text: string; created_at: string }[] = [];
  const tools = new Map<string, { id: string; name: string; status: "running" | "completed" | "failed"; started_at: string | null; completed_at: string | null }>();
  const partialMessages = new Map<string, { id: string; role: "assistant"; text: string; created_at: string }>();
  let search: z.infer<typeof publicSearchSchema> | null = null;
  let optimization: (z.infer<typeof planSchema> & { quotes: []; events: []; provider_job_id: null }) | null = null;
  let status = "active";
  let updatedAt: string | null = null;
  const seen = new Set<string>();
  for (const value of events) {
    const event = row(value), data = row(event.data), meta = row(event.meta);
    const id = typeof meta.id === "string" ? meta.id : `event-${seen.size}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const at = typeof meta.at === "string" ? meta.at : "";
    if (at) updatedAt = at;
    const messageKey = `${data.turnId}:${data.stepIndex}`;
    if (event.type === "message.received" && data.kind !== "execution.background_task") {
      messages.push({ id, role: "user", text: redactActivityText(data.message), created_at: at });
    } else if (event.type === "message.appended") {
      const prior = partialMessages.get(messageKey);
      partialMessages.set(messageKey, { id: prior?.id ?? id, role: "assistant", text: `${prior?.text ?? ""}${redactActivityText(data.messageDelta)}`.slice(0, 6000), created_at: prior?.created_at ?? at });
    } else if (event.type === "message.completed") {
      partialMessages.delete(messageKey);
      const text = redactActivityText(data.message);
      if (text) messages.push({ id, role: "assistant", text, created_at: at });
    } else if (event.type === "actions.requested" && Array.isArray(data.actions)) {
      for (const value of data.actions) {
        const action = row(value);
        if (typeof action.callId !== "string" || typeof action.toolName !== "string") continue;
        tools.set(action.callId, { id: action.callId, name: redactActivityText(action.toolName, 120), status: "running", started_at: at || null, completed_at: null });
      }
    } else if (event.type === "action.result") {
      const result = row(data.result);
      if (typeof result.callId !== "string" || typeof result.toolName !== "string") continue;
      const prior = tools.get(result.callId);
      const failed = data.status === "failed" || data.status === "rejected" || result.isError === true;
      tools.set(result.callId, { id: result.callId, name: redactActivityText(result.toolName, 120), status: failed ? "failed" : "completed", started_at: prior?.started_at ?? null, completed_at: at || null });
      if (!failed && result.toolName === "search_teslas") {
        const parsed = publicSearchSchema.safeParse(result.output);
        if (parsed.success) search = scrub(parsed.data);
      }
      if (!failed && result.toolName === "prepare_deal_plan") {
        const parsed = planSchema.safeParse(result.output);
        if (parsed.success) optimization = { ...scrub(parsed.data), quotes: [], events: [], provider_job_id: null };
      }
    }
    if (["turn.started", "step.started"].includes(String(event.type))) status = "running";
    if (event.type === "session.waiting") status = "waiting";
    if (event.type === "session.completed") status = "completed";
    if (["turn.failed", "session.failed"].includes(String(event.type))) status = "failed";
    if (event.type === "turn.cancelled") status = "cancelled";
  }
  return { messages: [...messages, ...partialMessages.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-100), tools: [...tools.values()].slice(-100), search, optimization, status, updated_at: updatedAt };
}
