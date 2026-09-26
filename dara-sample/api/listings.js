const MARKETCHECK_URL = "https://api.marketcheck.com/v2/search/car/active";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const asNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function queryValue(req, name, fallback) {
  if (req.query && req.query[name] !== undefined) return req.query[name];
  const url = new URL(req.url || "/api/listings", "http://localhost");
  return url.searchParams.get(name) ?? fallback;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.end(JSON.stringify(body));
}

function mapListing(listing, preferences) {
  const build = listing.build || {};
  const price = asNumber(listing.price, preferences.budget);
  const miles = asNumber(listing.miles, preferences.maxMileage);
  const year = asNumber(build.year, 2020);
  const photoCount = Array.isArray(listing.media?.photo_links) ? listing.media.photo_links.length : 0;
  const titleIsClean = listing.carfax_clean_title === true;
  const isModelY = build.model === "Model Y";
  const trim = [build.trim, year].filter(Boolean).join(" · ") || listing.heading || "Trim unavailable";
  const value = Math.round(clamp(100 - ((price / preferences.budget) * 42) + 26, 20, 96));
  const mileage = Math.round(clamp(100 - ((miles / preferences.maxMileage) * 48), 20, 96));
  const evidenceCoverage = Math.round(clamp((photoCount ? 33 : 0) + (titleIsClean ? 27 : 8) + (listing.vin ? 16 : 0), 20, 76));

  return {
    id: listing.id || listing.vin,
    vin: listing.vin,
    model: build.model || "Tesla",
    trim,
    price,
    miles,
    color: preferences.blackOnly ? "Black" : (build.exterior_color || "Unspecified"),
    value,
    mileage,
    year: Math.round(clamp(64 + ((year - 2020) * 7), 50, 100)),
    visual: evidenceCoverage,
    records: titleIsClean ? 78 : 38,
    battery: 50,
    road: isModelY ? 88 : 78,
    social: isModelY ? 90 : 76,
    live: true,
    photoUrl: listing.media?.photo_links?.[0] || null,
    vdpUrl: listing.vdp_url || null,
    visualSummary: photoCount
      ? `${photoCount} listing photo${photoCount === 1 ? "" : "s"} available · photo quality is not a mechanical inspection`
      : "No listing photos available · condition cannot be assessed",
    reasons: [
      price <= preferences.budget ? "within budget" : "price needs review",
      isModelY ? "cargo + road-trip fit" : "city-ready size",
      titleIsClean ? "clean-title field supplied" : "title history needs review",
    ],
    // MarketCheck inventory alone cannot clear a vehicle's battery or hidden condition.
    inspect: true,
  };
}

module.exports = async function handler(req, res) {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) return sendJson(res, 500, { error: "MARKETCHECK_API_KEY is not configured" });

  const preferences = {
    zip: String(queryValue(req, "zip", "94105")).replace(/[^0-9]/g, "").slice(0, 5) || "94105",
    radius: clamp(asNumber(queryValue(req, "radius", 100), 100), 10, 250),
    budget: clamp(asNumber(queryValue(req, "budget", 36000), 36000), 10000, 120000),
    maxMileage: clamp(asNumber(queryValue(req, "maxMileage", 75000), 75000), 5000, 200000),
    model: String(queryValue(req, "model", "any")),
    blackOnly: String(queryValue(req, "blackOnly", "true")) === "true",
  };

  const params = new URLSearchParams({
    api_key: apiKey,
    make: "Tesla",
    zip: preferences.zip,
    radius: String(preferences.radius),
    rows: "50",
    car_type: "used",
    has_price: "true",
    has_miles: "true",
    min_photo_links: "1",
    year_range: "2020-2026",
    price_range: `0-${preferences.budget}`,
    miles_range: `0-${preferences.maxMileage}`,
  });
  if (preferences.model !== "any" && ["Model 3", "Model Y"].includes(preferences.model)) params.set("model", preferences.model);
  if (preferences.blackOnly) params.set("base_ext_color", "Black");

  try {
    const response = await fetch(`${MARKETCHECK_URL}?${params}`);
    if (!response.ok) return sendJson(res, 502, { error: "MarketCheck inventory request failed", status: response.status });
    const payload = await response.json();
    const listings = (payload.listings || []).map((listing) => mapListing(listing, preferences));
    return sendJson(res, 200, { source: "marketcheck", fetchedAt: new Date().toISOString(), numFound: payload.num_found || 0, listings });
  } catch {
    return sendJson(res, 502, { error: "MarketCheck inventory could not be reached" });
  }
};
