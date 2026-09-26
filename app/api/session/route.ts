import { NextResponse } from "next/server";
import { apiError, jsonBody, matches, session, signInResponse } from "@/lib/security";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { session(request); return NextResponse.json({ authenticated: true }); } catch { return NextResponse.json({ authenticated: false, code_required: process.env.OPEN_DEMO === "false" && (Boolean(process.env.DEMO_ACCESS_CODE) || process.env.NODE_ENV === "production") }); }
}
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const code = process.env.DEMO_ACCESS_CODE;
    if (process.env.OPEN_DEMO === "false" && code && !matches(String(body.code || ""), code)) return apiError(new Error("That demo code does not match."), 401);
    if (process.env.OPEN_DEMO === "false" && !code && process.env.NODE_ENV === "production") return apiError(new Error("Demo access is not configured."), 503);
    return signInResponse(request);
  } catch (error) { return apiError(error); }
}
