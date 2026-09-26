import { NextResponse } from "next/server";
import { apiError, session } from "@/lib/security";
import { readActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: Request) {
  try { session(request); } catch (error) { return apiError(error, 401); }
  try {
    const activity = await readActivity(new URL(request.url).searchParams.get("conversation_id"));
    return NextResponse.json(activity, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return apiError(new Error("Invalid activity request."), 400); }
}
