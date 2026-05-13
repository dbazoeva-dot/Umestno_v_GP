import type { CalculatedZone, DrawerSize, FitResult, LayoutPlan } from "../types.js";
import { runFitCheck } from "./runFitCheck.js";

export function generatePlacementCandidates({ zoneVariants, drawerSize }: { zoneVariants: CalculatedZone[][]; drawerSize: DrawerSize }): FitResult[] {
  if (zoneVariants.length === 0) return [];

  const combos = cartesianProduct(zoneVariants);
  const seen = new Set<string>();
  const results: FitResult[] = [];

  for (const combo of combos) {
    for (const perm of permutations(combo)) {
      const layoutPlan = minimalLayoutPlan(perm);
      const fitResult = runFitCheck({ layoutPlan, calculatedZones: perm, drawerSize, enableDepthStackCandidates: false });
      const key = fingerprint(fitResult);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(fitResult);
    }
  }

  return results;
}

function minimalLayoutPlan(zones: CalculatedZone[]): LayoutPlan {
  return { layout_id: "candidate", selected_zones: zones, placement_order: zones.map((z) => z.content_type), rules_applied: [], reserve_policy: "reserve_to_edge_or_open_zone" };
}

function fingerprint(fitResult: FitResult): string {
  return fitResult.placed_zones
    .map((z) => `${z.zone_id}:${z.x_cm.toFixed(4)}:${z.y_cm.toFixed(4)}:${z.assigned_w_cm.toFixed(4)}:${z.assigned_d_cm.toFixed(4)}`)
    .sort()
    .join("|");
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, array) => acc.flatMap((existing) => array.map((item) => [...existing, item])), [[]]);
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}
