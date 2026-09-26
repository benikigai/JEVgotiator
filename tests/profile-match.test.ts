import assert from "node:assert/strict";
import { test } from "node:test";
import type { Brief, Car, RankedCar } from "../lib/contracts";
import { profileMatches } from "../lib/profile-match";

const brief: Brief = { query: "Tesla in San Francisco", budget: 40000, budget_basis: "advertised_price", city: "San Francisco", min_year: null, max_mileage: 75000, make: "Tesla", body_type: "", fuel_type: "", color: "", clean_title: false, no_reported_accidents: false, needed_by: null, priority: "best_fit" };
const base: Car = { id: "3", make: "Tesla", model: "Model 3", year: 2022, trim: null, price: 24000, mileage: 40000, exterior_color: "black", body_type: null, fuel_type: "electric", city: "San Francisco", photos: [], description: "Synthetic car", accident_history: null, maintenance_history: null, title_status: "unknown", seller: { id: "s", name: "Demo", type: "dealer", contact_available: false }, source: "demo", listing_url: null, observed_at: "2026-09-26T00:00:00Z", status: "active", available_from: null, mode: "synthetic" };
const ranked = (listing: Car): RankedCar => ({ listing, score: 0.7, factors: [], reasons: [], unknowns: [], verification_required: true });

test("tuning profile weights changes order without altering Jev scores", () => {
  const cars = [ranked(base), ranked({ ...base, id: "y", model: "Model Y", price: 39000 })];
  const value = profileMatches(cars, brief, { value: 50, evidence: 0, road_trip: 0, model_fit: 0 });
  const lifestyle = profileMatches(cars, brief, { value: 0, evidence: 0, road_trip: 50, model_fit: 50 });
  assert.equal(value[0].result.listing.id, "3");
  assert.equal(lifestyle[0].result.listing.id, "y");
  assert.equal(cars[0].score, 0.7);
  assert.equal(cars[1].score, 0.7);
});
