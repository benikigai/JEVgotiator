import type { Optimization, SearchResult } from "./contracts";

export const activityParticipants = ["Ben", "Chris", "Dara"] as const;
export type ActivityParticipant = typeof activityParticipants[number];
export type ParticipantFilter = ActivityParticipant | "unknown" | "";

export type ActivityResponse = {
  source: "eve";
  status: "live" | "unconfigured" | "unavailable";
  fetched_at: string;
  conversations: {
    id: string;
    title: string;
    channel: "photon" | "http" | "unknown";
    status: string;
    created_at: string;
    updated_at: string;
    participant_label?: ActivityParticipant;
  }[];
  selected_id: string | null;
  messages: { id: string; role: "user" | "assistant"; text: string; created_at: string }[];
  tools: { id: string; name: string; status: "running" | "completed" | "failed"; started_at: string | null; completed_at: string | null }[];
  search: Omit<SearchResult, "result_token"> | null;
  optimization: Omit<Optimization, "job_token"> | null;
  warning: string | null;
};

export function conversationsForParticipant(conversations: ActivityResponse["conversations"], participant: ParticipantFilter) {
  return conversations.filter((conversation) => !participant || (participant === "unknown" ? !conversation.participant_label : conversation.participant_label === participant));
}
