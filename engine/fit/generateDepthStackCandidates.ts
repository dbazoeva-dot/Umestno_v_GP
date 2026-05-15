import type { CalculatedZone, DrawerSize, FitResult, PlacedZone, SoftHeightWarning, SoftHeightWarningCode } from "../types.js";
import { evaluatePlacementRules } from "../rules/evaluatePlacementRules.js";
import { findFreeRectangles } from "./findFreeRectangles.js";

const UNDERWEAR_DEPTH_STACK_TYPES = new Set(["socks_regular", "socks", "panties", "boxers", "bras", "tights", "sport_tops", "thermals"]);
const RULE_STATUS_WEIGHTS: Record<string, number> = {
  ZONE_INTEGRITY: 1000,
  D01: 180,
  D02: 110,
  D03: 180,
  D04: 160,
  D04b: 35,
  D05: 120,
  D06: 120
};

type Candidate = { id: string; placed_zones: PlacedZone[]; content_warnings: SoftHeightWarning[] };
export function chooseDepthStackFitCandidate({ drawerSize, currentFit }: { drawerSize: DrawerSize; currentFit: FitResult }): FitResult | null {
  const zones = currentFit.placed_zones;
  if (currentFit.fit_status !== "fit_all" || zones.length < 2 || zones.length > 3 || currentFit.content_warnings.length) return null;
  if (!zones.every((zone) => UNDERWEAR_DEPTH_STACK_TYPES.has(zone.content_type))) return null;

  const candidates = dedupeCandidates([
    { id: "row_by_width", placed_zones: zones, content_warnings: currentFit.content_warnings },
    ...buildDepthStackCandidates(zones, drawerSize)
  ]);
  if (candidates.length <= 1) return null;

  const scored = candidates.map((candidate) => ({ candidate, score: scoreCandidate(candidate, drawerSize) })).sort((a, b) => b.score.total - a.score.total || b.score.depth_utilization - a.score.depth_utilization || a.score.used_width_cm - b.score.used_width_cm || a.candidate.id.localeCompare(b.candidate.id));
  const best = scored[0];
  const row = scored.find((item) => item.candidate.id === "row_by_width") ?? scored[0];
  if (!best || best.candidate.id === "row_by_width" || best.score.total <= row.score.total) return null;

  const free_rectangles = findFreeRectangles(drawerSize, best.candidate.placed_zones);
  const used_width_cm = usedWidth(best.candidate.placed_zones);
  const used_depth_cm = usedDepth(best.candidate.placed_zones);
  const used_height_cm = usedHeight(best.candidate.placed_zones);
  return {
    ...currentFit,
    placed_zones: best.candidate.placed_zones,
    unplaced_zones: [],
    failed_zones: [],
    best_attempt: { placed_count: best.candidate.placed_zones.length },
    failed_dimension: undefined,
    missing_width_cm: 0,
    missing_depth_cm: 0,
    missing_height_cm: 0,
    used_width_cm,
    used_depth_cm,
    used_height_cm,
    overflow_width_cm: 0,
    overflow_depth_cm: 0,
    overflow_height_cm: 0,
    free_rectangles,
    available_box: free_rectangles[0] ? { ...free_rectangles[0] } : undefined,
    fit_notes: [...currentFit.fit_notes, `Selected depth-stack primary fit candidate (${best.candidate.id}) over row_by_width; score ${round(best.score.total)} vs ${round(row.score.total)}.`],
    content_warnings: best.candidate.content_warnings,
    placement_attempts: best.candidate.placed_zones.map((zone) => ({ content_type: zone.content_type, zone_id: zone.zone_id, placed: true, selected_rect: { x_cm: zone.x_cm, y_cm: zone.y_cm, w_cm: drawerSize.w_cm - zone.x_cm, d_cm: drawerSize.d_cm - zone.y_cm, h_cm: drawerSize.h_cm }, soft_height_warning: zone.soft_height_warning }))
  };
}

