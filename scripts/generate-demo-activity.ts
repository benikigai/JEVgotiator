// Generates data/demo-activity.json: the recorded demo run shown to public (non-team) sessions.
// Everything here is synthetic. It uses the bundled synthetic catalog, the real filter and
// deal-planning code, and deterministic offline stand-ins for Jev's Noul answers. It never
// reads the live Eve feed and never makes a network call.
//
//   npx tsx scripts/generate-demo-activity.ts
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { briefSchema, type Brief } from "../lib/contracts";
import { filterCars, loadCatalog } from "../lib/catalog";
import { rankCars } from "../lib/jev";
import { createOptimization } from "../lib/optimization";
import { replayActivityFrom } from "../lib/activity";

for (const name of ["CATALOG_API_URL", "MARKETCHECK_API_KEY", "AI_GATEWAY_API_KEY", "EVE_AGENT_URL", "EVE_API_KEY", "DARA_API_URL"]) delete process.env[name];
process.env.TYPESAFE_API_KEY = "offline-synthetic-fixture";

// Deterministic, offline stand-in for Jev. Probability rises with evidence that matches the brief.
let currentKeywords: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!String(input).startsWith("https://api.typesafe.ai/")) throw new Error(`Blocked network call to ${String(input)}`);
  const body = JSON.parse(String(init?.body));
  const answers: Record<string, { type: "noul"; noul: number }> = {};
  for (const [id, question] of Object.entries(body.questions as Record<string, { instructions: string }>)) {
    const index = Number(id.split("_")[1]);
    const listing = body.state.listings[index] as Record<string, unknown>;
    const text = JSON.stringify(listing).toLowerCase();
    const jitter = createHash("sha256").update(`${id}:${listing.id}`).digest()[0] / 255;
    let noul: number;
    if (id.startsWith("maintenance_")) noul = /service|record|receipt|replaced|rotation/.test(String(listing.maintenance_history).toLowerCase()) ? 0.72 + jitter * 0.22 : 0.18 + jitter * 0.2;
    else noul = Math.min(0.97, 0.42 + currentKeywords.filter((word) => text.includes(word)).length * 0.11 + jitter * 0.16);
    answers[id] = { type: "noul", noul: Math.round(noul * 1000) / 1000 };
    void question;
  }
  const input_tokens = Math.round(JSON.stringify(body).length / 3.6);
  return new Response(JSON.stringify({ model: "jev-1.13.0", answers, usage: { input_tokens, output_tokens: Object.keys(answers).length * 2 } }), { status: 200 });
}) as typeof fetch;

type Step =
  | { at: number; role: "user" | "assistant"; text: string }
  | { at: number; tool: "clarify_car_request" | "search_teslas" | "prepare_deal_plan"; seconds: number };

type Scenario = { id: string; title: string; brief: Brief; keywords: string[]; pick: number[]; start: string; latency: number; script: (ctx: Ctx) => Step[] };
type Ctx = { shortlist: string[]; counts: { total: number; eligible: number }; plan: string[]; openings: string[] };

const money = (value: number | null) => value === null ? "price unknown" : `$${value.toLocaleString("en-US")}`;

