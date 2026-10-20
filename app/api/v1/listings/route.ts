import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog";
import { apiError, sessionInfo } from "@/lib/security";
export async function GET(request: Request) {
  try { const { tier } = sessionInfo(request); const catalog = await loadCatalog({ syntheticOnly: tier !== "team" }); return NextResponse.json({ ...catalog, cars: catalog.cars.filter(car => car.make.toLowerCase() === "tesla") }); } catch (error) { return apiError(error, 503); }
}
