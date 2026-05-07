import type { CalculatedZone } from "../types.js";
export function selectOpenFallbackCandidate(candidates: CalculatedZone[]) {
  return candidates.find((candidate) => candidate.open_fallback_allowed && candidate.alternative_division === "open" && candidate.open_fallback_rank <= 3);
}
