"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Check, GitBranch, Image, RotateCcw, ShieldCheck, Sparkles, UserRound, Workflow } from "lucide-react";
import type { DaraIntelligence, Optimization } from "@/lib/contracts";
import { defaultMatchWeights, type MatchWeights } from "@/lib/profile-match";
import NegotiationTimeline from "./negotiation-timeline";

const signalNames = { value: "Value", evidence: "Evidence coverage", road_trip: "Road-trip heuristic", model_fit: "Model-fit heuristic", mileage_year_battery: "Mileage / year / battery" };

function BuyerLens({ intelligence, title, weights, setWeights }: { intelligence: DaraIntelligence; title: (id: string) => string; weights: MatchWeights; setWeights: Dispatch<SetStateAction<MatchWeights>> }) {
  const remaining = Math.max(0, 100 - weights.value - weights.evidence - weights.road_trip - weights.model_fit);
  const total = Math.max(1, remaining + weights.value + weights.evidence + weights.road_trip + weights.model_fit);
  const candidates = useMemo(() => intelligence.candidates.map(candidate => ({
    ...candidate,
    lensScore: Math.round((
      candidate.signals.value * weights.value +
      candidate.signals.evidence * weights.evidence +
      candidate.signals.road_trip * weights.road_trip +
      candidate.signals.model_fit * weights.model_fit +
      candidate.signals.mileage_year_battery * remaining
    ) / total),
  })).sort((a, b) => b.lensScore - a.lensScore || a.listing_id.localeCompare(b.listing_id)), [intelligence.candidates, remaining, total, weights]);
  const lead = candidates[0];
  const change = (key: keyof MatchWeights, value: number) => setWeights(current => ({ ...current, [key]: value }));
  const controls: { key: keyof MatchWeights; label: string; hint: string }[] = [
    { key: "value", label: "Value", hint: "Price against the agreed budget" },
    { key: "evidence", label: "Looks near-new", hint: "Photo coverage + records; not a condition guarantee" },
    { key: "road_trip", label: "Road-trip ready", hint: "Model heuristic for longer drives" },
    { key: "model_fit", label: "Lifestyle fit", hint: "Synthetic profile only" },
  ];

  return <section className="buyer-lens" aria-labelledby="buyer-lens-title">
    <div className="buyer-lens-top">
      <div>
        <span className="eyebrow">AUTOMUSE × JEVGOTIATOR</span>
        <h2 id="buyer-lens-title"><Sparkles size={20}/>Carry your lens into the deal.</h2>
        <p>Use a synthetic buyer profile to tune how your selected cars compare. The lens never overrides price, title, battery evidence, or the buyer’s stated limits.</p>
      </div>
      <button className="lens-reset" type="button" onClick={() => setWeights(defaultMatchWeights)}><RotateCcw size={14}/>Reset lens</button>
    </div>

    <div className="buyer-lens-grid">
      <article className="buyer-profile-card">
        <div className="profile-card-heading"><span className="lens-avatar">M</span><div><span className="eyebrow">SYNTHETIC PROFILE</span><h3>Maya Rivera</h3></div></div>
        <p className="profile-role">Bay Area designer · profile generated for this demo</p>
        <blockquote>“Weekday errands should be easy. Weekends should fit a dog, trail gear, and a long drive.”</blockquote>
        <div className="profile-tags"><span>city commute</span><span>road trips</span><span>trail gear</span><span>dog-friendly</span><span>black + minimal</span></div>
        <div className="profile-boundary"><UserRound size={16}/><p><strong>How it is used</strong>Low-stakes lifestyle context only. It informs the Lifestyle fit control and cannot create evidence about a car.</p></div>
      </article>

      <article className="lens-controls">
        <div className="lens-controls-heading"><div><span className="eyebrow">TUNE THE MATCH</span><h3>What matters more?</h3></div><span>{remaining}%<small>fixed evidence</small></span></div>
        <div className="lens-control-list">
          {controls.map(control => <label key={control.key}>
            <span><strong>{control.label}</strong><small>{control.hint}</small></span>
            <output>{weights[control.key]}%</output>
            <input aria-label={`${control.label} importance`} type="range" min="0" max="60" value={weights[control.key]} onChange={event => change(control.key, Number(event.target.value))}/>
          </label>)}
        </div>
        <div className="lens-evidence-note"><Image size={15}/><span>“Looks near-new” combines listing photo coverage and records. It cannot confirm hidden damage, tire condition, or battery health.</span></div>
      </article>
    </div>

    <div className="lens-results-heading"><div><span className="eyebrow">SELECTED-CAR RE-RANK</span><h3>{lead ? `${title(lead.listing_id)} is the strongest match for this lens.` : "Set a lens to compare your cars."}</h3></div><span>Updates instantly</span></div>
    <div className="lens-results">
      {candidates.map((candidate, index) => <article className="lens-result" key={candidate.listing_id}>
        <div className="lens-result-top"><span className="number-chip">{String(index + 1).padStart(2, "0")}</span><span className="lens-original">Jev shortlist #{candidate.rank}</span><strong>{candidate.lensScore}<small>/ 100</small></strong></div>
        <h4>{title(candidate.listing_id)}</h4>
        <div className="lens-mini-signals"><span>Value <i style={{ width: `${candidate.signals.value}%` }}/></span><span>Evidence <i style={{ width: `${candidate.signals.evidence}%` }}/></span><span>Profile <i style={{ width: `${candidate.signals.model_fit}%` }}/></span></div>
        <p>{index === 0 ? "Best fit for these priorities." : "Compare before you make a final choice."}</p>
      </article>)}
    </div>
    <p className="lens-disclosure">This panel re-ranks only the cars you selected. Jev’s original shortlist, evidence trace, and the existing deal plan stay intact.</p>
  </section>;
}

