import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ service: "JEVgotiator", scope: "Tesla / San Francisco", catalog: process.env.CATALOG_API_URL ? "configured_api" : "synthetic", jev: process.env.TYPESAFE_API_KEY ? "configured" : "unconfigured", optimization: process.env.DARA_API_URL ? "configured_api" : "planning_only", contact_enabled: process.env.OUTBOUND_CONTACT_ENABLED === "true", photon: process.env.EVE_AGENT_URL && process.env.EVE_API_KEY ? "eve_configured" : "eve_external_pending" });
}