const scenarios: Scenario[] = [
  {
    id: "wrun_01DEMOREPLAYM3COMMUTER0001", title: "Black Model 3 commuter under $28k", start: "2026-09-26T19:40:05Z", latency: 731,
    keywords: ["black", "commut", "model 3", "maintenance", "service", "park", "efficien"],
    pick: [0, 1],
    brief: briefSchema.parse({ query: "A black Tesla Model 3 under $28,000 for commuting in San Francisco, under 60,000 miles. Documented maintenance matters.", budget: 28000, budget_basis: "advertised_price", city: "San Francisco", min_year: 2019, max_mileage: 60000, model: "Model 3", color: "black", needed_by: null, priority: "best_fit" }),
    script: ({ shortlist, counts, plan, openings }) => [
      { at: 0, role: "user", text: "Hi Eve, looking for a used black Model 3 in SF for my commute. Under 28k, not too many miles." },
      { at: 3, tool: "clarify_car_request", seconds: 2 },
      { at: 6, role: "assistant", text: "Happy to help. I have: Tesla Model 3, black, San Francisco, budget $28,000. Two quick checks: does $28,000 cover the listed price or the total with tax and fees? And what is your mileage ceiling?" },
      { at: 41, role: "user", text: "Listed price is fine. Under 60k miles, 2019 or newer. Service records would be nice." },
      { at: 44, tool: "clarify_car_request", seconds: 2 },
      { at: 47, role: "assistant", text: "Got it: black Model 3, 2019 or newer, under 60,000 miles, up to $28,000 advertised price, maintenance records preferred. Shall I search?" },
      { at: 63, role: "user", text: "Yes please" },
      { at: 65, tool: "search_teslas", seconds: 1 },
      { at: 67, role: "assistant", text: `I checked ${counts.total.toLocaleString()} listings; ${counts.eligible} meet your limits. Jev reviewed the evidence and here are the top 5:\n${shortlist.join("\n")}\nReply with 1 to 3 numbers to compare and prepare a deal plan. All listings are demo data and need verification.` },
      { at: 112, role: "user", text: "1 and 2" },
      { at: 114, tool: "prepare_deal_plan", seconds: 1 },
      { at: 116, role: "assistant", text: `Plan ready for your two picks:\n${plan.join("\n")}\n\nDraft opening message for #1:\n"${openings[0]}"\n\nNothing has been sent. No seller has been contacted, and no offer or deposit is authorized.` },
      { at: 140, role: "user", text: "Perfect, thanks" },
      { at: 142, role: "assistant", text: "Anytime. Text /reset to start a new search." },
    ],
  },
  {
    id: "wrun_01DEMOREPLAYMYFAMILY000002", title: "Family Model Y, clean title, low mileage", start: "2026-09-26T18:15:30Z", latency: 812,
    keywords: ["model y", "seat", "cargo", "family", "clean", "no reported accidents", "suv"],
    pick: [0, 1, 2],
    brief: briefSchema.parse({ query: "A Model Y for a family of four in San Francisco, under $36,000, clean title and no reported accidents. Lowest mileage first.", budget: 36000, budget_basis: "advertised_price", city: "San Francisco", min_year: 2020, max_mileage: null, model: "Model Y", clean_title: true, no_reported_accidents: true, needed_by: "2026-10-31", priority: "low_mileage" }),
    script: ({ shortlist, counts, plan }) => [
      { at: 0, role: "user", text: "We need a Model Y for the family. Max 36k. Has to have a clean title and no accidents." },
      { at: 3, tool: "clarify_car_request", seconds: 2 },
      { at: 6, role: "assistant", text: "Understood: Tesla Model Y in San Francisco, up to $36,000, clean title, no reported accidents. When do you need the car, and should I favour lowest price or lowest mileage?" },
      { at: 52, role: "user", text: "By end of October. Lowest mileage. 2020 or newer." },
      { at: 55, tool: "clarify_car_request", seconds: 2 },
      { at: 58, role: "assistant", text: "Brief: Model Y, 2020+, up to $36,000 advertised, clean title, no reported accidents, needed by 2026-10-31, ranked with low mileage weighted. Searching now." },
      { at: 60, tool: "search_teslas", seconds: 1 },
      { at: 62, role: "assistant", text: `${counts.eligible} of ${counts.total.toLocaleString()} listings pass your limits. Top 5 after Jev's evidence review, with mileage weighted:\n${shortlist.join("\n")}\nPick up to 3 and I'll prepare questions and opening messages.` },
      { at: 131, role: "user", text: "Let's do 1, 2 and 3" },
      { at: 133, tool: "prepare_deal_plan", seconds: 1 },
      { at: 135, role: "assistant", text: `Compared your three picks with Dara's weighted rules:\n${plan.join("\n")}\n\nFor each car I prepared questions on availability, VIN, title, battery warranty and an itemized out-the-door total, plus a nonbinding opening message. Nothing was sent.` },
    ],
  },
  {
    id: "wrun_01DEMOREPLAYUNDER25K000003", title: "Any Tesla under $25k", start: "2026-09-26T17:02:10Z", latency: 688,
    keywords: ["model 3", "efficien", "commut", "park", "maintenance"],
    pick: [],
    brief: briefSchema.parse({ query: "Cheapest sensible Tesla in San Francisco under $25,000.", budget: 25000, budget_basis: "out_the_door", city: "San Francisco", min_year: null, max_mileage: 90000, needed_by: null, priority: "lowest_price" }),
    script: ({ shortlist, counts }) => [
      { at: 0, role: "user", text: "What's the cheapest decent Tesla I can get in SF? 25k all in." },
      { at: 3, tool: "clarify_car_request", seconds: 2 },
      { at: 6, role: "assistant", text: "Budget $25,000 out the door, any Tesla model, San Francisco. Any mileage limit? Taxes and fees are not in listing prices, so I'll flag that each total needs a quote." },
      { at: 30, role: "user", text: "Under 90k miles" },
      { at: 32, tool: "search_teslas", seconds: 1 },
      { at: 34, role: "assistant", text: `${counts.eligible} of ${counts.total.toLocaleString()} listings fit. Ranked with price weighted:\n${shortlist.join("\n")}\nReminder: your budget is out the door, so an itemized quote is needed before any car truly fits. Reply with numbers to compare.` },
    ],
  },
];

const iso = (start: string, seconds: number) => new Date(Date.parse(start) + seconds * 1000).toISOString().replace(".000Z", "Z");