function buildDepthStackCandidates(zones: PlacedZone[], drawerSize: DrawerSize): Candidate[] {
  const permutations = permute(zones);
  const candidates: Candidate[] = [];
  for (const [top, bottom, adjacent] of permutations) {
    const stacked = stackTwo(top, bottom, 0, 0, drawerSize);
    if (!stacked) continue;
    if (!adjacent) {
      candidates.push({ id: `stack_${top.zone_id}_${bottom.zone_id}`, placed_zones: stacked.placed, content_warnings: stacked.warnings });
      continue;
    }
    const right = placeZone(adjacent, stacked.column_w_cm, 0, drawerSize);
    if (right && stacked.column_w_cm + zoneWidth(adjacent) <= drawerSize.w_cm && Math.max(stacked.column_d_cm, zoneDepth(adjacent)) <= drawerSize.d_cm) {
      candidates.push({ id: `stack_${top.zone_id}_${bottom.zone_id}_left_of_${adjacent.zone_id}`, placed_zones: [...stacked.placed, right.placed], content_warnings: [...stacked.warnings, ...right.warnings] });
    }
    const left = placeZone(adjacent, 0, 0, drawerSize);
    const shiftedStack = stackTwo(top, bottom, zoneWidth(adjacent), 0, drawerSize);
    if (left && shiftedStack && zoneWidth(adjacent) + shiftedStack.column_w_cm <= drawerSize.w_cm && Math.max(zoneDepth(adjacent), shiftedStack.column_d_cm) <= drawerSize.d_cm) {
      candidates.push({ id: `${adjacent.zone_id}_left_of_stack_${top.zone_id}_${bottom.zone_id}`, placed_zones: [left.placed, ...shiftedStack.placed], content_warnings: [...left.warnings, ...shiftedStack.warnings] });
    }
  }
  return candidates;
}

function stackTwo(top: CalculatedZone, bottom: CalculatedZone, x_cm: number, y_cm: number, drawerSize: DrawerSize) {
  const column_w_cm = Math.max(zoneWidth(top), zoneWidth(bottom));
  const column_d_cm = zoneDepth(top) + zoneDepth(bottom);
  if (x_cm + column_w_cm > drawerSize.w_cm || y_cm + column_d_cm > drawerSize.d_cm) return null;
  const topPlacement = placeZone(top, x_cm, y_cm, drawerSize);
  const bottomPlacement = placeZone(bottom, x_cm, y_cm + zoneDepth(top), drawerSize);
  if (!topPlacement || !bottomPlacement) return null;
  return { column_w_cm, column_d_cm, placed: [topPlacement.placed, bottomPlacement.placed], warnings: [...topPlacement.warnings, ...bottomPlacement.warnings] };
}

function placeZone(zone: CalculatedZone, x_cm: number, y_cm: number, drawerSize: DrawerSize): { placed: PlacedZone; warnings: SoftHeightWarning[] } | null {
  const zoneW = zoneWidth(zone);
  const zoneD = zoneDepth(zone);
  const zoneH = zoneHeight(zone);
  if (x_cm + zoneW > drawerSize.w_cm || y_cm + zoneD > drawerSize.d_cm) return null;
  const warning = buildSoftHeightWarning({ w_cm: drawerSize.w_cm - x_cm, d_cm: drawerSize.d_cm - y_cm, h_cm: drawerSize.h_cm }, zoneW, zoneD, zoneH, zone);
  if (zoneH > drawerSize.h_cm && !warning) return null;
  const placed = { ...zone, x_cm, y_cm, assigned_w_cm: zoneW, assigned_d_cm: zoneD, assigned_h_cm: zoneH, soft_height_warning: warning };
  return { placed, warnings: warning ? [warning] : [] };
}

function scoreCandidate(candidate: Candidate, drawerSize: DrawerSize) {
  const free_rectangles = findFreeRectangles(drawerSize, candidate.placed_zones);
  const fitResult = minimalFitResult(candidate.placed_zones, candidate.content_warnings, free_rectangles);
  const evaluations = evaluatePlacementRules({ drawerSize, fitResult });
  const ruleScore = evaluations.reduce((sum, evaluation) => sum + (RULE_STATUS_WEIGHTS[evaluation.rule_id] ?? 0) * statusScore(evaluation.status), 0);
  const depth_utilization = usedDepth(candidate.placed_zones) / drawerSize.d_cm;
  const rightReserveBonus = rightSideReserveBonus(free_rectangles, drawerSize);
  const rearReservePenalty = rearReservePenaltyScore(free_rectangles, candidate.placed_zones, drawerSize);
  const d04bOpportunityBonus = Math.min(Number(evaluations.find((evaluation) => evaluation.rule_id === "D04b")?.details?.opportunity_count ?? 0), 3) * 8;
  const total = ruleScore + depth_utilization * 260 + rightReserveBonus + d04bOpportunityBonus - rearReservePenalty;
  return { total, depth_utilization, used_width_cm: usedWidth(candidate.placed_zones) };
}

