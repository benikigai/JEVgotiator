import type { Brief, Car, DaraIntelligence } from "./contracts";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

// Port Dara's mapListing and scoreListing so shortlisted cars use the team's actual intelligence rules.
export function scoreDaraSelections(cars: Car[], brief: Brief): DaraIntelligence {
  const maxMileage = Math.max(1, brief.max_mileage ?? 75000);
  const candidates = cars.map((car) => {
    const price = car.price ?? brief.budget;
    const miles = car.mileage ?? maxMileage;
    const cleanTitle = car.title_status.toLowerCase() === "clean";
    const isModelY = car.model === "Model Y";
    const value = Math.round(clamp(126 - (price / brief.budget) * 42, 20, 96));
    const mileage = Math.round(clamp(100 - (miles / maxMileage) * 48, 20, 96));
    const year = Math.round(clamp(64 + (car.year - 2020) * 7, 50, 100));
    const visual = Math.round(clamp((car.photos.length ? 33 : 0) + (cleanTitle ? 27 : 8), 20, 76));
    const records = cleanTitle ? 78 : 38;
    const battery = 50;
    const road = isModelY ? 88 : 78;
    const social = isModelY ? 90 : 76;
    const priceFit = clamp(value + (brief.budget - price) / 800);
    const mileageFit = clamp(mileage + (maxMileage - miles) / 1100);
    const quality = visual * 0.55 + records * 0.25 + battery * 0.20;
    const fixed = mileageFit * 0.45 + year * 0.35 + battery * 0.20;
    const score = Math.round((priceFit * 26 + quality * 23 + road * 18 + social * 8 + fixed * 25) / 100);
    return {
      listing_id: car.id, rank: 0, score,
      signals: { value: priceFit, evidence: quality, road_trip: road, model_fit: social, mileage_year_battery: fixed },
      unknowns: [
        "Battery condition is unknown; Dara's neutral baseline is 50, not a health measurement.",
        "VIN is absent from this canonical contract, so no VIN evidence credit is awarded.",
        "Road-trip and model-fit values are model heuristics, not range tests or personal social-profile analysis.",
        ...(car.photos.length ? ["Photos are counted as evidence coverage, not visually inspected."] : ["No listing photos are available."]),
        ...(!cleanTitle ? ["Clean title is not established."] : ["Clean-title field still requires independent verification."]),
        ...(car.price === null ? ["Asking price is missing; buyer budget is used only as a scoring baseline."] : []),
        ...(car.mileage === null ? ["Mileage is missing; the mileage limit is used only as a scoring baseline."] : []),
      ],
    };
  }).sort((a, b) => b.score - a.score || a.listing_id.localeCompare(b.listing_id)).map((candidate, index) => ({ ...candidate, rank: index + 1 }));
  return {
    source: "dara-sample", source_commit: "163fa4787cb9151b76af917f643483ddb0f7f97e",
    method: "Dara's scoreListing: value26%, evidence23%, road-trip18%, model-fit8%, mileage/year/battery25%. Evidence = photo coverage55% + title records25% + neutral battery20%.",
    assumptions: [
      "Scores re-rank only the selected cars; Jev's original shortlist order and scores are preserved.",
      "Canonical price, mileage, model, year, photo count, and title map to Dara's MarketCheck scoring fields. No additional inventory API is called.",
      "The original model-based social score is labeled model fit because no buyer social-profile data is available.",
      `Mileage scoring limit is ${maxMileage} miles${brief.max_mileage === null ? " (Dara's 75,000-mile default because no buyer cap was supplied)" : ""}. Unknown battery and condition values are disclosed assumptions.`,
    ],
    candidates,
  };
}
