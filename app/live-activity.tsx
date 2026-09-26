"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Clock3, LoaderCircle, MessageSquare, Radio, RefreshCw, Zap } from "lucide-react";
import { activityParticipants, conversationsForParticipant, type ActivityResponse, type ParticipantFilter } from "@/lib/activity-contract";
import DecisionTrace from "./decision-trace";
import DealIntelligence from "./deal-intelligence";

const dollars = (value: number | null) => value === null ? "Price unknown" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const time = (value: string | null | undefined) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
const toolLabel = (name: string) => ({ clarify_car_request: "Clarify the buyer brief", search_teslas: "Filter inventory and ask Jev", prepare_deal_plan: "Prepare a negotiation plan" }[name] || name.replaceAll("_", " "));

export default function LiveActivity() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [conversation, setConversation] = useState("");
  const [participant, setParticipant] = useState<ParticipantFilter>("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [showTrace, setShowTrace] = useState(false);
  const conversations = conversationsForParticipant(data?.conversations ?? [], participant);
  const requestedConversation = conversation || (participant ? conversations[0]?.id : "") || "";

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(`/api/v1/activity${requestedConversation ? `?conversation_id=${encodeURIComponent(requestedConversation)}` : ""}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "The activity connection is unavailable.");
        if (!stopped) { setData(body); setError(""); }
      } catch (cause) {
        if (!stopped) setError(cause instanceof Error ? cause.message : "The activity connection is unavailable.");
      } finally {
        if (!stopped) timer = setTimeout(poll, 3000);
      }
    }
    void poll();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [requestedConversation, refresh]);

  const selected = conversations.find(item => item.id === data?.selected_id && (!requestedConversation || item.id === requestedConversation));
  const visibleData = selected ? data : null;
  const search = visibleData?.search;
  if (showTrace && search) return <DecisionTrace result={search} onBack={() => setShowTrace(false)}/>;

  return <>
    <section className="page-heading compact"><div><span className="eyebrow">THE CONVERSATION, LIVE</span><h1>Text it. Watch it work.</h1><p>Messages, tool activity, and the evidence behind the shortlist.</p></div><button className="secondary" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15}/>Refresh</button></section>
    <div className="activity-connect"><div><Radio size={22}/><div><strong>Text your assigned Eve number</strong><p>Choose a person to follow their messages. Text /reset to start a fresh demo; earlier history stays available.</p></div></div><span className={`activity-status ${data?.status === "live" && !error ? "connected" : ""}`}>{error ? "Connection interrupted" : data?.status === "live" ? "Connected · updates every 3s" : data?.status === "unconfigured" ? "Connection being configured" : data?.status === "unavailable" ? "Eve unavailable" : "Connecting…"}</span></div>
    {error && <div className="notice" role="alert">{error} {data && "The last received activity remains below."}</div>}
    {data?.warning && <div className="notice">{data.warning}</div>}
    <div className="activity-toolbar" style={{ flexWrap: "wrap" }}><label style={{ width: 150 }}>Person<select value={participant} onChange={event => { setParticipant(event.target.value as ParticipantFilter); setConversation(""); setShowTrace(false); }}><option value="">All people</option>{activityParticipants.map(name => <option key={name} value={name}>{name}</option>)}<option value="unknown">Unidentified</option></select></label><label style={{ flex: "1 1 280px" }}>Conversation<select value={conversation} onChange={event => { setConversation(event.target.value); setShowTrace(false); }}><option value="">Follow latest{participant && participant !== "unknown" ? ` for ${participant}` : participant ? " unidentified" : " conversation"}</option>{conversations.map(item => <option key={item.id} value={item.id}>{item.participant_label ?? "Unidentified"} · {item.title} · {item.channel}</option>)}</select></label><span className="quiet">{selected ? `${selected.participant_label ?? "Unidentified"} · ${selected.channel === "photon" ? "Photon iMessage" : selected.channel === "http" ? "HTTP operator test" : "Channel unconfirmed"} · ${selected.status}` : participant ? "No matching conversation loaded" : "Waiting for a conversation"}{data?.fetched_at && ` · synced ${time(data.fetched_at)}`}</span></div>
    <p className="tiny-note">Shared team activity view. Person filters organize recorded conversations; they do not create private accounts. Unmatched participants stay unidentified.</p>
    <div className="activity-grid"><section className="activity-messages"><div className="section-line"><h2><MessageSquare size={17}/>{selected?.participant_label ? `${selected.participant_label}’s conversation` : "Conversation"}</h2><span className="quiet">Recorded by Eve</span></div>{!visibleData?.messages.length ? <div className="activity-empty"><MessageSquare size={28}/><h3>{participant ? "No conversation loaded for this person." : "Your first text starts the demo."}</h3><p>“Find me a Model Y under $35,000 in San Francisco, under 60,000 miles.”</p><p>Confirm Eve’s brief, then choose one to three results.</p></div> : <div className="message-list">{visibleData.messages.map(message => <article className={`message-bubble ${message.role}`} key={message.id}><div><strong>{message.role === "user" ? selected?.participant_label ?? "Buyer" : "Eve"}</strong><time>{time(message.created_at)}</time></div><p>{message.text}</p></article>)}</div>}<p className="tiny-note">A recorded reply confirms Eve generated it. Seeing it arrive on your phone confirms iMessage delivery.</p></section>
    <div className="activity-evidence"><section className="activity-tools"><div className="section-line"><h2><Zap size={17}/>What the agent did</h2><span className="quiet">Observed tool calls</span></div>{!visibleData?.tools.length ? <p className="activity-empty-note">Tool calls appear here when Eve acts on your request.</p> : visibleData.tools.map(tool => <div className={`activity-tool ${tool.status}`} key={tool.id}>{tool.status === "running" ? <LoaderCircle size={17} className="spin"/> : tool.status === "completed" ? <CheckCircle2 size={17}/> : <Clock3 size={17}/>}<div><strong>{toolLabel(tool.name)}</strong><small>{tool.status} · {time(tool.completed_at || tool.started_at)}</small></div></div>)}</section>
    {search && <section className="activity-results"><div className="section-line"><h2>From this conversation</h2><span className="data-badge">{search.catalog.mode === "synthetic" ? "Synthetic inventory" : "Connected inventory"}</span></div><div className="activity-counts"><div><strong>{search.counts.total.toLocaleString()}</strong><span>inventory</span></div><div><strong>{search.counts.eligible}</strong><span>eligible</span></div><div><strong>{search.counts.scored}</strong><span>Jev scored</span></div><div><strong>{search.counts.shown}</strong><span>matches</span></div></div><p className="tiny-note">{search.ranking.mode === "live_jev" ? `Live ${search.ranking.model} · ${search.ranking.latency_ms} ms · $${search.ranking.estimated_cost_usd.toFixed(6)} estimated` : "Jev scoring unavailable. Results are explicitly unscored."}</p>{search.results.map((result, index) => <article className="activity-car" key={result.listing.id}><span className="number-chip">{index + 1}</span><div><strong>{result.listing.year} Tesla {result.listing.model}</strong><small>{result.listing.mileage?.toLocaleString() ?? "Unknown"} miles · {result.listing.trim || "Trim unconfirmed"}</small></div><div><strong>{dollars(result.listing.price)}</strong><small>{result.score === null ? "Unscored" : `${Math.round(result.score * 100)}% fit`}</small></div></article>)}<button className="primary wide" onClick={() => setShowTrace(true)}>Inspect this conversation’s Jev trace<ArrowUpRight size={15}/></button></section>}
    {visibleData?.optimization && <section className="activity-results"><div className="section-line"><h2>Negotiation plan</h2><span className="data-badge">{visibleData.optimization.mode === "planning" ? "Prepared · no seller contacted" : visibleData.optimization.status}</span></div><p>{visibleData.optimization.summary}</p>{visibleData.optimization.plans.map(plan => <article className="activity-plan" key={plan.listing_id}><h3>{plan.title}</h3><p>Asking {dollars(plan.asking_price)}</p><ul>{plan.questions.map((question, index) => <li key={index}>{question}</li>)}</ul><details><summary>Prepared opening message</summary><p>{plan.opening_message}</p></details></article>)}</section>}
    </div></div>
    {visibleData?.optimization && <DealIntelligence optimization={visibleData.optimization}/>}
  </>;
}
