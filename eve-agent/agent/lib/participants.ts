import { createWorld } from "@workflow/world-vercel";

export type ParticipantLabel = "Ben" | "Chris" | "Dara";
export const PARTICIPANT_ATTRIBUTE = "jevgotiator.participant_label";

export function allowedParticipantLabel(value: unknown): ParticipantLabel | undefined {
  return value === "Ben" || value === "Chris" || value === "Dara" ? value : undefined;
}

export function matchParticipant(sender: unknown, users: unknown): ParticipantLabel | undefined {
  if (typeof sender !== "string" || !Array.isArray(users)) return undefined;
  const identity = sender.replace(/^photon:/, "");
  const labels = new Set<ParticipantLabel>();
  for (const user of users) {
    if (!user || typeof user !== "object" || (user.id !== identity && user.phoneNumber !== identity)) continue;
    const name = typeof user.firstName === "string" ? user.firstName.trim().toLowerCase() : "";
    const label = name === "ben" || name === "benjamin" ? "Ben" : name === "chris" ? "Chris" : name === "dara" ? "Dara" : undefined;
    if (label) labels.add(label);
  }
  return labels.size === 1 ? [...labels][0] : undefined;
}

let directory: { projectId: string; expires: number; users: unknown[] } | undefined;

export async function resolveParticipantLabel(sender: unknown): Promise<ParticipantLabel | undefined> {
  const projectId = process.env.IMESSAGE_PROJECT_ID;
  const secret = process.env.IMESSAGE_PROJECT_SECRET;
  if (!projectId || !secret) return undefined;
  try {
    if (!directory || directory.projectId !== projectId || directory.expires <= Date.now()) {
      const response = await fetch(`https://spectrum.photon.codes/projects/${encodeURIComponent(projectId)}/users/`, {
        headers: { Authorization: `Basic ${Buffer.from(`${projectId}:${secret}`).toString("base64")}` },
        redirect: "error", signal: AbortSignal.timeout(8000), cache: "no-store",
      });
      if (!response.ok) return undefined;
      const body = await response.json();
      if (body?.succeed !== true || !Array.isArray(body.data?.users) || body.data.users.length > 1000) return undefined;
      directory = { projectId, expires: Date.now() + 60000, users: body.data.users };
    }
    return matchParticipant(sender, directory.users);
  } catch {
    // An unavailable participant directory must not interrupt a buyer conversation.
    return undefined;
  }
}

export async function saveParticipantLabel(sessionId: string, sender: unknown) {
  const label = await resolveParticipantLabel(sender);
  if (!label) return;
  try {
    await createWorld().runs.experimentalSetAttributes?.(sessionId, [{ key: PARTICIPANT_ATTRIBUTE, value: label }]);
  } catch {
    console.warn("Participant label could not be saved.");
  }
}
