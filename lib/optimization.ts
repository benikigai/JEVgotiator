import { createHash } from "node:crypto";
import { z } from "zod";
import { briefSchema, type Brief, type Car, type Optimization } from "./contracts";

const TIMEOUT_MS = 12_000;
const quoteSchema = z.object({
  listing_id: z.string().min(1).max(200),
  seller: z.string().min(1).max(200),
  price: z.number().finite().nonnegative(),
  total: z.number().finite().nonnegative().nullable().default(null),
  terms: z.string().max(4000),
  evidence: z.string().max(8000).nullable().default(null),
});
const eventSchema = z.object({
  label: z.string().min(1).max(200),
  detail: z.string().max(4000),
  state: z.enum(["done", "pending", "blocked"]),
});
const providerResponseSchema = z.object({
  job_id: z.string().min(1).max(200),
  status: z.enum(["ready", "queued", "running", "pending", "completed", "needs_review", "failed"]),
  quotes: z.array(quoteSchema).max(20).default([]),
  events: z.array(eventSchema).max(100).default([]),
});
type ProviderResponse = z.infer<typeof providerResponseSchema>;
type ErrorCode = "disabled" | "invalid_request" | "rejected" | "uncertain" | "unavailable";

export class OptimizationDispatchError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly may_have_contacted: boolean,
    public readonly request_id: string | null = null,
  ) {
    super(message);
    this.name = "OptimizationDispatchError";
  }
}

function validateSelection(cars: Car[], brief: Brief) {
  briefSchema.parse(brief);
  if (cars.length < 1 || cars.length > 3 || new Set(cars.map((car) => car.id)).size !== cars.length) {
    throw new OptimizationDispatchError("Select one to three distinct listings.", "invalid_request", false);
  }
}

export function createOptimization(cars: Car[], brief: Brief): Optimization {
  validateSelection(cars, brief);
  const plans = cars.map((car) => {
    const title = [car.year, car.make, car.model, car.trim].filter(Boolean).join(" ");
    const questions = [
      "Is this exact car still available, and what is its VIN?",
      "Can you provide the title status, accident history, and any repair or damage reports?",
      "Can you provide the maintenance and service history, including unresolved recalls?",
      ...(car.make.toLowerCase() === "tesla" ? [
        "What battery and drive-unit warranty remains by date and mileage, and does it transfer to this buyer?",
        "Can you provide battery health information, charging history if available, and any battery or drive-unit replacements?",
      ] : []),
      "What is the itemized out-the-door total, including tax, registration, dealer fees, and add-ons?",
      "Are any quoted discounts conditional on financing, a trade-in, rebates, or other eligibility?",
      "Will you allow an independent pre-purchase inspection and a test drive before any commitment?",
      ...(brief.needed_by ? [`Can the car and required paperwork be ready by ${brief.needed_by}?`] : []),
    ];
    return {
      listing_id: car.id,
      title,
      asking_price: car.price,
      target_price: null,
      questions,
      opening_message: `Hello, I am helping a buyer evaluate your ${title}. Is this exact vehicle still available? Please share its VIN, title and accident history, service records, and an itemized out-the-door quote. The buyer would also like an independent inspection before deciding. This inquiry is nonbinding and does not authorize a deposit, reservation, or purchase.`,
    };
  });
  const digest = createHash("sha256").update(JSON.stringify({ brief, plans })).digest("hex").slice(0, 20);
  return {
    id: `plan_${digest}`,
    mode: "planning",
    status: "ready",
    summary: `Prepared seller questions for ${cars.length} selected ${cars.length === 1 ? "car" : "cars"}. No seller contact has occurred.`,
    plans,
    quotes: [],
    events: [
      { label: "Buyer shortlist received", detail: `${cars.length} selected listings prepared for review.`, state: "done" },
      { label: "Seller questions prepared", detail: "Asking prices are listing data. No discount or negotiated offer has been invented.", state: "done" },
      { label: "Seller contact", detail: "Requires explicit contact approval and the configured Dara integration.", state: "pending" },
      { label: "Review seller quotes", detail: "Compare supported quotes and itemized fees before selecting a final car.", state: "pending" },
      { label: "Purchase approval", detail: "A separate buyer decision is required before any binding commitment.", state: "pending" },
    ],
    provider_job_id: null,
    warning: cars.some((car) => car.mode !== "live") ? "Sample or replay listings cannot be sent for live seller contact." : null,
  };
}

function providerUrl(): string {
  const value = process.env.DARA_API_URL;
  if (!value) throw new OptimizationDispatchError("Dara's API is not configured.", "disabled", false);
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash || url.search || !["http:", "https:"].includes(url.protocol)) throw new Error();
    if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error();
  } catch {
    throw new OptimizationDispatchError("DARA_API_URL must be an HTTPS endpoint without URL credentials, a query, or a fragment; localhost HTTP is supported for development.", "invalid_request", false);
  }
  return value;
}

