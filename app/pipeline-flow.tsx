"use client";

import type { SearchResult } from "@/lib/contracts";

type Stage = { label: string; value: string; note: string };
type State = "done" | "active" | "pending";

const stageNames = ["Intake", "Clarify", "Filter", "Jev rerank", "Select", "Negotiate"] as const;
type StageName = (typeof stageNames)[number];

export default function PipelineFlow({ result, selected = 0, negotiating = false, briefReady = false }: {
  result: Pick<SearchResult, "counts" | "ranking"> | null; selected?: number; negotiating?: boolean; briefReady?: boolean;
}) {
  const counts = result?.counts;
  const jevLive = result?.ranking.mode === "live_jev";
  const stages: Record<StageName, Stage> = {
    Intake: { label: "Intake", value: counts ? counts.total.toLocaleString() : "—", note: "listings" },
    Clarify: { label: "Clarify", value: briefReady || result ? "1" : "—", note: "brief confirmed" },
    Filter: { label: "Filter", value: counts ? counts.eligible.toLocaleString() : "—", note: "pass hard limits" },
    "Jev rerank": { label: "Jev rerank", value: counts ? counts.scored.toLocaleString() : "—", note: jevLive ? "scored live" : result ? "unscored" : "scored" },
    Select: { label: "Select", value: counts ? `${selected} / ${counts.shown}` : "—", note: "picked of top 5" },
    Negotiate: { label: "Negotiate", value: negotiating ? String(selected) : "—", note: negotiating ? "plans ready" : "plan" },
  };
  const activeIndex = negotiating ? 5 : selected > 0 ? 5 : result ? 4 : briefReady ? 2 : 0;
  const state = (index: number): State => index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";

  return <ol className="flow" aria-label="Search pipeline">
    {stageNames.map((name, index) => {
      const stage = stages[name];
      const s = state(index);
      return <li key={name} className={`flow-stage ${s}`}>
        <span className="flow-label">{stage.label}</span>
        <strong className="flow-value">{stage.value}</strong>
        <span className="flow-note">{stage.note}</span>
        {index < stageNames.length - 1 && <svg className="flow-arrow" viewBox="0 0 24 48" aria-hidden="true"><path d="M2 2 L22 24 L2 46" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/></svg>}
      </li>;
    })}
    {result && <li className="flow-meta">{(result.ranking.latency_ms / 1000).toFixed(1)}s{jevLive && result.ranking.model ? ` · ${result.ranking.model}` : ""}</li>}
  </ol>;
}
