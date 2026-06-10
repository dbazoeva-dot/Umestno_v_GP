import type { DrawerSize, FitResult } from "../types.js";
import { evaluatePlacementRules } from "../rules/evaluatePlacementRules.js";
import { scorePlacementCandidate } from "./scorePlacementCandidate.js";
import { isRescueOption } from "../zones/generateZoneVariants.js";

function usesRescueGrid(candidate: FitResult): boolean {
  return candidate.placed_zones.some((zone) => isRescueOption(zone.option_id));
}

export function selectBestCandidate({ candidates, drawerSize }: { candidates: FitResult[]; drawerSize: DrawerSize }): FitResult | null {
  let bestScore = -Infinity;
  let best: FitResult | null = null;
  let bestRescueScore = -Infinity;
  let bestRescue: FitResult | null = null;

  for (const candidate of candidates) {
    if (candidate.fit_status !== "fit_all") continue;
    const evals = evaluatePlacementRules({ drawerSize, fitResult: candidate });
    const zoneIntegrity = evals.find((e) => e.rule_id === "ZONE_INTEGRITY");
    const d02 = evals.find((e) => e.rule_id === "D02");
    if (zoneIntegrity?.status !== "pass") continue;
    if (d02?.status === "violation") continue;
    const score = scorePlacementCandidate(candidate, drawerSize, evals);
    // Rescue-сетки (вытянутые точные раскладки) — последний резерв: предпочитаем
    // fit_all БЕЗ них, и берём вариант с rescue-сеткой только если без rescue
    // полной укладки не существует. Так обычные ящики сохраняют компактные
    // раскладки, а тесные ящики всё-таки получают схему (BL-18).
    if (usesRescueGrid(candidate)) {
      if (score > bestRescueScore) { bestRescueScore = score; bestRescue = candidate; }
    } else if (score > bestScore) { bestScore = score; best = candidate; }
  }

  return best ?? bestRescue;
}
