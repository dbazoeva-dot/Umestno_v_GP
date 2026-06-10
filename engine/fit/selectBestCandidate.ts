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
  let bestPartial: FitResult | null = null;
  let bestPartialPlaced = -1;
  let bestPartialScore = -Infinity;

  for (const candidate of candidates) {
    // fit_none кандидаты — ничего полезного, пропускаем сразу.
    if (candidate.fit_status === "fit_none") continue;

    const evals = evaluatePlacementRules({ drawerSize, fitResult: candidate });
    const zoneIntegrity = evals.find((e) => e.rule_id === "ZONE_INTEGRITY");
    const d02 = evals.find((e) => e.rule_id === "D02");
    if (zoneIntegrity?.status !== "pass") continue;
    if (d02?.status === "violation") continue;
    const score = scorePlacementCandidate(candidate, drawerSize, evals);

    if (candidate.fit_status === "fit_all") {
      // Rescue-сетки (вытянутые точные раскладки) — последний резерв: предпочитаем
      // fit_all БЕЗ них, и берём вариант с rescue-сеткой только если без rescue
      // полной укладки не существует. Так обычные ящики сохраняют компактные
      // раскладки, а тесные ящики всё-таки получают схему (BL-18).
      if (usesRescueGrid(candidate)) {
        if (score > bestRescueScore) { bestRescueScore = score; bestRescue = candidate; }
      } else if (score > bestScore) { bestScore = score; best = candidate; }
    } else if (candidate.fit_status === "fit_partial") {
      // Fallback: если ни одна комбинация не даёт fit_all, отдаём «лучший
      // частичный» (больше всего категорий поместилось; при равенстве — выше
      // score). Это позволяет /no-fit/ показать suggestion-баннер «не вошли
      // носки, уменьшите до 16 пар, согласны?» вместо тупикового no_scheme.
      // Поведение для fit_all-кейсов не меняется — они всё ещё выбираются
      // первым приоритетом (см. return ниже).
      const placed = candidate.placed_zones.length;
      if (placed > bestPartialPlaced || (placed === bestPartialPlaced && score > bestPartialScore)) {
        bestPartialPlaced = placed;
        bestPartialScore = score;
        bestPartial = candidate;
      }
    }
  }

  // Приоритет выбора: обычный fit_all → fit_all с rescue → лучший fit_partial → null.
  return best ?? bestRescue ?? bestPartial;
}
