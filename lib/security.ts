import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const developmentKey = randomBytes(32).toString("hex");
function key() {
  const secret = process.env.APP_SECRET || (process.env.NODE_ENV !== "production" ? developmentKey : "");
  if (!secret) throw new Error("Application session secret is not configured.");
  return createHash("sha256").update(secret).digest();
}
export function seal(value: unknown, purpose: string, session: string, lifetime = 3600) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = JSON.stringify({ value, purpose, session, expires: Date.now() + lifetime * 1000 });
  const bytes = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64url");
}
export function unseal<T>(token: string, purpose: string, session?: string): T {
  if (token.length > 150000) throw new Error("Invalid session context.");
  try {
    const bytes = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    if (data.purpose !== purpose || data.expires < Date.now() || (session && data.session !== session)) throw new Error();
    return data.value as T;
  } catch { throw new Error("This result expired or belongs to another session. Run the search again."); }
}
export function matches(value: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(value).digest(), createHash("sha256").update(expected).digest());
}
export type SessionTier = "team" | "public";
export type SessionInfo = { id: string; tier: SessionTier };
type SessionToken = { id: string; tier: SessionTier; code?: string };
// Fingerprint of the configured team code, so rotating DEMO_ACCESS_CODE revokes earlier team sessions.
function codeFingerprint() {
  const code = process.env.DEMO_ACCESS_CODE;
  return code ? createHash("sha256").update(`jvg-team:${code}`).digest("base64url").slice(0, 22) : "";
}
// Local development without a configured code keeps the live team view.
function developmentTeam() {
  return process.env.NODE_ENV !== "production" && !process.env.DEMO_ACCESS_CODE;
}
/** Team only for the correct DEMO_ACCESS_CODE (constant-time); everyone else gets a public session. */
export function tierForCode(supplied: unknown): SessionTier {
  const code = process.env.DEMO_ACCESS_CODE;
  if (code) return typeof supplied === "string" && supplied.length > 0 && matches(supplied, code) ? "team" : "public";
  return developmentTeam() ? "team" : "public";
}
export function sessionInfo(request: Request): SessionInfo {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  // Trusted server-to-server clients (the Eve agent) hold a secret key and keep full access.
  if (bearer && process.env.INTEGRATION_API_KEY && matches(bearer, process.env.INTEGRATION_API_KEY)) return { id: "integration-client", tier: "team" };
  const token = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith("jvg_session="))?.slice(12);
  if (!token) throw new Error("Sign in with the team demo code to continue.");
  const value = unseal<string | SessionToken>(token, "session");
  // Tokens issued before tiers existed carry only the session ID and are public.
  if (typeof value === "string") return { id: value, tier: developmentTeam() ? "team" : "public" };
  if (!value || typeof value.id !== "string") throw new Error("This result expired or belongs to another session. Run the search again.");
  const team = developmentTeam() || (value.tier === "team" && Boolean(value.code) && value.code === codeFingerprint());
  return { id: value.id, tier: team ? "team" : "public" };
}
export function session(request: Request) {
  return sessionInfo(request).id;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // The reverse proxy may give Next an internal URL while preserving the public Host.
  const expected = process.env.APP_ORIGIN || `${url.protocol}//${request.headers.get("host") || url.host}`;
  if (origin && origin !== expected) throw new Error("Request origin is not allowed.");
}
export async function jsonBody(request: Request) {
  sameOrigin(request);
  const raw = await request.text();
  if (raw.length > 160000) throw new Error("Request is too large.");
  return JSON.parse(raw);
}
export function signInResponse(request: Request, tier: SessionTier = "public") {
  const id = randomUUID();
  const response = NextResponse.json({ authenticated: true, tier });
  const value: SessionToken = tier === "team" ? { id, tier, code: codeFingerprint() } : { id, tier };
  response.cookies.set("jvg_session", seal(value, "session", id, 86400), { httpOnly: true, secure: process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 86400 });
  return response;
}
export function apiError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Request could not be completed.";
  return NextResponse.json({ error: message.slice(0, 600) }, { status });
}
