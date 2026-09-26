import fixture from "../data/catalog.json";
import type { Brief, Car, Catalog } from "./contracts";

const MAX_RECORDS = 5_000;
const MAX_RESPONSE_BYTES = 8_000_000;
const LIVE_PROVIDERS = new Set(["fb_marketplace", "facebook_marketplace", "carmax", "carvana", "dealer", "local_dealer", "tesla", "marketcheck"]);
let marketcheckCache: { until: number; records: unknown[]; total: number } | null = null;
type Row = Record<string, unknown>;
const object = (value: unknown): Row => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 160): string => typeof value === "string" ? value.trim().slice(0, max) : "";
const key = (value: unknown): string => text(value).toLowerCase().replace(/[\s-]+/g, "_");
const numeric = (value: unknown, max: number): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
const optionalText = (value: unknown, max = 160): string | null => redact(text(value, max)) || null;

function redact(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[contact withheld]")
    .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, (match) => match.replace(/\D/g, "").length >= 10 ? "[contact withheld]" : match);
}

function publicUrl(value: unknown): string | null {
  try {
    const url = new URL(text(value, 2_000));
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || /^(localhost|127\.|example\.)/.test(url.hostname)) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

function date(value: unknown): string | null {
  const candidate = text(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(candidate)) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate.slice(0, 10) ? null : candidate.slice(0, 10);
}

function providerOf(raw: Row): string {
  return key(typeof raw.source === "string" ? raw.source : object(raw.source).provider) || "unknown";
}

/** Adapt Chris's USD/miles records, the original cents fixture, or our public Car shape. */
export function normalizeCar(value: unknown): Car | null {
  const raw = object(value);
  const location = object(raw.location);
  const seller = object(raw.seller);
  const history = object(raw.history);
  const availability = object(raw.availability);
  const source = object(raw.source);
  const money = object(raw.price);
  const id = text(raw.id ?? raw.listing_id, 120);
  const make = optionalText(raw.make, 80);
  const model = optionalText(raw.model, 80);
  const year = numeric(raw.year, 2027);
  const city = optionalText(raw.city ?? location.city, 80);
  if (!id || !make || !model || year === null || !Number.isInteger(year) || year < 1980 || !city) return null;
  if (money.currency && money.currency !== "USD") return null;

  const cents = numeric(money.advertised_price_cents, 500_000_000);
  const price = typeof raw.price === "object" ? (cents === null ? null : cents / 100) : numeric(raw.price, 5_000_000);
  const provider = providerOf(raw);
  const synthetic = raw.mode === "synthetic" || /synthetic|fixture|demo/.test(provider);
  const mode = synthetic ? "synthetic" : raw.mode === "live" && LIVE_PROVIDERS.has(provider) ? "live" : "replay";
  const status = key(raw.status ?? availability.status);
  const observed = text(raw.observed_at ?? source.last_observed_at ?? raw.listed_at, 40);
  const photos = Array.isArray(raw.photos) ? raw.photos.slice(0, 20).map(publicUrl).filter((url): url is string => url !== null) : [];

  return {
    id, make, model, year, trim: optionalText(raw.trim), price,
    mileage: numeric(raw.mileage ?? raw.mileage_miles, 2_000_000),
    exterior_color: optionalText(raw.exterior_color ?? raw.color, 40),
    body_type: optionalText(raw.body_type, 40), fuel_type: optionalText(raw.fuel_type, 40), city,
    photos, description: redact(text(raw.description ?? source.raw_text, 3_000)),
    accident_history: optionalText(raw.accident_history ?? history.accident_status, 1_000),
    maintenance_history: optionalText(raw.maintenance_history ?? history.maintenance_status, 1_000),
    title_status: key(raw.title_status ?? history.title_status) || "unknown",
    seller: {
      id: text(seller.id ?? seller.seller_id, 120) || `seller:${id}`,
      name: optionalText(seller.name ?? seller.display_name ?? seller.dealer_name, 120) || "Seller name not supplied",
      type: ["private", "dealer"].includes(key(seller.type)) ? key(seller.type) : "unknown",
      contact_available: !synthetic && Boolean(seller.contact_available === true || seller.contact || seller.contact_ref),
    },
    source: provider, listing_url: synthetic ? null : publicUrl(raw.listing_url ?? source.url),
    observed_at: observed && !Number.isNaN(Date.parse(observed)) ? observed : "",
    status: status === "active" ? "active" : status === "sold" ? "sold" : "unknown",
    available_from: date(raw.available_from ?? availability.available_from), mode,
  };
}

async function readPage(url: URL, signal: AbortSignal, catalogAuth = true): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (catalogAuth && process.env.CATALOG_API_KEY) headers.Authorization = `Bearer ${process.env.CATALOG_API_KEY}`;
  const response = await fetch(url, { headers, signal, cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error(`Catalog API returned HTTP ${response.status}. Check Chris's export endpoint and API credentials.`);
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) throw new Error("Catalog response exceeds the 8 MB limit.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Catalog API returned an empty response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error("Catalog response exceeds the 8 MB limit."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("Catalog API did not return valid JSON."); }
}

async function marketcheckRecords(): Promise<{ records: unknown[]; total: number }> {
  if (marketcheckCache && marketcheckCache.until > Date.now()) return marketcheckCache;
  const url = new URL("https://api.marketcheck.com/v2/search/car/active");
  url.search = new URLSearchParams({ api_key: process.env.MARKETCHECK_API_KEY!, country: "us", state: "CA", city: "San Francisco", make: "Tesla", car_type: "used", has_price: "true", has_miles: "true", rows: "50" }).toString();
  const payload = object(await readPage(url, AbortSignal.timeout(8_000), false));
  if (!Array.isArray(payload.listings)) throw new Error("MarketCheck did not return a listings array.");
  const records = payload.listings.map((entry) => {
    const listing = object(entry), build = object(listing.build), dealer = object(listing.dealer), media = object(listing.media);
    return {
      id: listing.id ?? listing.vin, make: build.make ?? "Tesla", model: build.model, year: build.year,
      price: listing.price, mileage: listing.miles, exterior_color: build.exterior_color,
      city: dealer.city ?? listing.city, photos: media.photo_links, listing_url: listing.vdp_url,
      title_status: listing.carfax_clean_title === true ? "clean" : "unknown",
      seller: { id: dealer.id, name: dealer.name, type: "dealer", contact_available: false },
      source: { provider: "marketcheck" }, mode: "live", status: "active", observed_at: new Date().toISOString(),
      description: "MarketCheck listing facts. VIN, battery, history, and physical condition need independent verification.",
    };
  });
  const result = { records, total: typeof payload.num_found === "number" ? payload.num_found : records.length };
  marketcheckCache = { ...result, until: Date.now() + 10 * 60_000 };
  return result;
}

export async function loadCatalog(): Promise<Catalog> {
  const configured = process.env.CATALOG_API_URL?.trim();
  const warnings: string[] = [];
  let records: unknown[] = [];
  let source = "Bundled synthetic Tesla demonstration catalog";
  if (configured) {
    let first: URL;
    try { first = new URL(configured); } catch { throw new Error("CATALOG_API_URL must be an absolute HTTP or HTTPS URL."); }
    if (!["http:", "https:"].includes(first.protocol) || first.username || first.password) throw new Error("CATALOG_API_URL must use HTTP(S) without embedded credentials.");
    source = `Catalog API: ${first.origin}${first.pathname}`;
    let next: URL | null = first;
    let total: number | null = null;
    const seen = new Set<string>();
    try {
      while (next) {
        if (seen.has(next.href) || seen.size >= 20) throw new Error("Catalog pagination did not finish within 20 distinct pages. Provide a bounded complete export.");
        seen.add(next.href);
        const payload = await readPage(next, AbortSignal.timeout(8_000));
        const page = object(payload);
        const items: unknown = Array.isArray(payload) ? payload : page.items ?? page.listings ?? page.cars;
        if (!Array.isArray(items)) throw new Error("Catalog API must return an array or an object containing items, listings, or cars.");
        records.push(...items);
        if (records.length > MAX_RECORDS) throw new Error("Catalog exceeds the 5,000-record limit. Export only Tesla inventory in San Francisco; no records were silently truncated.");
        if (typeof page.total === "number" && Number.isFinite(page.total)) total = page.total;
        const nextValue = page.next_url ?? page.next;
        if (typeof nextValue === "string" && nextValue.trim()) {
          const following: URL = new URL(nextValue, next);
          if (following.origin !== first.origin || following.username || following.password) throw new Error("Catalog pagination must stay on the configured API origin.");
          next = following;
        } else {
          next = null;
          if (page.has_more === true || page.next_cursor) warnings.push("Catalog reports more pages without a next URL. Coverage is incomplete; ask Chris for a complete export or next_url pagination.");
        }
      }
      if (total !== null && total > records.length) warnings.push(`API reports ${total} records, but only ${records.length} were returned. Inventory coverage is incomplete.`);
    } catch (error) {
      if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new Error("Catalog API timed out after 8 seconds. Synthetic inventory was not substituted.");
      if (error instanceof TypeError) throw new Error("Catalog API could not be reached. Check the configured endpoint; synthetic inventory was not substituted.");
      throw error;
    }
  } else if (process.env.MARKETCHECK_API_KEY) {
    const live = await marketcheckRecords();
    records = live.records;
    source = "MarketCheck active used-Tesla dealer search, San Francisco, CA";
    if (live.total > records.length) warnings.push(`MarketCheck reports ${live.total} matches; this bounded demo fetched the first ${records.length}. Additional pages were not evaluated.`);
    warnings.push("MarketCheck listing facts are not VIN, battery, title, or physical-condition verification. INSPECT every live car.");
  } else {
    records = fixture;
    warnings.push("Synthetic demonstration inventory. These vehicles are not real listings and no seller can be contacted.");
  }

  const ids = new Set<string>();
  let rejected = 0;
  const cars: Car[] = [];
  for (const value of records) {
    const raw = object(value);
    const provider = providerOf(raw);
    const car = normalizeCar(configured && raw.mode === undefined && LIVE_PROVIDERS.has(provider) ? { ...raw, mode: "live" } : raw);
    if (!car || ids.has(car.id)) { rejected++; continue; }
    ids.add(car.id);
    cars.push(car);
  }
  if (rejected) warnings.push(`${rejected} invalid or duplicate catalog records were excluded during normalization.`);
  const unknownStatus = cars.filter((car) => car.status === "unknown").length;
  if (unknownStatus) warnings.push(`${unknownStatus} records have unknown availability and cannot enter active-only search results.`);
  if (cars.some((car) => !car.observed_at)) warnings.push("Some records have no observation timestamp. Inventory freshness is unverified.");
  if (cars.some((car) => car.mode === "replay")) warnings.push("Some records lack recognized live provenance and are labeled replay. Seller availability has not been independently verified.");
  const modes = new Set(cars.map((car) => car.mode));
  const mode: Catalog["mode"] = modes.size === 1 && modes.has("live") ? "live" : modes.size === 1 && modes.has("synthetic") ? "synthetic" : !configured && !process.env.MARKETCHECK_API_KEY ? "synthetic" : "mixed";
  return { cars, mode, source, fetched_at: new Date().toISOString(), warnings };
}

function matches(value: string | null, requirement: string): boolean {
  return !requirement.trim() || Boolean(value && key(value) === key(requirement));
}

function noReportedAccidents(value: string | null): boolean {
  return ["no_reported_accidents", "no_accidents_reported", "none_reported", "no_accidents", "accident_free", "0_accidents", "none"].includes(key(value));
}

export function filterCars(cars: Car[], brief: Brief): { eligible: Car[]; excluded: number; warnings: string[] } {
  const warnings: string[] = [];
  const eligible = cars.filter((car) => {
    if (key(car.make) !== "tesla" || key(car.city) !== "san_francisco" || car.status !== "active") return false;
    if (car.price === null || car.price > brief.budget) return false;
    if (brief.min_year !== null && car.year < brief.min_year) return false;
    if (brief.max_mileage !== null && (car.mileage === null || car.mileage > brief.max_mileage)) return false;
    if (!matches(car.make, brief.make) || !matches(car.model, brief.model ?? "") || !matches(car.exterior_color, brief.color) || !matches(car.body_type, brief.body_type) || !matches(car.fuel_type, brief.fuel_type)) return false;
    if (brief.clean_title && key(car.title_status) !== "clean") return false;
    if (brief.no_reported_accidents && !noReportedAccidents(car.accident_history)) return false;
    if (brief.needed_by && car.available_from && car.available_from > brief.needed_by) return false;
    return true;
  });
  if (brief.budget_basis === "out_the_door") warnings.push("Budget filtering uses advertised price only. Taxes, registration, dealer fees, and a verified out-the-door quote are still required; these matches are provisional.");
  if (brief.needed_by && eligible.some((car) => !car.available_from)) warnings.push("Some matching cars have no confirmed availability date. The buyer's deadline must be verified before commitment.");
  if (key(brief.make) && key(brief.make) !== "tesla") warnings.push("This integration currently covers Tesla inventory only. Other makes produce no matches.");
  return { eligible, excluded: cars.length - eligible.length, warnings };
}
