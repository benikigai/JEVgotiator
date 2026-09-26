const syntheticProfile = {
  name: "Maya Rivera",
  tags: ["city commute", "road trips", "trail gear", "dog-friendly", "black + minimal"],
};

// Used only when the API route is unavailable during static previews.
const syntheticListings = [
  { id: "T-301", model: "Model 3", trim: "Long Range AWD · 2023", price: 26700, miles: 31400, color: "Black", value: 92, mileage: 87, year: 86, visual: 94, records: 88, battery: 86, road: 90, social: 86, visualSummary: "12 clear photos · paint, wheels, seats, and panel gaps look exceptionally clean", reasons: ["AWD", "visual report: near-new", "service records"], inspect: false },
  { id: "T-302", model: "Model Y", trim: "Long Range AWD · 2023", price: 34900, miles: 42100, color: "Black", value: 78, mileage: 76, year: 86, visual: 88, records: 83, battery: 84, road: 96, social: 94, visualSummary: "10 clear photos · clean cargo space, minor wheel scuff noted", reasons: ["dog + gear space", "AWD", "road-trip fit"], inspect: false },
  { id: "T-303", model: "Model 3", trim: "RWD · 2024", price: 32200, miles: 18900, color: "Black", value: 80, mileage: 97, year: 100, visual: 91, records: 76, battery: 89, road: 76, social: 80, visualSummary: "14 clear photos · cabin and exterior show minimal visible wear", reasons: ["lowest mileage", "newest year", "city-ready"], inspect: true },
  { id: "T-304", model: "Model Y", trim: "RWD · 2023", price: 31900, miles: 46200, color: "Black", value: 82, mileage: 73, year: 86, visual: 82, records: 72, battery: 79, road: 88, social: 91, visualSummary: "8 photos · clean interior; photo coverage lacks a tire close-up", reasons: ["cargo space", "black exterior", "good value"], inspect: true },
  { id: "T-305", model: "Model 3", trim: "Long Range AWD · 2022", price: 24800, miles: 59500, color: "Black", value: 95, mileage: 60, year: 71, visual: 77, records: 84, battery: 78, road: 88, social: 82, visualSummary: "11 photos · normal wear around driver seat; no visible panel damage", reasons: ["best value", "AWD", "VIN service record"], inspect: true },
  { id: "T-306", model: "Model 3", trim: "RWD · 2023", price: 25900, miles: 52400, color: "White", value: 91, mileage: 67, year: 86, visual: 80, records: 70, battery: 76, road: 74, social: 54, visualSummary: "9 photos · normal wear; interior coverage is limited", reasons: ["value", "2023 model", "records need review"], inspect: true },
];

let listings = syntheticListings;
let dataSource = "synthetic";

const $ = (id) => document.getElementById(id);
const controls = {
  budget: $("budget"), maxMileage: $("maxMileage"), model: $("modelFilter"), blackOnly: $("blackOnly"),
  value: $("valueWeight"), quality: $("qualityWeight"), road: $("roadWeight"), social: $("socialWeight"),
};

