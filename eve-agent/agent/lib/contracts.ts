import { z } from "zod";

const traceSchema = z.object({
  outcome: z.enum(["scored", "not_requested", "failed"]), request_sent: z.boolean(),
  requested_model: z.string(), returned_model: z.string().nullable(),
  buyer_request: z.string(), hard_filter_role: z.string(), algorithm: z.string(), note: z.string(),
  candidates: z.array(z.object({ listing_id: z.string(), label: z.string(), asking_price: z.number().nullable(), mileage: z.number().nullable(), state_path: z.string(), model_context: z.record(z.string(), z.union([z.string(), z.number(), z.null()])) })).max(30),
  questions: z.array(z.object({ question_id: z.string(), listing_id: z.string(), factor: z.string(), type: z.literal("noul"), instructions: z.string(), criteria: z.object({ true: z.string(), false: z.string() }) })).max(300),
  answers: z.array(z.object({ question_id: z.string(), listing_id: z.string(), type: z.literal("noul").nullable(), noul: z.number().nullable(), valid: z.boolean(), used: z.boolean() })).max(300),
  composition: z.array(z.object({ listing_id: z.string(), rank: z.number(), final_score: z.number(), factors: z.array(z.object({ name: z.string(), source: z.enum(["jev", "code"]), score: z.number(), weight: z.number(), normalized_weight: z.number(), contribution: z.number() })) })).max(30),
});

export const briefSchema = z.object({
  query: z.string().min(5).max(2000), budget: z.number().int().min(1000).max(500000),
  budget_basis: z.enum(["advertised_price", "out_the_door"]), city: z.literal("San Francisco"), make: z.literal("Tesla"),
  model: z.enum(["", "Model 3", "Model Y", "Model S", "Model X", "Cybertruck", "Roadster"]).optional(),
  min_year: z.number().int().min(1980).max(2027).nullable(), max_mileage: z.number().int().min(0).max(500000).nullable(),
  body_type: z.string().max(40).default(""), fuel_type: z.string().max(40).default(""), color: z.string().max(40).default(""),
  clean_title: z.boolean().default(false), no_reported_accidents: z.boolean().default(false),
  needed_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  priority: z.enum(["best_fit", "lowest_price", "low_mileage"]).default("best_fit"),
});
export const searchResponseSchema = z.object({
  session_id: z.string(), result_token: z.string().min(1).max(150000), created_at: z.string().datetime(),
  brief: briefSchema,
  results: z.array(z.object({
    listing: z.object({ id: z.string(), make: z.string(), model: z.string(), year: z.number(), price: z.number().nullable(), mileage: z.number().nullable(), exterior_color: z.string().nullable(), city: z.string(), mode: z.enum(["synthetic", "live", "replay"]), listing_url: z.string().nullable() }),
    score: z.number().nullable(), reasons: z.array(z.string()), unknowns: z.array(z.string()), verification_required: z.boolean(),
  })).max(5),
  counts: z.object({ total: z.number(), eligible: z.number(), candidates: z.number(), scored: z.number(), shown: z.number() }),
  ranking: z.object({ mode: z.enum(["live_jev", "unscored_fallback"]), model: z.string().nullable(), warning: z.string().nullable(), latency_ms: z.number(), estimated_cost_usd: z.number(), input_tokens: z.number().optional(), trace: traceSchema.optional() }),
  catalog: z.object({ mode: z.enum(["live", "synthetic", "mixed"]), warnings: z.array(z.string()) }),
});
export type SearchSnapshot = z.infer<typeof searchResponseSchema>;

export const positionsSchema = z.array(z.number().int().min(1).max(5)).min(1).max(3).refine((values) => new Set(values).size === values.length, "Choose distinct shortlist positions.");

export function planRequest(snapshot: SearchSnapshot | null, positions: number[], now = Date.now()) {
  positionsSchema.parse(positions);
  if (!snapshot || now - Date.parse(snapshot.created_at) >= 3600000 || Date.parse(snapshot.created_at) > now + 60000) throw new Error("The shortlist is missing or expired. Search again and reconfirm selections.");
  const ids = positions.map((position) => {
    const result = snapshot.results[position - 1];
    if (!result) throw new Error("That position is not in this conversation's latest shortlist.");
    return result.listing.id;
  });
  return { result_token: snapshot.result_token, listing_ids: ids, action: "plan" as const };
}

export function publicSearch(snapshot: SearchSnapshot) {
  const { result_token: _secret, ...publicResult } = snapshot;
  return { ...publicResult, results: publicResult.results.map((result, index) => ({ position: index + 1, ...result })), seller_contacted: false };
}
