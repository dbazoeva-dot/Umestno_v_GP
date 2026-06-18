import type { DrawerSize, FitResult, PlacedZone } from "../types.js";
import { alignColumns } from "./alignColumns.js";
import { findFreeRectangles } from "./findFreeRectangles.js";

type FreeRectangle = FitResult["free_rectangles"][number];

// Тонкий хвост глубины у задней стенки (≤ порога) бесполезен как резерв —
// поглощаем его в зону, чтобы не оставлять полоску. Аналог SLIVER_MAX_CM в alignColumns.
const DEPTH_SLIVER_MAX_CM = 8;

export function normalizePlacement({ fitResult, drawerSize }: { fitResult: FitResult; drawerSize: DrawerSize }): FitResult {
  const aligned = alignColumns(fitResult.placed_zones);
  const freeAfterAlign = findFreeRectangles(drawerSize, aligned);
  const absorbed = absorbDepthReserve(aligned, freeAfterAlign, drawerSize.d_cm);
  const freeRectangles = findFreeRectangles(drawerSize, absorbed);
  return {
    ...fitResult,
    placed_zones: absorbed,
    free_rectangles: freeRectangles,
    available_box: freeRectangles[0] ? { ...freeRectangles[0] } : undefined,
    used_width_cm: absorbed.reduce((max, z) => Math.max(max, z.x_cm + z.assigned_w_cm), 0),
    used_depth_cm: absorbed.reduce((max, z) => Math.max(max, z.y_cm + z.assigned_d_cm), 0),
    used_height_cm: absorbed.reduce((max, z) => Math.max(max, z.assigned_h_cm), 0),
    fit_notes: [...fitResult.fit_notes, "Placement normalized: columns aligned and depth reserve absorbed where applicable."]
  };
}

function absorbDepthReserve(zones: PlacedZone[], freeRectangles: FreeRectangle[], drawerDepth: number): PlacedZone[] {
  return zones.map((zone) => {
    const adjacent = freeRectangles.find(
      (rect) =>
        nearlyEqual(zone.x_cm, rect.x_cm) &&
        nearlyEqual(zone.assigned_w_cm, rect.w_cm) &&
        nearlyEqual(zone.y_cm + zone.assigned_d_cm, rect.y_cm)
    );
    if (!adjacent) return zone;
    // Хвост достаёт до задней стенки → это резерв, а не щель между зонами:
    // раздуваем зону в него только если он тонкий слайвер. Иначе оставляем
    // честным резервом (его при необходимости дозаберёт матчер под конкретный SKU).
    // Внутренние щели (за ними снова контент) засыпаем как раньше — это выравнивание.
    const reachesBackWall = nearlyEqual(adjacent.y_cm + adjacent.d_cm, drawerDepth);
    if (reachesBackWall && adjacent.d_cm > DEPTH_SLIVER_MAX_CM) return zone;
    return { ...zone, assigned_d_cm: zone.assigned_d_cm + adjacent.d_cm };
  });
}

function nearlyEqual(a: number, b: number): boolean { return Math.abs(a - b) < 0.0001; }
