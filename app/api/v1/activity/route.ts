import { NextResponse } from "next/server";
import { apiError, sessionInfo } from "@/lib/security";
import { readActivity, readReplayActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: Request) {
  let tier: "team" | "public";
  try { tier = sessionInfo(request).tier; } catch (error) { return apiError(error, 401); }
  try {
    const conversationId = new URL(request.url).searchParams.get("conversation_id");
    // Recorded iMessage conversations are team-only. Public sessions always get the committed
    // synthetic replay and never fall back to the live Eve feed.
    const activity = tier === "team" ? await readActivity(conversationId) : readReplayActivity(conversationId);
    return NextResponse.json(activity, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return apiError(new Error("Invalid activity request."), 400); }
}
