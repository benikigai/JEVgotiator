import type { Brief, RankedCar } from "./contracts";
import { scoreDaraSelections } from "./dara-intelligence";

export type MatchWeights = { value: number; evidence: number; road_trip: number; model_fit: number };
export const defaultMatchWeights: MatchWeights = { value: 26, evidence: 23, road_trip: 18, model_fit: 8 };

// The fixed 25 points keep mileage, year, and unknown battery condition visible as priorities move.
export function profileMatches(results: RankedCar[], brief: Brief, weights: MatchWeights) {
  const signals = scoreDaraSelections(results.map(result => result.listing), brief).candidates;
  const denominator = weights.value + weights.evidence + weights.road_trip + weights.model_fit + 25;
  return results.map(result => {
    const candidate = signals.find(item => item.listing_id === result.listing.id)!;
    const score = Math.round((candidate.signals.value * weights.value + candidate.signals.evidence * weights.evidence + candidate.signals.road_trip * weights.road_trip + candidate.signals.model_fit * weights.model_fit + candidate.signals.mileage_year_battery * 25) / denominator);
    return { result, score };
  }).sort((a, b) => b.score - a.score || a.result.listing.id.localeCompare(b.result.listing.id));
}