function headers(requestId?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(requestId ? { "Idempotency-Key": requestId } : {}),
    ...(process.env.DARA_API_KEY ? { Authorization: `Bearer ${process.env.DARA_API_KEY}` } : {}),
  };
}

function safeListing(car: Car) {
  return {
    id: car.id, make: car.make, model: car.model, year: car.year, trim: car.trim,
    price: car.price, mileage: car.mileage, exterior_color: car.exterior_color,
    fuel_type: car.fuel_type, body_type: car.body_type, city: car.city,
    description: car.description, accident_history: car.accident_history,
    maintenance_history: car.maintenance_history, title_status: car.title_status,
    seller: { id: car.seller.id, name: car.seller.name, type: car.seller.type, contact_available: car.seller.contact_available },
    source: car.source, listing_url: car.listing_url, observed_at: car.observed_at,
    status: car.status, available_from: car.available_from, mode: car.mode,
  };
}

function mapResponse(response: ProviderResponse, plan?: Optimization): Optimization {
  const status = response.status === "failed" ? "needs_review"
    : ["queued", "running"].includes(response.status) ? "pending"
    : response.status as Optimization["status"];
  return {
    id: response.job_id,
    mode: "live",
    status,
    summary: `Dara's API reports this job as ${response.status}. Seller contact and quotes require provider evidence; no purchase is authorized.`,
    plans: plan?.plans ?? [],
    quotes: response.quotes,
    events: response.events.map((event) => ({ ...event, label: `Provider: ${event.label}` })),
    provider_job_id: response.job_id,
    warning: response.status === "failed" ? "Dara reports a failed job. Reconcile its history before starting another contact attempt."
      : response.quotes.some((quote) => !quote.evidence) ? "Some provider quotes have no supporting evidence yet. Verify them before proceeding."
      : "Provider-reported status. This application has not independently verified seller contact or quote terms.",
  };
}

export async function dispatchOptimization(cars: Car[], brief: Brief, requestId: string): Promise<Optimization> {
  if (process.env.OUTBOUND_CONTACT_ENABLED !== "true") {
    throw new OptimizationDispatchError("Live seller contact is disabled. The local plan is available without contacting sellers.", "disabled", false, requestId);
  }
  const endpoint = providerUrl();
  const plan = createOptimization(cars, brief);
  if (!/^[A-Za-z0-9_.:-]{1,200}$/.test(requestId)) {
    throw new OptimizationDispatchError("A stable request ID is required for seller contact.", "invalid_request", false);
  }
  if (cars.some((car) => car.mode !== "live" || car.status !== "active")) {
    throw new OptimizationDispatchError("Live contact requires active live listings. Refresh the shortlist before proceeding.", "invalid_request", false, requestId);
  }
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST", headers: headers(requestId), redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        request_id: requestId,
        mode: "live",
        buyer_brief: briefSchema.parse(brief),
        listings: cars.map(safeListing),
        authorization: { scope: "availability_and_nonbinding_negotiation", purchase: false },
      }),
    });
  } catch {
    throw new OptimizationDispatchError("The dispatch response was not received. Seller contact may have started. Reconcile this request ID with Dara before retrying.", "uncertain", true, requestId);
  }
  if (!response.ok) {
    const rejected = [400, 401, 403, 404, 422].includes(response.status);
    throw new OptimizationDispatchError(
      rejected ? `Dara's API rejected the request (HTTP ${response.status}). No accepted job was confirmed.`
        : `Dara's API returned HTTP ${response.status}. Seller contact may have started. Reconcile this request ID before retrying.`,
      rejected ? "rejected" : "uncertain", !rejected, requestId,
    );
  }
  try {
    const result = providerResponseSchema.parse(await response.json());
    if (result.quotes.some((quote) => !cars.some((car) => car.id === quote.listing_id))) throw new Error();
    return mapResponse(result, plan);
  } catch {
    throw new OptimizationDispatchError("Dara accepted the request but returned an invalid job response. Seller contact may have started. Reconcile this request ID before retrying.", "uncertain", true, requestId);
  }
}

export async function getOptimizationStatus(jobId: string): Promise<Optimization> {
  const endpoint = providerUrl();
  if (!jobId || jobId.length > 200) throw new OptimizationDispatchError("Invalid optimization job ID.", "invalid_request", false);
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/${encodeURIComponent(jobId)}`, {
      method: "GET", headers: headers(), redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const result = providerResponseSchema.parse(await response.json());
    if (result.job_id !== jobId) throw new Error();
    return mapResponse(result);
  } catch {
    throw new OptimizationDispatchError("Job status could not be verified. Keep the existing job ID and try a status check later; do not start a replacement job.", "unavailable", false);
  }
}
