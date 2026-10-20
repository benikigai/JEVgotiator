import { NextResponse } from "next/server";
import { apiError, jsonBody, sessionInfo, signInResponse, tierForCode } from "@/lib/security";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { const { tier } = sessionInfo(request); return NextResponse.json({ authenticated: true, tier }); } catch { return NextResponse.json({ authenticated: false, code_required: process.env.OPEN_DEMO === "false" && (Boolean(process.env.DEMO_ACCESS_CODE) || process.env.NODE_ENV === "production") }); }
}
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const code = process.env.DEMO_ACCESS_CODE;
    const supplied = typeof body?.code === "string" ? body.code : "";
    if (process.env.OPEN_DEMO === "false" && !code && process.env.NODE_ENV === "production") return apiError(new Error("Demo access is not configured."), 503);
    const tier = tierForCode(supplied);
    // Closed demo: only the team code opens a session. Open demo: no code gives a public session,
    // and a wrong code is reported instead of silently downgrading to public.
    if (tier !== "team" && (process.env.OPEN_DEMO === "false" || supplied)) return apiError(new Error("That demo code does not match."), 401);
    return signInResponse(request, tier);
  } catch (error) { return apiError(error); }
}
