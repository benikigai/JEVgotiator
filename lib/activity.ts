import { z } from "zod";
import { briefSchema, optimizationSimulationSchema, daraIntelligenceSchema, type Car, type JevTrace } from "./contracts";
import { activityParticipants, type ActivityResponse } from "./activity-contract";

const short = z.string().max(8000);
const nullableNumber = z.number().finite().nullable();
const traceSchema = z.object({
  outcome: z.enum(["scored", "not_requested", "failed"]), request_sent: z.boolean(), requested_model: short, returned_model: short.nullable(),
  buyer_request: short, hard_filter_role: short, algorithm: short, note: short,
  candidates: z.array(z.object({ listing_id: short, label: short, asking_price: nullableNumber, mileage: nullableNumber, state_path: short, model_context: z.record(z.string(), z.union([short, z.number(), z.null()])) })).max(30),
  questions: z.array(z.object({ question_id: short, listing_id: short, factor: short, type: z.literal("noul"), instructions: short, criteria: z.object({ true: short, false: short }) })).max(300),
  answers: z.array(z.object({ question_id: short, listing_id: short, type: z.literal("noul").nullable(), noul: nullableNumber, valid: z.boolean(), used: z.boolean() })).max(300),
  composition: z.array(z.object({ listing_id: short, rank: z.number(), final_score: z.number(), factors: z.array(z.object({ name: short, source: z.enum(["jev", "code"]), score: z.number(), weight: z.number(), normalized_weight: z.number(), contribution: z.number() })).max(20) })).max(30),
});
const publicSearchSchema = z.object({
  session_id: short, created_at: short, brief: briefSchema,
  results: z.array(z.object({
    listing: z.object({ id: short, make: short, model: short, year: z.number(), price: nullableNumber, mileage: nullableNumber, exterior_color: short.nullable(), city: short, mode: z.enum(["synthetic", "live", "replay"]), listing_url: short.nullable() }),
    score: nullableNumber, reasons: z.array(short).max(20), unknowns: z.array(short).max(20), verification_required: z.boolean(),
  })).max(5),
  counts: z.object({ total: z.number(), eligible: z.number(), candidates: z.number(), scored: z.number(), shown: z.number() }),
  ranking: z.object({ mode: z.enum(["live_jev", "unscored_fallback"]), model: short.nullable(), warning: short.nullable(), latency_ms: z.number(), estimated_cost_usd: z.number(), input_tokens: z.number().optional(), trace: traceSchema.optional() }),
  catalog: z.object({ mode: z.enum(["live", "synthetic", "mixed"]), warnings: z.array(short).max(30) }),
});
const optimizationSchema = z.object({
  id: short, mode: z.literal("planning"), status: z.enum(["ready", "pending", "completed", "needs_review"]), summary: short,
  plans: z.array(z.object({ listing_id: short, title: short, asking_price: nullableNumber, target_price: z.null(), questions: z.array(short).max(30), opening_message: short })).max(3),
  warning: short.nullable(), simulation: optimizationSimulationSchema.optional(), intelligence: daraIntelligenceSchema.optional(),
});
const activitySchema = z.object({
  source: z.literal("eve"), status: z.literal("live"), fetched_at: short,
  conversations: z.array(z.object({ id: z.string().regex(/^wrun_[A-Za-z0-9]{26}$/), title: short, channel: z.enum(["photon", "http", "unknown"]), status: short, created_at: short.optional(), updated_at: short, participant_label: z.enum(activityParticipants).optional().catch(undefined) })).max(30),
  selected_id: short.nullable(),
  messages: z.array(z.object({ id: short, role: z.enum(["user", "assistant"]), text: short, created_at: short })).max(100),
  tools: z.array(z.object({ id: short, name: short, status: z.enum(["running", "completed", "failed"]), started_at: short.nullable(), completed_at: short.nullable() })).max(100),
  search: publicSearchSchema.nullable(), optimization: optimizationSchema.nullable(), warning: short.nullable(),
});

function safeStrings<T>(value: T): T {
  if (typeof value === "string") {
    let text: string = value;
    for (const name of ["EVE_API_KEY", "INTEGRATION_API_KEY", "APP_SECRET", "DEMO_ACCESS_CODE", "TYPESAFE_API_KEY", "AI_GATEWAY_API_KEY"]) {
      const secret = process.env[name];
      if (secret && secret.length >= 8) text = text.replaceAll(secret, "[credential withheld]");
    }
    return text as T;
  }
  if (Array.isArray(value)) return value.map(safeStrings) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key === "input_tokens" || !/token|secret|password|authorization|api.?key|credential/i.test(key)).map(([key, child]) => [key, safeStrings(child)])) as T;
  return value;
}

export function normalizeActivity(payload: unknown): ActivityResponse {
  const parsed = safeStrings(activitySchema.parse(payload));
  if (parsed.selected_id && !parsed.conversations.some((conversation) => conversation.id === parsed.selected_id)) throw new Error("Activity selection is not in the conversation list.");
  const search = parsed.search;
  return {
    ...parsed,
    conversations: parsed.conversations.map(conversation => ({ ...conversation, created_at: conversation.created_at ?? conversation.updated_at })),
    search: search ? {
      ...search,
      results: search.results.map((result) => ({
        ...result, factors: [],
        listing: {
          ...result.listing,
          trim: null, body_type: null, fuel_type: null, photos: [], description: "",
          accident_history: null, maintenance_history: null, title_status: "unknown",
          seller: { id: "", name: "Not included in the activity snapshot", type: "unknown", contact_available: false },
          source: "Eve recorded search result", observed_at: "", status: "unknown", available_from: null,
        } as Car,
      })),
      ranking: { ...search.ranking, input_tokens: search.ranking.input_tokens ?? 0, trace: search.ranking.trace as JevTrace | undefined },
      catalog: { ...search.catalog, source: "Eve recorded search result", fetched_at: search.created_at },
    } : null,
    optimization: parsed.optimization ? { ...parsed.optimization, quotes: [], events: [], provider_job_id: null } : null,
  };
}

export function emptyActivity(status: "unconfigured" | "unavailable", warning: string): ActivityResponse {
  return { source: "eve", status, fetched_at: new Date().toISOString(), conversations: [], selected_id: null, messages: [], tools: [], search: null, optimization: null, warning };
}

export async function readActivity(conversationId?: string | null): Promise<ActivityResponse> {
  const origin = process.env.EVE_AGENT_URL, apiKey = process.env.EVE_API_KEY;
  if (!origin || !apiKey) return emptyActivity("unconfigured", "Connect the Eve agent to view recorded iMessage conversations here.");
  if (conversationId && !/^wrun_[A-Za-z0-9]{26}$/.test(conversationId)) throw new Error("Invalid conversation ID.");
  try {
    const base = new URL(origin);
    if ((base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) || base.username || base.password) throw new Error();
    const url = new URL("/jevgotiator/activity", base);
    if (conversationId) url.searchParams.set("conversation_id", conversationId);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(12_000), cache: "no-store", redirect: "error" });
    if (!response.ok) throw new Error();
    if (Number(response.headers.get("content-length")) > 2_000_000) throw new Error();
    const reader = response.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2_000_000) throw new Error();
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    return normalizeActivity(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    return emptyActivity("unavailable", "Eve activity could not be read. No conversation or search result has been substituted.");
  }
}
