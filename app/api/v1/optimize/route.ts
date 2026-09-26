import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Brief, RankedCar } from "@/lib/contracts";
import { createOptimization, dispatchOptimization, getOptimizationStatus, OptimizationDispatchError } from "@/lib/optimization";
import { loadCatalog } from "@/lib/catalog";
import { apiError, jsonBody, seal, session, unseal } from "@/lib/security";
export const maxDuration = 25;
const schema = z.object({ result_token: z.string().max(150000), listing_ids: z.array(z.string()).min(1).max(3), action: z.enum(["plan", "contact"]).default("plan"), contact_approved: z.boolean().default(false) });
export async function POST(request: Request) {
  try {
    const owner = session(request);
    const input = schema.parse(await jsonBody(request));
    if (new Set(input.listing_ids).size !== input.listing_ids.length) throw new Error("Choose distinct cars.");
    const context = unseal<{ id: string; brief: Brief; results: RankedCar[] }>(input.result_token, "result", owner);
    const selected = input.listing_ids.map(id => { const result = context.results.find(r => r.listing.id === id); if (!result) throw new Error("Choose cars from this search result."); return result.listing; });
    if (input.action === "plan") return NextResponse.json(createOptimization(selected, context.brief));
    if (!input.contact_approved) throw new Error("Approve the contact scope before dispatch.");
    if (process.env.OUTBOUND_CONTACT_ENABLED !== "true") throw new Error("Seller contact is not enabled. The planning handoff is available.");
    if (selected.some(car => car.mode !== "live")) throw new Error("Synthetic or replay listings cannot be contacted.");
    const latest = await loadCatalog();
    for (const car of selected) {
      const current = latest.cars.find(row => row.id === car.id);
      if (!current || current.mode !== "live" || current.status !== "active" || current.price !== car.price || current.seller.id !== car.seller.id) throw new Error("A selected listing changed or is unavailable. Search again before contacting the seller.");
    }
    const requestId = createHash("sha256").update(`${context.id}:${[...input.listing_ids].sort().join(",")}:contact`).digest("hex");
    const job = await dispatchOptimization(selected, context.brief, requestId);
    if (job.provider_job_id) job.job_token = seal({ job_id: job.provider_job_id }, "job", owner, 86400);
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    if (error instanceof OptimizationDispatchError) return NextResponse.json({ error: error.message, code: error.code, may_have_contacted: error.may_have_contacted, request_id: error.request_id }, { status: 409 });
    return apiError(error, 409);
  }
}
export async function GET(request: Request) {
  try { const owner = session(request); const token = new URL(request.url).searchParams.get("token") || ""; const job = unseal<{ job_id: string }>(token, "job", owner); return NextResponse.json(await getOptimizationStatus(job.job_id)); } catch (error) { return apiError(error, 409); }
}