function money(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function clamp(value) { return Math.max(0, Math.min(100, value)); }
function bar(name, score) { return `<div class="signal"><span class="signal-name">${name}</span><span class="signal-value">${Math.round(score)}</span><span class="bar"><i style="width:${score}%"></i></span></div>`; }

function readPreferences() {
  return {
    budget: Number(controls.budget.value), maxMileage: Number(controls.maxMileage.value), model: controls.model.value,
    blackOnly: controls.blackOnly.checked, valueWeight: Number(controls.value.value), qualityWeight: Number(controls.quality.value),
    roadWeight: Number(controls.road.value), socialWeight: Number(controls.social.value),
  };
}

function scoreListing(car, prefs) {
  const fixedWeight = 25;
  const total = prefs.valueWeight + prefs.qualityWeight + prefs.roadWeight + prefs.socialWeight + fixedWeight;
  const priceFit = clamp(car.value + ((prefs.budget - car.price) / 800));
  const mileageFit = clamp(car.mileage + ((prefs.maxMileage - car.miles) / 1100));
  const quality = car.visual * .55 + car.records * .25 + car.battery * .20;
  return Math.round((priceFit * prefs.valueWeight + quality * prefs.qualityWeight + car.road * prefs.roadWeight + car.social * prefs.socialWeight + (mileageFit * .45 + car.year * .35 + car.battery * .2) * fixedWeight) / total);
}

function eligible(car, prefs) {
  return car.price <= prefs.budget && car.miles <= prefs.maxMileage && (prefs.model === "any" || car.model === prefs.model) && (!prefs.blackOnly || car.color === "Black");
}

function card(car, rank, score) {
  const color = car.color === "Black" ? "#26282e" : "#f2f2ef";
  const quality = car.visual * .55 + car.records * .25 + car.battery * .20;
  const picture = car.photoUrl ? `<img class="listing-photo" src="${car.photoUrl}" alt="${car.model} listing photo" loading="lazy" />` : "";
  const evidenceLabel = car.live ? "Evidence coverage" : "Looks near-new";
  const listingLink = car.vdpUrl ? `<a class="seller-link" href="${car.vdpUrl}" target="_blank" rel="noreferrer">Open listing ↗</a>` : "";
  return `<article class="listing-card">
    <div class="car-image${car.photoUrl ? " has-photo" : ""}" style="--car:${color}">${picture}<span class="rank">#${String(rank).padStart(2, "0")}</span><span class="car-status">MATCH ${score}</span><i class="wheel left"></i><i class="wheel right"></i></div>
    <h3 class="listing-name">Tesla ${car.model}</h3><p class="listing-trim">${car.trim}</p>
    <div class="price-row"><strong class="price">${money(car.price)}</strong><span class="mileage">${car.miles.toLocaleString()} mi</span></div>
    <div class="signal-list">${bar("Value", car.value)}${bar(evidenceLabel, quality)}${bar("Profile fit", car.social)}</div>
    <p class="evidence-note">${car.visualSummary}</p>
    <div class="match-reasons">${car.reasons.map((reason) => `<span class="reason">${reason}</span>`).join("")}</div>
    <div class="card-bottom"><div><div class="match-score">${score}</div><span class="match-label">weighted match</span></div><div>${listingLink}${car.inspect ? '<span class="inspect-tag">INSPECT</span>' : '<span class="inspect-tag">CLEAR</span>'}</div></div>
  </article>`;
}

function updateHeader() {
  $("headerStatus").innerHTML = dataSource === "marketcheck"
    ? '<span class="live-dot"></span> LIVE MARKETCHECK INVENTORY'
    : '<span class="live-dot"></span> SYNTHETIC PREVIEW';
}

function render({ refreshed = false } = {}) {
  const prefs = readPreferences();
  $("budgetOutput").textContent = money(prefs.budget);
  $("mileageOutput").textContent = `${prefs.maxMileage.toLocaleString()} mi`;
  $("valueWeightOutput").textContent = `${prefs.valueWeight}%`;
  $("qualityWeightOutput").textContent = `${prefs.qualityWeight}%`;
  $("roadWeightOutput").textContent = `${prefs.roadWeight}%`;
  $("socialWeightOutput").textContent = `${prefs.socialWeight}%`;
  $("weightNote").textContent = `History, battery evidence, model year, and mileage account for the remaining ${Math.max(0, 100 - prefs.valueWeight - prefs.qualityWeight - prefs.roadWeight - prefs.socialWeight)}% of the decision.`;

  const ranked = listings.filter((car) => eligible(car, prefs)).map((car) => ({ car, score: scoreListing(car, prefs) })).sort((a, b) => b.score - a.score).slice(0, 5);
  $("resultCount").textContent = String(ranked.length).padStart(2, "0");
  $("listingGrid").innerHTML = ranked.length ? ranked.map(({ car, score }, index) => card(car, index + 1, score)).join("") : `<div class="empty-state">No matches fit every hard filter. Raise the budget, mileage cap, or remove the black-only requirement.</div>`;
  const best = ranked[0];
  const sourceDescription = dataSource === "marketcheck" ? "live MarketCheck inventory" : "simulated inventory";
  $("insightCard").innerHTML = best ? `<span class="insight-score">#01</span><span><strong>Tesla ${best.car.model} is the strongest match.</strong> It wins on ${best.car.reasons.slice(0, 2).join(" and ")}. Its score is recalculated from your live priorities, while condition evidence remains visible.</span>` : `<span class="insight-score">?</span><span><strong>Try loosening a hard filter.</strong> Weight sliders re-rank matches; price, mileage, model, and exterior color remove cars from the set.</span>`;
  $("reRankStatus").textContent = refreshed ? `Re-ranked just now · ${ranked.length} of ${listings.length} ${sourceDescription} listings qualify` : `${ranked.length} of ${listings.length} ${sourceDescription} listings qualify`;
  updateHeader();
}

async function loadLiveListings({ refreshed = false } = {}) {
  const prefs = readPreferences();
  const params = new URLSearchParams({
    zip: "94105", radius: "100", budget: String(prefs.budget), maxMileage: String(prefs.maxMileage),
    model: prefs.model, blackOnly: String(prefs.blackOnly),
  });
  const button = $("refreshButton");
  button.disabled = true;
  button.textContent = "Loading inventory…";
  $("reRankStatus").textContent = "Pulling live MarketCheck inventory…";
  try {
    const response = await fetch(`/api/listings?${params}`);
    if (!response.ok) throw new Error("Inventory API unavailable");
    const payload = await response.json();
    if (!Array.isArray(payload.listings) || payload.listings.length === 0) throw new Error("No live inventory returned");
    listings = payload.listings;
    dataSource = "marketcheck";
  } catch {
    listings = syntheticListings;
    dataSource = "synthetic";
  } finally {
    button.disabled = false;
    button.innerHTML = "<span>↻</span> Refresh matches";
    render({ refreshed });
  }
}

$("profileTags").innerHTML = syntheticProfile.tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
Object.values(controls).forEach((control) => control.addEventListener("input", () => render()));
$("refreshButton").addEventListener("click", () => { loadLiveListings({ refreshed: true }); });
render();
loadLiveListings();
