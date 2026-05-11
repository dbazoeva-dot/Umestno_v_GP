import type { CalculatedZone, FitResult, LayoutPlan, PlacedZone, DrawerSize, SoftHeightWarning, SoftHeightWarningCode } from "../types.js";
import { classifyFitStatus } from "./classifyFitStatus.js";
import { findFreeRectangles } from "./findFreeRectangles.js";
import { chooseDepthStackFitCandidate } from "./generateDepthStackCandidates.js";
export function runFitCheck({ layoutPlan, drawerSize, enableDepthStackCandidates = true }: { layoutPlan: LayoutPlan; calculatedZones: CalculatedZone[]; drawerSize: DrawerSize; enableDepthStackCandidates?: boolean }): FitResult {
  const placed_zones: PlacedZone[] = []; const unplaced_zones: CalculatedZone[] = [];
  const content_warnings: SoftHeightWarning[] = [];
  const placement_attempts = [] as Array<{ content_type: string; zone_id: string; placed: boolean; selected_rect?: { x_cm:number;y_cm:number;w_cm:number;d_cm:number;h_cm:number }; soft_height_warning?: SoftHeightWarning; rejected_rectangles?: Array<{ x_cm:number;y_cm:number;w_cm:number;d_cm:number;h_cm:number; reason: string }> }>;
  let missingW = 0; let missingD = 0; let missingH = 0;
  for (const zone of layoutPlan.selected_zones) {
    const zoneW = zone.assigned_box_w_cm ?? zone.zone_w_cm;
    const zoneD = zone.assigned_box_d_cm ?? zone.zone_d_cm;
    const zoneH = zone.assigned_box_h_cm ?? zone.zone_h_cm;
    const freeRectangles = findFreeRectangles(drawerSize, placed_zones);
    const rejected_rectangles = freeRectangles.map((rect) => ({ ...rect, reason: rejectReason(rect, zoneW, zoneD, zoneH, zone) })).filter((rect) => rect.reason !== "fits" && rect.reason !== "soft_height_warning");
    const candidate = choosePlacementRectangle({ freeRectangles, zoneW, zoneD, zoneH, zone });
    if (candidate) {
      const softHeightWarning = candidate.softHeightWarning;
      const placedZone = { ...zone, x_cm: candidate.rect.x_cm, y_cm: candidate.rect.y_cm, assigned_w_cm: zoneW, assigned_d_cm: zoneD, assigned_h_cm: zoneH, soft_height_warning: softHeightWarning };
      placed_zones.push(placedZone);
      if (softHeightWarning) content_warnings.push(softHeightWarning);
      placement_attempts.push({ content_type: zone.content_type, zone_id: zone.zone_id, placed: true, selected_rect: candidate.rect, soft_height_warning: softHeightWarning });
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
  const fit_notes = unplaced_zones.length ? ["Some zones did not fit in deterministic 2D free-rectangle placement."] : ["All calculated zones fit deterministic 2D free-rectangle placement before SKU matching."];
  if (content_warnings.length) fit_notes.push("Some content zones were accepted with configured soft height warnings; SKU/product height fit remains strict.");
  const fitResult: FitResult = { fit_status: classifyFitStatus(placed_zones.length, layoutPlan.selected_zones.length), placed_zones, unplaced_zones, failed_zones: unplaced_zones, best_attempt: { placed_count: placed_zones.length }, failed_dimension, missing_width_cm: missingW, missing_depth_cm: missingD, missing_height_cm: missingH, used_width_cm, used_depth_cm, used_height_cm, overflow_width_cm: missingW, overflow_depth_cm: missingD, overflow_height_cm: missingH, free_rectangles, available_box: free_rectangles[0] ? { ...free_rectangles[0] } : undefined, fit_notes, content_warnings, placement_attempts };
  return enableDepthStackCandidates ? chooseDepthStackFitCandidate({ drawerSize, currentFit: fitResult }) ?? fitResult : fitResult;
}
function choosePlacementRectangle({ freeRectangles, zoneW, zoneD, zoneH, zone }: { freeRectangles: ReturnType<typeof findFreeRectangles>; zoneW: number; zoneD: number; zoneH: number; zone: CalculatedZone }) { return freeRectangles.map((rect) => ({ rect, softHeightWarning: buildSoftHeightWarning(rect, zoneW, zoneD, zoneH, zone) })).filter((candidate) => rejectReason(candidate.rect, zoneW, zoneD, zoneH, zone) === "fits" || candidate.softHeightWarning).sort((a, b) => a.rect.y_cm - b.rect.y_cm || a.rect.x_cm - b.rect.x_cm || Number(Boolean(a.softHeightWarning)) - Number(Boolean(b.softHeightWarning)) || leftoverArea(a.rect, zoneW, zoneD) - leftoverArea(b.rect, zoneW, zoneD) || b.rect.w_cm * b.rect.d_cm - a.rect.w_cm * a.rect.d_cm || b.rect.h_cm - a.rect.h_cm)[0]; }
function rejectReason(rect: { w_cm: number; d_cm: number; h_cm: number }, zoneW: number, zoneD: number, zoneH: number, zone: CalculatedZone) { if (zoneW > rect.w_cm) return "width"; if (zoneD > rect.d_cm) return "depth"; if (zoneH > rect.h_cm) return buildSoftHeightWarning(rect, zoneW, zoneD, zoneH, zone) ? "soft_height_warning" : "height"; return "fits"; }
function buildSoftHeightWarning(rect: { w_cm: number; d_cm: number; h_cm: number }, zoneW: number, zoneD: number, zoneH: number, zone: CalculatedZone): SoftHeightWarning | undefined {
  if (zone.soft_height_warning_allowed !== true || !zone.max_soft_height_overflow_cm || !zone.soft_height_warning_code) return undefined;
  if (zoneW > rect.w_cm || zoneD > rect.d_cm) return undefined;
  const overflow_h_cm = zoneH - rect.h_cm;
  if (overflow_h_cm <= 0 || overflow_h_cm > zone.max_soft_height_overflow_cm) return undefined;
  return { content_type: zone.content_type, zone_id: zone.zone_id, warning_code: zone.soft_height_warning_code, message: buildSoftHeightMessage(zone.soft_height_warning_code, zone.content_type, rect.h_cm, zoneH), available_h_cm: rect.h_cm, drawer_h_cm: rect.h_cm, needed_h_cm: zoneH, zone_h_cm: zoneH, overflow_h_cm, max_allowed_overflow_h_cm: zone.max_soft_height_overflow_cm };
}
function buildSoftHeightMessage(code: SoftHeightWarningCode, contentType: string, availableH: number, zoneH: number) {
  if (code === "deformation_risk") return `Схема помещается в ваш ящик, но есть нюанс по высоте: для ${contentType} доступно ${availableH} см, а комфортная высота хранения составляет около ${zoneH} см. Их можно разместить, но чашки могут слегка сжиматься и со временем деформироваться.`;
  return `Схема помещается в ваш ящик, но есть нюанс по высоте: для ${contentType} доступно ${availableH} см, а комфортная высота хранения составляет около ${zoneH} см. Вещи поместятся, но хранение будет более плотным: их может быть чуть менее удобно доставать.`;
}
function leftoverArea(rect: { w_cm: number; d_cm: number }, zoneW: number, zoneD: number) { return rect.w_cm * rect.d_cm - zoneW * zoneD; }
