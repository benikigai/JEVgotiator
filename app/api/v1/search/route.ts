import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { briefSchema } from "@/lib/contracts";
import { loadCatalog, filterCars } from "@/lib/catalog";
import { rankCars } from "@/lib/jev";
import { apiError, jsonBody, seal, session } from "@/lib/security";
export const maxDuration = 40;
export async function POST(request: Request) {
  try {
    const owner = session(request);
    const brief = briefSchema.parse((await jsonBody(request)).brief);
    const catalog = await loadCatalog();
    const filtered = filterCars(catalog.cars, brief);
    const candidates = [...filtered.eligible].sort((a, b) => brief.priority === "low_mileage" ? (a.mileage ?? Infinity) - (b.mileage ?? Infinity) : (a.price ?? Infinity) - (b.price ?? Infinity)).slice(0, 30);
    const ranked = await rankCars(candidates, brief);
    const results = ranked.results.slice(0, 5);
    const id = randomUUID();
    const { cars: _cars, ...catalogMeta } = catalog;
    const { results: _results, ...ranking } = ranked;
    return NextResponse.json({ session_id: id, result_token: seal({ id, brief, results }, "result", owner), brief, results, counts: { total: catalog.cars.length, eligible: filtered.eligible.length, candidates: candidates.length, scored: ranked.mode === "live_jev" ? candidates.length : 0, shown: results.length }, ranking, catalog: { ...catalogMeta, warnings: [...catalog.warnings, ...filtered.warnings, ...(filtered.eligible.length > 30 ? ["Scoring the first 30 eligible cars by price or mileage. Narrow your criteria to evaluate a smaller complete pool."] : [])] }, created_at: new Date().toISOString() });
  } catch (error) { return apiError(error, 422); }
}