export default function DealIntelligence({ optimization, weights: sharedWeights, setWeights: setSharedWeights }: { optimization: Omit<Optimization, "job_token">; weights?: MatchWeights; setWeights?: Dispatch<SetStateAction<MatchWeights>> }) {
  const [localWeights, setLocalWeights] = useState<MatchWeights>(defaultMatchWeights);
  const weights = sharedWeights || localWeights;
  const setWeights = setSharedWeights || setLocalWeights;
  const { intelligence, simulation, plans } = optimization;
  if (!intelligence && !simulation) return null;
  const title = (id: string) => plans.find(plan => plan.listing_id === id)?.title || id;
  return <div className="intelligence-stack">
    {intelligence && <BuyerLens intelligence={intelligence} title={title} weights={weights} setWeights={setWeights}/>}
    {intelligence && <section className="intelligence-panel"><div className="section-line"><h2><ShieldCheck size={19}/>Evidence behind the original plan</h2><a className="text-button" href={`https://github.com/benikigai/JEVgotiator/commit/${intelligence.source_commit}`} target="_blank" rel="noreferrer"><GitBranch size={13}/>Dara’s scoring logic</a></div><p className="intelligence-method">Jev’s shortlist is preserved here. These are the original Dara signals used when the selected deal plan was prepared.</p><div className="intelligence-candidates">{intelligence.candidates.map(candidate => <article className="intelligence-candidate" key={candidate.listing_id}><div className="intelligence-candidate-top"><span className="number-chip">{candidate.rank}</span><h3>{title(candidate.listing_id)}</h3><strong>{candidate.score}<small>/ 100</small></strong></div><div className="intelligence-signals">{Object.entries(candidate.signals).map(([name, score]) => <div key={name}><span>{signalNames[name as keyof typeof signalNames]}</span><div><i style={{ width: `${Math.max(0, Math.min(100, score))}%` }}/></div><strong>{Math.round(score)}</strong></div>)}</div><details><summary>Evidence gaps and assumptions</summary><ul>{candidate.unknowns.map((unknown, index) => <li key={index}>{unknown}</li>)}</ul></details></article>)}</div><details className="intelligence-assumptions"><summary>Inspect the scoring method</summary><p>{intelligence.method}</p><ul>{intelligence.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul></details></section>}
    {simulation && <section className="intelligence-panel scenario-panel"><div className="section-line"><h2><Workflow size={19}/>Action layer</h2><span className="scenario-badge">Practice negotiation, not real offers</span></div><p className="intelligence-method">A practice run for the selected demo cars. Every price below is an assumption, not a seller quote.</p><NegotiationTimeline candidates={simulation.candidates} title={title}/><div className="scenario-actions">{simulation.actions.map((action, index) => <div className={`scenario-action ${action.state}`} key={index}><span>{action.state === "done" ? <Check size={13}/> : index + 1}</span><div><strong>{action.label}</strong><p>{action.detail}</p></div></div>)}</div><details className="intelligence-assumptions"><summary>Scenario assumptions and comparison</summary>{simulation.assumptions.map((assumption, index) => <p key={index}>{assumption}</p>)}{simulation.candidates.map(candidate => <p key={candidate.listing_id}><strong>{title(candidate.listing_id)}:</strong> {candidate.recommendation}</p>)}</details><p className="scenario-disclaimer">{simulation.disclaimer}</p></section>}
  </div>;
}
