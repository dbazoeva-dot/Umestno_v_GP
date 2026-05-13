import type { DrawerSize, FitResult, PlacedZone } from "../types.js";
import { alignColumns } from "./alignColumns.js";
import { findFreeRectangles } from "./findFreeRectangles.js";

type FreeRectangle = FitResult["free_rectangles"][number];

export function normalizePlacement({ fitResult, drawerSize }: { fitResult: FitResult; drawerSize: DrawerSize }): FitResult {
  const aligned = alignColumns(fitResult.placed_zones);
  const freeAfterAlign = findFreeRectangles(drawerSize, aligned);
  const absorbed = absorbDepthReserve(aligned, freeAfterAlign);
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

function absorbDepthReserve(zones: PlacedZone[], freeRectangles: FreeRectangle[]): PlacedZone[] {
  return zones.map((zone) => {
    const adjacent = freeRectangles.find(
      (rect) =>
        nearlyEqual(zone.x_cm, rect.x_cm) &&
        nearlyEqual(zone.assigned_w_cm, rect.w_cm) &&
        nearlyEqual(zone.y_cm + zone.assigned_d_cm, rect.y_cm)
    );
    return adjacent ? { ...zone, assigned_d_cm: zone.assigned_d_cm + adjacent.d_cm } : zone;
  });
}

function nearlyEqual(a: number, b: number): boolean { return Math.abs(a - b) < 0.0001; }
