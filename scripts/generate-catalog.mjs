import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Fixed seed and dates make the demo export reproducible for Chris's database import.
let state = 20260926;
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 0x100000000;
}
const pick = (values) => values[Math.floor(random() * values.length)];
const integer = (minimum, maximum) => minimum + Math.floor(random() * (maximum - minimum + 1));
const colors = ["white", "black", "gray", "silver", "blue", "red"];
const neighborhoods = ["Sunset", "Richmond", "Mission", "Marina", "Potrero", "SoMa", "Noe Valley", "Bayview", "Bernal", "Excelsior", "Pacific Heights", "Presidio"];
const profiles = [
  { model: "Model 3", firstYear: 2017, base: 36_000, body: "sedan", use: "Compact sedan with a rear camera and folding rear seats; easier to park than the larger Model S and X." },
  { model: "Model Y", firstYear: 2020, base: 42_000, body: "suv", use: "Five-seat crossover with folding rear seats and flexible cargo space for family errands and weekend trips." },
  { model: "Model S", firstYear: 2015, base: 68_000, body: "sedan", use: "Large five-seat liftback with a spacious cargo area. Check garage length and battery condition before purchase." },
  { model: "Model X", firstYear: 2016, base: 75_000, body: "suv", use: "Large electric SUV with distinctive rear doors. Check garage width, door clearance, and seating configuration." },
];

function trimFor(model, year) {
  if (model === "Model 3") {
    if (year <= 2018) return pick(["Long Range RWD", "Long Range AWD"]);
    return pick([year <= 2021 ? "Standard Range Plus" : "Rear-Wheel Drive", "Long Range AWD", "Performance"]);
  }
  if (model === "Model Y") return pick(["Long Range AWD", "Performance", ...(year >= 2023 ? ["Rear-Wheel Drive"] : [])]);
  if (year <= 2016) return pick(["75D", "90D"]);
  if (year <= 2018) return pick(["75D", "100D", "P100D"]);
  return pick(["Long Range", year >= 2021 ? "Plaid" : "Performance"]);
}

const cars = Array.from({ length: 1000 }, (_, index) => {
  const profile = profiles[index % profiles.length];
  const year = integer(profile.firstYear, 2026);
  const age = 2026 - year;
  const trim = trimFor(profile.model, year);
  const mileage = Math.round((age * integer(5_000, 15_000) + integer(400, 12_000)) / 100) * 100;
  const condition = integer(0, 99);
  const accident = condition < 5 ? "Collision damage reported; rebuilt title. Inspection required." : condition < 15 ? "One minor accident reported; repair invoice available." : condition < 35 ? null : "No reported accidents";
  const title = condition < 5 ? "rebuilt" : condition < 20 ? "unknown" : "clean";
  const performancePremium = /Performance|Plaid|P100D/.test(trim) ? 7_000 : /Long Range|100D|90D/.test(trim) ? 2_000 : 0;
  const repairDiscount = condition < 5 ? 0.65 : condition < 15 ? 0.86 : 1;
  const estimated = (profile.base - age * (profile.model === "Model 3" || profile.model === "Model Y" ? 2_050 : 3_900) - mileage * 0.055 + performancePremium + integer(-1800, 1800)) * repairDiscount;
  const price = Math.max(9_000, Math.round(estimated / 100) * 100);
  const maintenanceCase = integer(0, 4);
  const maintenance = [
    "Tire rotation and cabin-filter receipts available. No independent battery-health report supplied.",
    "Recent tire replacement and brake inspection documented in this synthetic listing.",
    "Seller claims service records are available; supporting documents have not been reviewed.",
    null,
    "Recent alignment receipt and annual inspection summary available. Charging hardware inspection remains outstanding.",
  ][maintenanceCase];
  const conditionText = condition < 5 ? "Repaired collision damage and a rebuilt title are disclosed." : condition < 15 ? "Minor repaired body damage is disclosed." : condition < 35 ? "Used condition; accident history has not been supplied." : pick(["Light cosmetic wear is disclosed.", "Seller describes good cosmetic condition.", "Small wheel scuffs and normal interior wear are disclosed."]);
  const statusBucket = index % 100;
  const status = statusBucket < 95 ? "active" : statusBucket < 98 ? "sold" : "unknown";
  const dateCase = integer(0, 9);
  const available = status !== "active" || dateCase < 2 ? null : dateCase === 9 ? "2026-10-20" : dateCase < 6 ? "2026-09-26" : "2026-10-01";
  const number = String(index + 1).padStart(4, "0");
  const sellerType = index % 3 === 0 ? "private" : "dealer";
  return {
    id: `demo-tesla-${number}`, make: "Tesla", model: profile.model, year, trim, price, mileage,
    exterior_color: pick(colors), body_type: profile.body, fuel_type: "electric", city: "San Francisco", photos: [],
    description: `Synthetic demonstration listing ${number}. ${profile.use} ${conditionText} Battery condition, charging performance, and taxes and fees require verification. ${status === "sold" ? "Vehicle is marked sold." : status === "unknown" ? "Seller availability has not been confirmed." : "Advertised as available in this synthetic dataset."}`,
    accident_history: accident, maintenance_history: maintenance, title_status: title,
    seller: { id: `demo-seller-${number}`, name: `Demo ${pick(neighborhoods)} ${sellerType === "dealer" ? "EV Dealer" : "Seller"} ${number}`, type: sellerType, contact_available: false },
    source: "synthetic", listing_url: null, observed_at: "2026-09-26T20:00:00Z", status, available_from: available, mode: "synthetic",
  };
});

const destination = new URL("../data/catalog.json", import.meta.url);
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(destination, `${JSON.stringify(cars, null, 2)}\n`, "utf8");
console.log(`Wrote ${cars.length} synthetic Tesla records to ${fileURLToPath(destination)}`);
