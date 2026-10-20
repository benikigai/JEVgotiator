"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, CheckCircle2, Clock3, LockKeyhole, LoaderCircle, MessageSquare, Play, Radio, RefreshCw, Zap } from "lucide-react";
import type { ActivityResponse } from "@/lib/activity-contract";
import DecisionTrace from "./decision-trace";
import DealIntelligence from "./deal-intelligence";

const dollars = (value: number | null) => value === null ? "Price unknown" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const time = (value: string | null | undefined) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
const toolLabel = (name: string) => ({ clarify_car_request: "Clarify buyer brief", search_teslas: "Filter inventory and ask Jev", prepare_deal_plan: "Prepare selected-car plan" }[name] || name.replaceAll("_", " "));
type Tool = ActivityResponse["tools"][number];
const stageState = (tool: Tool | undefined, complete: boolean) => tool?.status === "running" ? "running" : tool?.status === "failed" ? "failed" : complete ? "complete" : "waiting";
export default function LiveActivity() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [person, setPerson] = useState("all");
  const [conversation, setConversation] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [showTrace, setShowTrace] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [readingHistory, setReadingHistory] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const [replayStep, setReplayStep] = useState<number | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const isReplay = data?.status === "replay";
  // The public replay holds fictional demo buyers only; the live view keeps its team-phone filter.
  const conversations = (data?.conversations ?? []).filter(item => isReplay || (item.channel === "photon" && ["Ben", "Chris", "Dara"].includes(item.participant_label ?? "") && (person === "all" || item.participant_label === person)));
  const who = (item: ActivityResponse["conversations"][number] | undefined) => item?.participant_label ?? (isReplay ? "Demo buyer" : "Unidentified");
  const requestedConversation = conversation || conversations[0]?.id || "";

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
        // A recorded replay never changes, so it is fetched once instead of polled.
        if (body.status === "replay") return;
      } catch (cause) {
        if (!stopped) setError(cause instanceof Error ? cause.message : "The activity connection is unavailable.");
      }
      if (!stopped) timer = setTimeout(poll, 3000);
    }
    void poll();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [requestedConversation, refresh]);

  const selected = conversations.find(item => item.id === data?.selected_id && (!requestedConversation || item.id === requestedConversation));
  const visibleData = selected ? data : null;
  const allMessages = visibleData?.messages ?? [];
  const allTools = visibleData?.tools ?? [];
  // Replay animation: reveal the recorded run one timestamp at a time.
  const timeline = useMemo(() => [...new Set([...allMessages.map(message => message.created_at), ...allTools.flatMap(tool => [tool.started_at, tool.completed_at])].filter((value): value is string => Boolean(value)).map(value => Date.parse(value)).filter(Number.isFinite))].sort((a, b) => a - b), [visibleData]);
  const cutoff = replayStep === null ? Infinity : timeline[replayStep] ?? Infinity;
  const messages = allMessages.filter(message => !(Date.parse(message.created_at) > cutoff));
  const tools = allTools.filter(tool => !(tool.started_at && Date.parse(tool.started_at) > cutoff)).map(tool => tool.completed_at && Date.parse(tool.completed_at) > cutoff ? { ...tool, status: "running" as const, completed_at: null } : tool);
  const revealed = (name: string) => cutoff === Infinity || tools.some(tool => tool.name === name && tool.status === "completed");
  const search = revealed("search_teslas") ? visibleData?.search : null;
  const optimization = revealed("prepare_deal_plan") ? visibleData?.optimization : null;
  const shownMessages = showHistory ? messages : messages.slice(-6);
  const lastMessage = messages.at(-1)?.id;

  useEffect(() => {
    if (replayStep === null) return;
    const timer = setTimeout(() => setReplayStep(step => step === null || step >= timeline.length - 1 ? null : step + 1), replayStep >= timeline.length - 1 ? 1600 : 1100);
    return () => clearTimeout(timer);
  }, [replayStep, timeline.length]);

  async function enterCode(event: React.FormEvent) {
    event.preventDefault();
    setCodeBusy(true); setCodeError("");
    try {
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "That demo code does not match.");
      if (body.tier !== "team") throw new Error("That code did not unlock team access.");
      setCode(""); setShowCode(false); setConversation(""); setReplayStep(null); setData(null); setRefresh(value => value + 1);
    } catch (cause) { setCodeError(cause instanceof Error ? cause.message : "That demo code does not match."); }
    finally { setCodeBusy(false); }
  }

  useEffect(() => {
    setReplayStep(null);
    setShowHistory(false);
    setReadingHistory(false);
    followLatest.current = true;
  }, [selected?.id]);

  useEffect(() => {
    if (!showHistory && followLatest.current && messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [lastMessage, selected?.id, showHistory, showTrace]);

  function jumpToLatest() {
    setShowHistory(false);
    setReadingHistory(false);
    followLatest.current = true;
    requestAnimationFrame(() => { if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight; });
  }

  const latestTool = (name: string) => tools.findLast(tool => tool.name === name);
  const briefTool = latestTool("clarify_car_request");
  const searchTool = latestTool("search_teslas");
  const planTool = latestTool("prepare_deal_plan");
  const searchPending = searchTool?.status === "running";
  const pipeline = [
    { name: "Brief", state: stageState(briefTool, Boolean(search) || briefTool?.status === "completed"), detail: search ? "Confirmed for search" : briefTool?.status === "completed" ? "Draft clarified" : briefTool?.status === "running" ? "Clarifying request" : "Awaiting buyer request" },
    { name: "Filters", state: stageState(searchTool, Boolean(search)), detail: searchPending ? "Search in progress" : search ? `${search.counts.total.toLocaleString()} → ${search.counts.eligible.toLocaleString()} eligible` : "No filter result yet" },
    { name: "Jev ranking", state: search && !searchPending && searchTool?.status !== "failed" && search.ranking.mode !== "live_jev" ? "unscored" : stageState(searchTool, Boolean(search && search.ranking.mode === "live_jev")), detail: searchPending ? "Awaiting search result" : search ? `${search.counts.scored} scored → ${search.counts.shown} shown` : "No model scores yet" },
    { name: "Dara plan", state: optimization && !optimization.intelligence && planTool?.status !== "running" && planTool?.status !== "failed" ? "draft" : stageState(planTool, Boolean(optimization?.intelligence)), detail: planTool?.status === "running" ? "Preparing selected cars" : optimization?.intelligence ? `${optimization.intelligence.candidates.length} selected cars evaluated` : optimization ? "Draft ready; new Dara plan needed" : "Choose 1–3 after search" },
  ];
  const channel = selected?.channel === "photon" ? "Photon iMessage" : selected?.channel === "http" ? "HTTP operator test" : "Channel unconfirmed";
  if (showTrace && search) return <DecisionTrace result={search} onBack={() => setShowTrace(false)} source={selected ? { label: `${who(selected)} · ${channel}${isReplay ? " · recorded demo run" : ""}`, sessionId: selected.id } : undefined}/>;

  return <div className="activity-workspace">
    <header className="activity-work-header"><div><span className="eyebrow">{isReplay ? "Recorded demo run" : "Observed conversation activity"}</span><h1>{isReplay ? "Replay workbench" : "Live workbench"}</h1></div><div className="activity-header-actions"><span className={`activity-status ${data?.status === "live" && !error ? "connected" : ""}`}><Radio size={12}/>{error ? "Interrupted" : data?.status === "live" ? "Live · 3s refresh" : isReplay ? (replayStep === null ? "Recorded replay" : `Replaying ${replayStep + 1}/${timeline.length}`) : data?.status === "unconfigured" ? "Not configured" : data?.status === "unavailable" ? "Eve unavailable" : "Connecting…"}</span>{isReplay ? <button className="secondary" onClick={() => { setShowHistory(false); followLatest.current = true; setReplayStep(replayStep === null && timeline.length ? 0 : null); }} disabled={!timeline.length} aria-label={replayStep === null ? "Replay this conversation" : "Show the full recorded run"}><Play size={14}/><span>{replayStep === null ? "Replay" : "Skip to end"}</span></button> : <button className="secondary" onClick={() => setRefresh(value => value + 1)} aria-label="Refresh activity"><RefreshCw size={14}/><span>Refresh</span></button>}</div></header>
    {isReplay && <div className="replay-banner" role="note"><LockKeyhole size={16}/><div><strong>Recorded demo run with synthetic data. Live conversations are team-only.</strong><p>Fictional buyers, the bundled synthetic Tesla catalog, and offline stand-ins for Jev’s answers. Press Replay to watch the run unfold. Nothing here contacts a seller.</p>{showCode && <form className="replay-code" onSubmit={enterCode}><label>Team access code<input type="password" value={code} onChange={event => setCode(event.target.value)} placeholder="Enter code" autoComplete="current-password" autoFocus/></label><button className="primary" disabled={codeBusy || !code}>{codeBusy && <LoaderCircle className="spin" size={14}/>}Unlock live view</button><button type="button" className="text-button" onClick={() => { setShowCode(false); setCodeError(""); }}>Cancel</button></form>}{codeError && <p className="replay-code-error" role="alert">{codeError}</p>}</div>{!showCode && <button className="secondary" onClick={() => setShowCode(true)}>Enter team access code</button>}</div>}
    <div className="activity-toolbar"><strong>{isReplay ? "Demo conversations" : "Team demo phones"}</strong>{!isReplay && <label className="activity-session-control">Person<select value={person} onChange={event => { setPerson(event.target.value); setConversation(""); setShowTrace(false); }}><option value="all">Ben, Chris & Dara</option><option value="Ben">Ben</option><option value="Chris">Chris</option><option value="Dara">Dara</option></select></label>}<label className="activity-session-control">Conversation<select value={conversation} onChange={event => { setConversation(event.target.value); setShowTrace(false); }}><option value="">{isReplay ? "Latest demo run" : `Follow latest ${person === "all" ? "team" : person} iMessage`}</option>{conversations.map(item => <option key={item.id} value={item.id}>{who(item)} · {item.title} · {item.id.slice(-8)}</option>)}</select></label></div>
    <div className="activity-context-line"><span>{selected ? `${who(selected)} · ${channel}${isReplay ? " (recorded)" : ""} · session ${selected.id.slice(-8)} · ${selected.status}` : isReplay ? "Loading the recorded demo run" : "Waiting for a team text to Eve"}{data?.fetched_at && ` · ${time(data.fetched_at)}`}</span>{!isReplay && <details><summary>Messaging & reset</summary><p>On a registered phone, text /reset to Eve, then send a Tesla request. The selectors show Ben, Chris, and Dara’s recorded iMessage sessions. Earlier conversations stay available.</p></details>}</div>
    {error && <div className="notice" role="alert">{error} {data && "Last received activity shown."}</div>}
    {data?.warning && <div className="notice">{data.warning}</div>}

    <section className="activity-pipeline" aria-label="Observed workflow stages">{pipeline.map((stage, index) => <div key={stage.name} className={`activity-stage ${stage.state}`}><div><span className="activity-stage-number">{stage.state === "complete" ? <CheckCircle2 size={15}/> : stage.state === "running" ? <LoaderCircle size={15} className="spin"/> : index + 1}</span><strong>{stage.name}</strong><span className="activity-stage-status">{stage.state === "complete" ? "Recorded" : stage.state === "running" ? "Running" : stage.state === "failed" ? "Failed" : stage.state === "unscored" ? "Unscored" : stage.state === "draft" ? "Draft only" : "Waiting"}</span></div><p>{stage.detail}</p></div>)}</section>
    {search && <div className="activity-proof-strip"><span className="data-badge">{search.catalog.mode === "synthetic" ? "Synthetic inventory" : search.catalog.mode === "mixed" ? "Mixed inventory" : "Connected inventory"}</span><span>{search.ranking.mode === "live_jev" ? `${search.ranking.model} · ${search.ranking.latency_ms} ms · $${search.ranking.estimated_cost_usd.toFixed(6)} estimated` : "Model scoring unavailable; results have no AI score."}</span><button className="text-button" onClick={() => setShowTrace(true)}>Inspect exact Jev trace <ArrowUpRight size={15}/></button></div>}

    <div className="activity-grid"><section className="activity-messages"><div className="section-line"><h2><MessageSquare size={16}/>{selected ? `${who(selected)} + Eve` : "Conversation"}</h2><span className="quiet">{messages.length ? `${shownMessages.length} of ${messages.length} messages` : "Waiting for a message"}</span></div>
      {!!messages.length && <div className="activity-history-controls"><button className="text-button" onClick={() => { if (showHistory) jumpToLatest(); else { setShowHistory(true); followLatest.current = false; setReadingHistory(true); requestAnimationFrame(() => { if (messagesRef.current) messagesRef.current.scrollTop = 0; }); } }}>{showHistory ? "Show recent 6" : "Show full history"}</button>{(readingHistory || showHistory) && <button className="text-button" onClick={jumpToLatest}>Latest message <ArrowDown size={12}/></button>}</div>}
      {!messages.length ? <div className="activity-empty"><MessageSquare size={25}/><h3>Waiting for a team text.</h3><p>Text /reset, then “Model Y under $35,000 in San Francisco, under 60,000 miles.”</p></div> : <div className="message-list" ref={messagesRef} onScroll={() => { const node = messagesRef.current; if (!node) return; const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 50; followLatest.current = atBottom && !showHistory; setReadingHistory(!atBottom); }}>{shownMessages.map(message => <article className={`message-bubble ${message.role}`} key={message.id}><div><strong>{message.role === "user" ? (selected ? who(selected) : "Buyer") : "Eve"}</strong><time>{time(message.created_at)}</time></div>{message.text.length > 600 ? <><p>{message.text.slice(0, 600)}…</p><details><summary>Read full message</summary><p>{message.text}</p></details></> : <p>{message.text}</p>}</article>)}</div>}
      <p className="tiny-note">{isReplay ? "Synthetic replay. No real iMessage was sent or received." : "Recorded replies prove generation. A reply on your phone proves delivery."}</p>
    </section>

    <div className="activity-evidence">
      <section className="activity-results"><div className="section-line"><h2><Zap size={16}/>Work & evidence</h2><span className="quiet">This conversation only</span></div>
        {search ? <><div className="activity-shortlist-heading"><strong>{search.counts.shown} shortlisted Teslas</strong><span>From {search.counts.candidates} bounded candidates</span></div>{search.results.map((result, index) => <article className="activity-car" key={result.listing.id}><span className="number-chip">{index + 1}</span><div><strong>{result.listing.year} Tesla {result.listing.model}</strong><small>{result.listing.mileage?.toLocaleString() ?? "Unknown"} miles · {result.listing.mode === "live" ? "INSPECT VIN, battery and condition" : "Synthetic demo listing"}</small></div><div><strong>{dollars(result.listing.price)}</strong><small>{result.score === null ? "Unscored" : `${Math.round(result.score * 100)}% fit`}</small></div></article>)}<button className="primary wide" onClick={() => setShowTrace(true)}>Inspect this conversation’s Jev trace<ArrowUpRight size={15}/></button></> : <div className="activity-waiting-work"><Zap size={22}/><p>Confirm a brief in iMessage to see filter counts, model scores, and the shortlist here.</p></div>}
        <details className="activity-tool-details"><summary>Observed tool calls <span>{tools.length}</span></summary>{tools.length ? tools.map(tool => <div className={`activity-tool ${tool.status}`} key={tool.id}>{tool.status === "running" ? <LoaderCircle size={15} className="spin"/> : tool.status === "completed" ? <CheckCircle2 size={15}/> : <Clock3 size={15}/>}<div><strong>{toolLabel(tool.name)}</strong><small>{tool.status} · {time(tool.completed_at || tool.started_at)}</small></div></div>) : <p>No tool calls recorded yet.</p>}</details>
      </section>
      {optimization && <section className="activity-results activity-compact-plan"><div className="section-line"><h2>Dara & negotiation plan</h2><span className="data-badge">No seller contacted</span></div><p>{optimization.intelligence ? `${optimization.intelligence.candidates.length} selections compared using Dara’s weighted rules.` : "Prepared questions and draft messages. No Dara score recorded."}{optimization.simulation && " Offer timeline is a synthetic simulation."}</p>{optimization.intelligence && <p className="activity-weight-note">Jev’s original evidence score stays visible. Dara’s optional profile lens gives more weight to well-kept evidence and practical driving context; it does not inspect vehicle condition.</p>}{optimization.intelligence && <div className="activity-dara-scores">{optimization.intelligence.candidates.map(candidate => <div key={candidate.listing_id}><span>{optimization.plans.find(plan => plan.listing_id === candidate.listing_id)?.title ?? "Selected car"}</span><strong>{candidate.score}<small>/100</small></strong></div>)}</div>}{optimization.plans.map(plan => <details className="activity-plan" key={plan.listing_id}><summary>{plan.title}<span>{plan.questions.length} questions + draft</span></summary><p>Asking {dollars(plan.asking_price)}</p><ul>{plan.questions.map((question, index) => <li key={index}>{question}</li>)}</ul><h3>Prepared opening message</h3><p className="activity-draft">{plan.opening_message}</p></details>)}</section>}
    </div></div>
    {optimization && (optimization.intelligence || optimization.simulation) && <details className="activity-intelligence-details"><summary>Inspect Dara’s scoring and simulated action timeline <ArrowUpRight size={15}/></summary><DealIntelligence optimization={optimization}/></details>}
  </div>;
}
