import { NextResponse } from "next/server";
import { z } from "zod";
import { clarify } from "@/lib/clarify";
import { apiError, jsonBody, sessionInfo } from "@/lib/security";
export const maxDuration = 20;
export async function POST(request: Request) {
  try { const { tier } = sessionInfo(request); const { text } = z.object({ text: z.string().min(5).max(2000) }).parse(await jsonBody(request)); return NextResponse.json(await clarify(text, { allowModel: tier === "team" })); } catch (error) { return apiError(error); }
}
