import type { CalculatedZone, FitResult, LayoutRules } from "../types.js";
const penaltyWeight = { low: 0, medium: 1, high: 2 } as const;
export function buildAdjustmentCandidates({ fitResult, calculatedZones }: { fitResult: FitResult; calculatedZones: CalculatedZone[]; layoutRules: LayoutRules }) {
  const failed = new Set(fitResult.failed_zones.map((z) => z.zone_id));
  return calculatedZones
    .filter((zone) => failed.has(zone.zone_id))
    .sort((a, b) => Number(b.open_fallback_allowed) - Number(a.open_fallback_allowed) || a.open_fallback_rank - b.open_fallback_rank || penaltyWeight[a.open_storage_penalty] - penaltyWeight[b.open_storage_penalty]);
}
