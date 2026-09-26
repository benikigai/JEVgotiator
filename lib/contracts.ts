import { z } from "zod";

export const briefSchema = z.object({
  query: z.string().trim().min(5).max(2000),
  budget: z.number().int().min(1000).max(500000),
  budget_basis: z.enum(["advertised_price", "out_the_door"]),
  city: z.literal("San Francisco"),
  min_year: z.number().int().min(1980).max(2027).nullable(),
  max_mileage: z.number().int().min(0).max(500000).nullable(),
  make: z.literal("Tesla").default("Tesla"),
  model: z.enum(["", "Model 3", "Model Y", "Model S", "Model X", "Cybertruck", "Roadster"]).optional(),
  body_type: z.string().max(40).default(""),
  fuel_type: z.string().max(40).default(""),
  color: z.string().max(40).default(""),
  clean_title: z.boolean().default(false),
  no_reported_accidents: z.boolean().default(false),
  needed_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  priority: z.enum(["best_fit", "lowest_price", "low_mileage"]).default("best_fit"),
});
export type Brief = z.infer<typeof briefSchema>;

export type Car = {
  id: string; make: string; model: string; year: number; trim: string | null;
  price: number | null; mileage: number | null; exterior_color: string | null;
  body_type: string | null; fuel_type: string | null; city: string;
  photos: string[]; description: string; accident_history: string | null;
  maintenance_history: string | null; title_status: string;
  seller: { id: string; name: string; type: string; contact_available: boolean };
  source: string; listing_url: string | null; observed_at: string;
  status: "active" | "sold" | "unknown";
  available_from: string | null; mode: "live" | "synthetic" | "replay";
};
export type Catalog = { cars: Car[]; mode: "live" | "synthetic" | "mixed"; source: string; fetched_at: string; warnings: string[] };
export type Factor = { name: string; score: number; evidence: string };
export type RankedCar = { listing: Car; score: number | null; factors: Factor[]; reasons: string[]; unknowns: string[]; verification_required: boolean };
export type JevTrace = {
  outcome: "scored" | "not_requested" | "failed";
  request_sent: boolean; requested_model: string; returned_model: string | null;
  buyer_request: string; hard_filter_role: string; algorithm: string; note: string;
  candidates: { listing_id: string; label: string; asking_price: number | null; mileage: number | null; state_path: string; model_context: Record<string, string | number | null> }[];
  questions: { question_id: string; listing_id: string; factor: string; type: "noul"; instructions: string; criteria: { true: string; false: string } }[];
  answers: { question_id: string; listing_id: string; type: "noul" | null; noul: number | null; valid: boolean; used: boolean }[];
  composition: { listing_id: string; rank: number; final_score: number; factors: { name: string; source: "jev" | "code"; score: number; weight: number; normalized_weight: number; contribution: number }[] }[];
};
export type Ranking = { results: RankedCar[]; mode: "live_jev" | "unscored_fallback"; model: string | null; input_tokens: number; estimated_cost_usd: number; latency_ms: number; warning: string | null; trace?: JevTrace };
export type SearchResult = {
  session_id: string; result_token: string; brief: Brief; results: RankedCar[];
  counts: { total: number; eligible: number; candidates: number; scored: number; shown: number };
  ranking: Omit<Ranking, "results">; catalog: Omit<Catalog, "cars">; created_at: string;
};
export type Optimization = {
  id: string; mode: "planning" | "live"; status: "ready" | "pending" | "completed" | "needs_review";
  summary: string; plans: { listing_id: string; title: string; asking_price: number | null; target_price: number | null; questions: string[]; opening_message: string }[];
  quotes: { listing_id: string; seller: string; price: number; total: number | null; terms: string; evidence: string | null }[];
  events: { label: string; detail: string; state: "done" | "pending" | "blocked" }[];
  provider_job_id: string | null; job_token?: string; warning: string | null;
};