function minimalFitResult(placed_zones: PlacedZone[], content_warnings: SoftHeightWarning[], free_rectangles: FitResult["free_rectangles"]): FitResult {
  return { fit_status: "fit_all", placed_zones, unplaced_zones: [], failed_zones: [], best_attempt: { placed_count: placed_zones.length }, missing_width_cm: 0, missing_depth_cm: 0, missing_height_cm: 0, used_width_cm: usedWidth(placed_zones), used_depth_cm: usedDepth(placed_zones), used_height_cm: usedHeight(placed_zones), overflow_width_cm: 0, overflow_depth_cm: 0, overflow_height_cm: 0, free_rectangles, available_box: free_rectangles[0] ? { ...free_rectangles[0] } : undefined, fit_notes: [], content_warnings };
}

function statusScore(status: string) {
  if (status === "pass") return 1;
  if (status === "not_applicable" || status === "report" || status === "opportunity") return 0.35;
  return -1;
}
function rightSideReserveBonus(freeRectangles: FitResult["free_rectangles"], drawerSize: DrawerSize) { return freeRectangles.some((rect) => nearlyEqual(rect.x_cm + rect.w_cm, drawerSize.w_cm) && rect.d_cm >= drawerSize.d_cm * 0.5) ? 35 : 0; }
function rearReservePenaltyScore(freeRectangles: FitResult["free_rectangles"], zones: PlacedZone[], drawerSize: DrawerSize) {
  const mainDepth = usedDepth(zones);
  return freeRectangles.some((rect) => rect.y_cm >= mainDepth - 0.0001 && rect.d_cm >= drawerSize.d_cm * 0.4 && rect.w_cm >= drawerSize.w_cm * 0.5) ? 120 : 0;
}
function dedupeCandidates(candidates: Candidate[]) { const seen = new Set<string>(); return candidates.filter((candidate) => { const key = candidate.placed_zones.map((zone) => `${zone.zone_id}:${zone.x_cm}:${zone.y_cm}`).join("|"); if (seen.has(key)) return false; seen.add(key); return zonesDoNotOverlap(candidate.placed_zones); }); }
function zonesDoNotOverlap(zones: PlacedZone[]) { for (let i = 0; i < zones.length; i += 1) for (let j = i + 1; j < zones.length; j += 1) if (rectanglesOverlap(zones[i], zones[j])) return false; return true; }
function rectanglesOverlap(a: PlacedZone, b: PlacedZone) { return a.x_cm < b.x_cm + b.assigned_w_cm && a.x_cm + a.assigned_w_cm > b.x_cm && a.y_cm < b.y_cm + b.assigned_d_cm && a.y_cm + a.assigned_d_cm > b.y_cm; }
function permute<T>(items: T[]): T[][] { if (items.length <= 1) return [items]; return items.flatMap((item, index) => permute([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest])); }
function zoneWidth(zone: CalculatedZone) { return zone.assigned_box_w_cm ?? zone.zone_w_cm; }
function zoneDepth(zone: CalculatedZone) { return zone.assigned_box_d_cm ?? zone.zone_d_cm; }
function zoneHeight(zone: CalculatedZone) { return zone.assigned_box_h_cm ?? zone.zone_h_cm; }
function usedWidth(zones: PlacedZone[]) { return zones.reduce((max, zone) => Math.max(max, zone.x_cm + zone.assigned_w_cm), 0); }
function usedDepth(zones: PlacedZone[]) { return zones.reduce((max, zone) => Math.max(max, zone.y_cm + zone.assigned_d_cm), 0); }
function usedHeight(zones: PlacedZone[]) { return zones.reduce((max, zone) => Math.max(max, zone.assigned_h_cm), 0); }
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
function nearlyEqual(a: number, b: number) { return Math.abs(a - b) < 0.0001; }
function round(value: number) { return Number(value.toFixed(4)); }
