import type { CalculatedZone, FitResult, LayoutPlan, PlacedZone, DrawerSize } from "../types.js";
import { classifyFitStatus } from "./classifyFitStatus.js";
import { findFreeRectangles } from "./findFreeRectangles.js";
export function runFitCheck({ layoutPlan, drawerSize }: { layoutPlan: LayoutPlan; calculatedZones: CalculatedZone[]; drawerSize: DrawerSize }): FitResult {
  const placed_zones: PlacedZone[] = []; const unplaced_zones: CalculatedZone[] = [];
  const placement_attempts = [] as Array<{ content_type: string; zone_id: string; placed: boolean; selected_rect?: { x_cm:number;y_cm:number;w_cm:number;d_cm:number;h_cm:number }; rejected_rectangles?: Array<{ x_cm:number;y_cm:number;w_cm:number;d_cm:number;h_cm:number; reason: string }> }>;
  let missingW = 0; let missingD = 0; let missingH = 0;
  for (const zone of layoutPlan.selected_zones) {
    const zoneW = zone.assigned_box_w_cm ?? zone.zone_w_cm;
    const zoneD = zone.assigned_box_d_cm ?? zone.zone_d_cm;
    const zoneH = zone.assigned_box_h_cm ?? zone.zone_h_cm;
    const freeRectangles = findFreeRectangles(drawerSize, placed_zones);
    const rejected_rectangles = freeRectangles.map((rect) => ({ ...rect, reason: rejectReason(rect, zoneW, zoneD, zoneH) })).filter((rect) => rect.reason !== "fits");
    const candidateRect = choosePlacementRectangle({ freeRectangles, zoneW, zoneD, zoneH });
    if (candidateRect) {
      placed_zones.push({ ...zone, x_cm: candidateRect.x_cm, y_cm: candidateRect.y_cm, assigned_w_cm: zoneW, assigned_d_cm: zoneD, assigned_h_cm: zoneH });
      placement_attempts.push({ content_type: zone.content_type, zone_id: zone.zone_id, placed: true, selected_rect: candidateRect });
    } else {
      unplaced_zones.push(zone);
      missingW = Math.max(missingW, Math.min(...freeRectangles.map((rect) => Math.max(0, zoneW - rect.w_cm)), Math.max(0, zoneW - drawerSize.w_cm)));
      missingD = Math.max(missingD, Math.min(...freeRectangles.map((rect) => Math.max(0, zoneD - rect.d_cm)), Math.max(0, zoneD - drawerSize.d_cm)));
      missingH = Math.max(missingH, Math.max(0, zoneH - drawerSize.h_cm));
      placement_attempts.push({ content_type: zone.content_type, zone_id: zone.zone_id, placed: false, rejected_rectangles });
    }
  }
  const free_rectangles = findFreeRectangles(drawerSize, placed_zones);
  const used_width_cm = placed_zones.reduce((max, zone) => Math.max(max, zone.x_cm + zone.assigned_w_cm), 0);
  const used_depth_cm = placed_zones.reduce((max, zone) => Math.max(max, zone.y_cm + zone.assigned_d_cm), 0);
  const used_height_cm = placed_zones.reduce((max, zone) => Math.max(max, zone.assigned_h_cm), 0);
  const failed_dimension = missingH > 0 ? "height" : missingW > 0 ? "width" : missingD > 0 ? "depth" : undefined;
  return { fit_status: classifyFitStatus(placed_zones.length, layoutPlan.selected_zones.length), placed_zones, unplaced_zones, failed_zones: unplaced_zones, best_attempt: { placed_count: placed_zones.length }, failed_dimension, missing_width_cm: missingW, missing_depth_cm: missingD, missing_height_cm: missingH, used_width_cm, used_depth_cm, used_height_cm, overflow_width_cm: missingW, overflow_depth_cm: missingD, overflow_height_cm: missingH, free_rectangles, available_box: free_rectangles[0] ? { ...free_rectangles[0] } : undefined, fit_notes: unplaced_zones.length ? ["Some zones did not fit in deterministic 2D free-rectangle placement."] : ["All calculated zones fit deterministic 2D free-rectangle placement before SKU matching."], placement_attempts };
}
function choosePlacementRectangle({ freeRectangles, zoneW, zoneD, zoneH }: { freeRectangles: ReturnType<typeof findFreeRectangles>; zoneW: number; zoneD: number; zoneH: number }) { return freeRectangles.filter((rect) => rejectReason(rect, zoneW, zoneD, zoneH) === "fits").sort((a, b) => a.y_cm - b.y_cm || a.x_cm - b.x_cm || leftoverArea(a, zoneW, zoneD) - leftoverArea(b, zoneW, zoneD) || b.w_cm * b.d_cm - a.w_cm * a.d_cm || b.h_cm - a.h_cm)[0]; }
function rejectReason(rect: { w_cm: number; d_cm: number; h_cm: number }, zoneW: number, zoneD: number, zoneH: number) { if (zoneH > rect.h_cm) return "height"; if (zoneW > rect.w_cm) return "width"; if (zoneD > rect.d_cm) return "depth"; return "fits"; }
function leftoverArea(rect: { w_cm: number; d_cm: number }, zoneW: number, zoneD: number) { return rect.w_cm * rect.d_cm - zoneW * zoneD; }