async function build() {
  const catalog = await loadCatalog({ syntheticOnly: true });
  const conversations = [];
  const runs: Record<string, unknown> = {};
  for (const scenario of scenarios) {
    if (!/^wrun_[A-Za-z0-9]{26}$/.test(scenario.id)) throw new Error(`Bad conversation id ${scenario.id}`);
    const { brief } = scenario;
    const filtered = filterCars(catalog.cars, brief);
    const candidates = [...filtered.eligible].sort((a, b) => brief.priority === "low_mileage" ? (a.mileage ?? Infinity) - (b.mileage ?? Infinity) : (a.price ?? Infinity) - (b.price ?? Infinity)).slice(0, 30);
    currentKeywords = scenario.keywords;
    const ranked = await rankCars(candidates, brief);
    if (ranked.mode !== "live_jev" || !ranked.trace) throw new Error("Offline ranking did not score");
    const results = ranked.results.slice(0, 5);
    const ctxShortlist = results.map((r, i) => `${i + 1}. ${r.listing.year} Model ${r.listing.model.replace("Model ", "")} · ${money(r.listing.price)} · ${r.listing.mileage?.toLocaleString() ?? "?"} mi · ${r.listing.exterior_color ?? "color unconfirmed"} · ${Math.round(r.score! * 100)}% fit`);
    const selected = scenario.pick.map((i) => results[i].listing);
    const optimization = selected.length ? createOptimization(selected, brief) : null;
    const plan = optimization?.intelligence?.candidates.map((c) => {
      const p = optimization.plans.find((x) => x.listing_id === c.listing_id)!;
      return `#${c.rank} ${p.title} · ${money(p.asking_price)} · Dara score ${c.score}/100`;
    }) ?? [];
    const steps = scenario.script({ shortlist: ctxShortlist, counts: { total: catalog.cars.length, eligible: filtered.eligible.length }, plan, openings: (optimization?.intelligence?.candidates ?? []).map((c) => optimization!.plans.find((p) => p.listing_id === c.listing_id)!.opening_message) });
    const searchStep = steps.find((s) => "tool" in s && s.tool === "search_teslas")!;
    const createdAt = iso(scenario.start, searchStep.at + 1);
    const trace = { ...ranked.trace, returned_model: "jev-1.13.0", note: "Recorded demo run with synthetic data. These Noul answers are deterministic values generated offline for the replay, not a live Jev response. The trace shows the same questions and arithmetic the live path uses." };
    const { results: _r, ...rankingMeta } = ranked;
    const search = {
      session_id: `replay-${scenario.id.slice(-6).toLowerCase()}`, created_at: createdAt, brief,
      results: results.map((r) => ({
        listing: { id: r.listing.id, make: r.listing.make, model: r.listing.model, year: r.listing.year, price: r.listing.price, mileage: r.listing.mileage, exterior_color: r.listing.exterior_color, city: r.listing.city, mode: r.listing.mode, listing_url: r.listing.listing_url },
        score: r.score === null ? null : Math.round(r.score * 10000) / 10000, reasons: r.reasons, unknowns: r.unknowns, verification_required: r.verification_required,
      })),
      counts: { total: catalog.cars.length, eligible: filtered.eligible.length, candidates: candidates.length, scored: candidates.length, shown: results.length },
      ranking: { ...rankingMeta, model: "jev-1.13.0", latency_ms: scenario.latency, warning: "Recorded demo run: Jev answers here are synthetic replay values, not a live model call.", trace },
      catalog: { mode: catalog.mode, warnings: [...catalog.warnings, ...filtered.warnings] },
    };
    let n = 0;
    const messages: unknown[] = [];
    const tools: unknown[] = [];
    for (const step of steps) {
      if ("tool" in step) tools.push({ id: `tool_${scenario.id.slice(-4)}_${++n}`, name: step.tool, status: "completed", started_at: iso(scenario.start, step.at), completed_at: iso(scenario.start, step.at + step.seconds) });
      else messages.push({ id: `msg_${scenario.id.slice(-4)}_${++n}`, role: step.role, text: step.text, created_at: iso(scenario.start, step.at) });
    }
    const last = steps.at(-1)!;
    conversations.push({ id: scenario.id, title: scenario.title, channel: "photon", status: optimization ? "completed" : "waiting", created_at: iso(scenario.start, 0), updated_at: iso(scenario.start, last.at) });
    runs[scenario.id] = {
      messages, tools, search,
      optimization: optimization ? { id: optimization.id, mode: optimization.mode, status: optimization.status, summary: optimization.summary, plans: optimization.plans, warning: optimization.warning, simulation: optimization.simulation, intelligence: optimization.intelligence } : null,
    };
  }
  const fixture = {
    $comment: "Synthetic recorded demo run for public sessions. Generated by scripts/generate-demo-activity.ts from data/catalog.json. Fictional buyers; no real conversation content.",
    source: "eve", status: "replay", fetched_at: "2026-09-26T20:00:00Z",
    warning: null,
    conversations, // newest first, like the live feed
    runs,
  };
  for (const conversation of fixture.conversations) replayActivityFrom(fixture, conversation.id);
  writeFileSync(path.join(process.cwd(), "data", "demo-activity.json"), `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`Wrote ${fixture.conversations.length} replay conversations.`);
}

void build();
