import test from "node:test";
import assert from "node:assert/strict";
import { filterCars, loadCatalog, normalizeCar } from "../lib/catalog";
import type { Brief, Car } from "../lib/contracts";
import fixture from "../data/catalog.json";

const brief: Brief = {
  query: "A used Tesla for city driving", budget: 25_000, budget_basis: "advertised_price",
  city: "San Francisco", min_year: null, max_mileage: null, make: "Tesla", model: "", body_type: "",
  fuel_type: "", color: "", clean_title: false, no_reported_accidents: false, needed_by: null, priority: "best_fit",
};
const raw = {
  id: "test-car", make: "Tesla", model: "Model 3", year: 2020, price: 20_000, mileage: 40_000,
  location: { city: "San Francisco", zip: "94110" }, seller: { type: "private", name: "Test seller" },
  source: "dealer", status: "active", title_status: "clean", accident_history: "No reported accidents", mode: "live",
};

test("generated catalog is importable, wholly synthetic, and supports a useful constrained shortlist", () => {
  assert.equal(fixture.length, 1000);
  const cars = fixture.map(normalizeCar);
  assert.ok(cars.every((record): record is Car => record !== null));
  assert.equal(new Set(cars.map((record) => record.id)).size, 1000);
  assert.ok(cars.every((record) => record.make === "Tesla" && record.city === "San Francisco" && record.mode === "synthetic"));
  assert.ok(cars.every((record) => record.photos.length === 0 && record.listing_url === null && !record.seller.contact_available));
  assert.equal(cars.filter((record) => record.status === "active").length, 950);
  assert.equal(cars.filter((record) => record.status === "sold").length, 30);
  assert.equal(cars.filter((record) => record.status === "unknown").length, 20);
  assert.equal(new Set(cars.map((record) => record.model)).size, 4);
  assert.equal(new Set(cars.map((record) => record.exterior_color)).size, 6);
  assert.ok(filterCars(cars, { ...brief, budget: 30000, max_mileage: 70000 }).eligible.length >= 100);
});
function car(patch: Record<string, unknown> = {}): Car {
  const result = normalizeCar({ ...raw, ...patch });
  assert.ok(result);
  return result;
}

test("hard filters exclude outside-SF, non-Tesla, over-budget, sold and unknown inventory", () => {
  const records = [car(), car({ id: "oakland", location: { city: "Oakland" } }), car({ id: "expensive", price: 25_001 }),
    car({ id: "sold", status: "sold" }), car({ id: "unknown", status: undefined }), car({ id: "toyota", make: "Toyota" })];
  const result = filterCars(records, brief);
  assert.deepEqual(result.eligible.map((record) => record.id), ["test-car"]);
  assert.equal(result.excluded, 5);
});

test("required no-accident history and clean title fail closed when unknown", () => {
  const records = [car(), car({ id: "no-history", accident_history: null }), car({ id: "unknown-history", accident_history: "unknown" }),
    car({ id: "accident", accident_history: "No reported accidents before 2024; collision reported in 2025" }), car({ id: "no-title", title_status: "unknown" })];
  const result = filterCars(records, { ...brief, clean_title: true, no_reported_accidents: true });
  assert.deepEqual(result.eligible.map((record) => record.id), ["test-car"]);
});

test("a requested Model Y excludes Model 3 while an unspecified model preserves both", () => {
  const records = [car({ id: "model-3", model: "Model 3" }), car({ id: "model-y", model: " Model Y " })];
  assert.deepEqual(filterCars(records, { ...brief, model: "Model Y" }).eligible.map((record) => record.id), ["model-y"]);
  assert.deepEqual(filterCars(records, { ...brief, model: "" }).eligible.map((record) => record.id), ["model-3", "model-y"]);
});

test("original contract cents become USD without changing mileage units", () => {
  const listing = normalizeCar({ listing_id: "cents-car", make: "Tesla", model: "Model 3", year: 2020, mileage_miles: 42_000,
    price: { currency: "USD", advertised_price_cents: 1_790_050 }, location: { city: "San Francisco" },
    seller: { seller_id: "s1", display_name: "Demo seller", type: "private", contact_ref: "private-ref" },
    history: { accident_status: "none_reported", title_status: "clean" }, source: { provider: "synthetic_fixture" },
    availability: { status: "active" } });
  assert.ok(listing);
  assert.equal(listing.price, 17_900.50);
  assert.equal(listing.mileage, 42_000);
  assert.equal(listing.mode, "synthetic");
  assert.equal(listing.seller.contact_available, false);
  assert.equal(listing.seller.name, "Demo seller");
  assert.equal(normalizeCar({ ...raw, price: { currency: "EUR", advertised_price_cents: 1000000 } }), null);
});

