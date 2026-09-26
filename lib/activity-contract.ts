import type { Optimization, SearchResult } from "./contracts";

export type ActivityResponse = {
  source: "eve";
  status: "live" | "unconfigured" | "unavailable";
  fetched_at: string;
  conversations: {
    id: string;
    title: string;
    channel: "photon" | "http" | "unknown";
    status: string;
    updated_at: string;
  }[];
  selected_id: string | null;
  messages: { id: string; role: "user" | "assistant"; text: string; created_at: string }[];
  tools: { id: string; name: string; status: "running" | "completed" | "failed"; started_at: string | null; completed_at: string | null }[];
  search: Omit<SearchResult, "result_token"> | null;
  optimization: Omit<Optimization, "job_token"> | null;
  warning: string | null;
};
