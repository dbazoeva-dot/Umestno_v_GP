import type { DrawerSize, FitResult } from "../types.js";
import { evaluatePlacementRules } from "../rules/evaluatePlacementRules.js";
import { scorePlacementCandidate } from "./scorePlacementCandidate.js";

export function selectBestCandidate({ candidates, drawerSize }: { candidates: FitResult[]; drawerSize: DrawerSize }): FitResult | null {
  let bestScore = -Infinity;
  let best: FitResult | null = null;

  for (const candidate of candidates) {
    if (candidate.fit_status !== "fit_all") continue;
    const evals = evaluatePlacementRules({ drawerSize, fitResult: candidate });
    const zoneIntegrity = evals.find((e) => e.rule_id === "ZONE_INTEGRITY");
    const d02 = evals.find((e) => e.rule_id === "D02");
    if (zoneIntegrity?.status !== "pass") continue;
    if (d02?.status === "violation") continue;
    const score = scorePlacementCandidate(candidate, drawerSize, evals);
    if (score > bestScore) { bestScore = score; best = candidate; }
  }

  return best;
}
