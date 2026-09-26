"use client";

import type { Brief } from "@/lib/contracts";
import type { MatchWeights } from "@/lib/profile-match";

type Props = {
  brief: Brief;
  weights: MatchWeights;
  update: <K extends keyof Brief>(key: K, value: Brief[K]) => void;
  setWeights: React.Dispatch<React.SetStateAction<MatchWeights>>;
  refresh: () => void;
  busy: boolean;
  filtersChanged: boolean;
  hasResults: boolean;
};

export default function BuyerProfileMatch({ brief, weights, update, setWeights, refresh, busy, filtersChanged, hasResults }: Props) {
  const weightControls: { key: keyof MatchWeights; label: string }[] = [
    { key: "value", label: "Value" },
    { key: "evidence", label: "Evidence coverage" },
    { key: "road_trip", label: "Road-trip fit" },
    { key: "model_fit", label: "Profile fit" },
  ];
  return <div className="buyer-match-stack">
    <section className="buyer-profile-panel" aria-labelledby="buyer-profile-heading">
      <div className="buyer-panel-top"><span className="eyebrow">Buyer profile</span><span className="profile-demo-tag">Synthetic profile</span></div>
      <h2 id="buyer-profile-heading">Meet Maya. Not a real person.</h2>
      <div className="buyer-profile-body"><div className="buyer-identity"><span className="buyer-avatar">M</span><div><strong>Maya Rivera</strong><small>Bay Area designer · generated for this demo</small></div></div><div className="buyer-lifestyle"><blockquote>“Weekday errands should be easy. Weekends should fit a dog, trail gear, and a long drive.”</blockquote><div className="buyer-tags"><span>city commute</span><span>road trips</span><span>trail gear</span><span>dog-friendly</span><span>black + minimal</span></div></div><p className="buyer-profile-note"><strong>How this is used</strong>Profile fit is a model heuristic for this synthetic buyer. It cannot override price, title, safety, battery evidence, or your explicit filters. No personal social data is used.</p></div>
    </section>
    <section className="buyer-tune-panel" aria-labelledby="buyer-tune-heading">
      <div className="buyer-panel-top"><div><span className="eyebrow">Tune the match</span><h2 id="buyer-tune-heading">What matters more?</h2></div><button className="primary" onClick={refresh} disabled={busy}>{busy ? "Refreshing…" : "Refresh matches"}</button></div>
      <div className="buyer-filter-grid"><label>Tesla model<select value={brief.model || ""} onChange={event => update("model", event.target.value as Brief["model"])}><option value="">Any Tesla</option>{["Model 3", "Model Y", "Model S", "Model X", "Cybertruck", "Roadster"].map(model => <option key={model}>{model}</option>)}</select></label><label>Maximum {brief.budget_basis === "out_the_door" ? "out-the-door budget" : "advertised price"} <strong>${brief.budget.toLocaleString()}</strong><input type="range" min="24000" max="60000" step="1000" value={Math.max(24000, Math.min(60000, brief.budget))} onChange={event => update("budget", Number(event.target.value))}/><span className="buyer-range-ends">$24k <span>$60k</span></span></label><label>Maximum mileage <strong>{brief.max_mileage === null ? "Any" : `${brief.max_mileage.toLocaleString()} mi`}</strong><input type="range" min="20000" max="100000" step="5000" value={brief.max_mileage ?? 100000} onChange={event => update("max_mileage", Number(event.target.value))}/><span className="buyer-range-ends">20k <span>100k</span></span></label><label className="buyer-color-toggle"><input type="checkbox" checked={brief.color.toLowerCase() === "black"} onChange={event => update("color", event.target.checked ? "black" : "")}/>Black exterior only</label></div>
      <div className="buyer-weight-grid">{weightControls.map(({ key, label }) => <label key={key}>{label}<strong>{weights[key]} points</strong><input type="range" min="0" max="50" step="1" value={weights[key]} onChange={event => setWeights(old => ({ ...old, [key]: Number(event.target.value) }))}/></label>)}</div>
      <p className="buyer-tune-note">Evidence coverage counts photos and reported title status; it does not inspect condition. Mileage, year, and an unknown-battery baseline retain 25 points. We normalize the total as you tune. These weights reorder the five returned cars; Jev’s original scores and trace remain available.</p>
      {hasResults && filtersChanged && <p className="buyer-refresh-note" role="status">Filters changed. Refresh matches to apply them to the inventory.</p>}
    </section>
  </div>;
}
