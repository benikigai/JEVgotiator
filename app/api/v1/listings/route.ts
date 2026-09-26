import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog";
import { apiError, session } from "@/lib/security";
export async function GET(request: Request) {
  try { session(request); const catalog = await loadCatalog(); return NextResponse.json({ ...catalog, cars: catalog.cars.filter(car => car.make.toLowerCase() === "tesla") }); } catch (error) { return apiError(error, 503); }
}