test("seller contact and raw provider fields cannot enter the public shape", () => {
  const listing = car({ description: "Contact seller@example.net or +1 (415) 555-0199. Recent service available.",
    seller: { name: "Demo seller", contact: "+1 (415) 555-0199", contact_ref: "secret", type: "private" }, private_notes: "secret internal notes" });
  const serialized = JSON.stringify(listing);
  assert.doesNotMatch(serialized, /seller@example|555-0199|secret/);
  assert.equal(listing.seller.contact_available, true);
  assert.match(listing.description, /Recent service available/);
});

test("out-the-door matches are provisional and availability deadline remains explicit", () => {
  const records = [car({ id: "unknown-date" }), car({ id: "early", available_from: "2026-10-01" }), car({ id: "late", available_from: "2026-10-20" })];
  const result = filterCars(records, { ...brief, budget_basis: "out_the_door", needed_by: "2026-10-05" });
  assert.deepEqual(result.eligible.map((record) => record.id), ["unknown-date", "early"]);
  assert.match(result.warnings.join(" "), /provisional/);
  assert.match(result.warnings.join(" "), /deadline must be verified/);
});

test("invalid or unconfirmed provenance never becomes live through normalization", () => {
  assert.equal(normalizeCar({ ...raw, year: "2020" }), null);
  assert.equal(car({ source: "unrecognized", mode: "live" }).mode, "replay");
  assert.equal(car({ source: "dealer", mode: undefined }).mode, "replay");
  assert.equal(car({ source: "synthetic", mode: "live" }).mode, "synthetic");
});

test("configured API errors do not silently become synthetic inventory", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.CATALOG_API_URL;
  process.env.CATALOG_API_URL = "https://catalog.example.net/listings";
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  try { await assert.rejects(loadCatalog(), /HTTP 503/); }
  finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.CATALOG_API_URL; else process.env.CATALOG_API_URL = originalUrl;
  }
});

test("catalog follows explicit pagination and retains every record before filtering", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.CATALOG_API_URL;
  process.env.CATALOG_API_URL = "https://catalog.example.net/listings";
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    return Response.json(requested.length === 1 ? { items: [{ ...raw, id: "first" }], total: 2, next_url: "/listings?page=2" } : { items: [{ ...raw, id: "second", status: undefined }], total: 2 });
  };
  try {
    const result = await loadCatalog();
    assert.equal(result.cars.length, 2);
    assert.equal(result.mode, "live");
    assert.equal(filterCars(result.cars, brief).eligible.length, 1);
    assert.equal(requested[1], "https://catalog.example.net/listings?page=2");
    assert.match(result.warnings.join(" "), /unknown availability/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.CATALOG_API_URL; else process.env.CATALOG_API_URL = originalUrl;
  }
});

test("MarketCheck adapter keeps live provenance and requires physical inspection", async () => {
  const originalFetch = globalThis.fetch;
  const originalCatalog = process.env.CATALOG_API_URL;
  const originalMarketcheck = process.env.MARKETCHECK_API_KEY;
  delete process.env.CATALOG_API_URL;
  process.env.MARKETCHECK_API_KEY = "test-marketcheck-key";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "api.marketcheck.com");
    assert.equal(url.searchParams.get("city"), "San Francisco");
    assert.equal(url.searchParams.get("rows"), "50");
    return Response.json({ num_found: 2, listings: [{ id: "mc-1", price: 31000, miles: 35000, vdp_url: "https://dealer.example/car", carfax_clean_title: true,
      build: { make: "Tesla", model: "Model Y", year: 2022, exterior_color: "Black" },
      dealer: { id: "dealer-1", name: "Test dealer", city: "San Francisco" }, media: { photo_links: ["https://dealer.example/photo.jpg"] } }] });
  };
  try {
    const result = await loadCatalog();
    assert.equal(result.mode, "live");
    assert.equal(result.cars.length, 1);
    assert.equal(result.cars[0].mode, "live");
    assert.equal(result.cars[0].listing_url, "https://dealer.example/car");
    assert.equal(result.cars[0].photos.length, 1);
    assert.match(result.warnings.join(" "), /INSPECT every live car/);
    assert.equal(filterCars(result.cars, { ...brief, budget: 35000, model: "Model Y", color: "black" }).eligible.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCatalog === undefined) delete process.env.CATALOG_API_URL; else process.env.CATALOG_API_URL = originalCatalog;
    if (originalMarketcheck === undefined) delete process.env.MARKETCHECK_API_KEY; else process.env.MARKETCHECK_API_KEY = originalMarketcheck;
  }
});
