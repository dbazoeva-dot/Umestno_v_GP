import type { DrawerSize, FitResult, LayoutRuleEvaluation, PlacedZone, RuleDefinition } from "../types.js";
import { ruleDefinitions } from "./ruleDefinitions.js";

type FreeRectangle = FitResult["free_rectangles"][number];

export function evaluatePlacementRules({ drawerSize, fitResult, definitions = ruleDefinitions }: { drawerSize: DrawerSize; fitResult: FitResult; definitions?: RuleDefinition[] }): LayoutRuleEvaluation[] {
  const definitionById = new Map(definitions.map((definition) => [definition.rule_id, definition]));
  const placedZones = fitResult.placed_zones;
  return [
    evaluateZoneIntegrity(drawerSize, placedZones, definitionById),
    evaluateD01(placedZones, definitionById),
    evaluateD02(placedZones, definitionById),
    evaluateD03(placedZones, definitionById),
    evaluateD04(drawerSize, fitResult.free_rectangles, definitionById),
    evaluateD04b(placedZones, fitResult.free_rectangles, definitionById),
    evaluateD05(placedZones, definitionById),
    evaluateD06(placedZones, definitionById)
  ];
}

function evaluation(ruleId: string, definitionById: Map<string, RuleDefinition>, evaluation: Omit<LayoutRuleEvaluation, "rule_id" | "title" | "enforcement">): LayoutRuleEvaluation {
  const definition = definitionById.get(ruleId);
  return { rule_id: ruleId, title: definition?.title ?? ruleId, enforcement: definition?.enforcement ?? "definition_only", ...evaluation };
}

function evaluateZoneIntegrity(drawerSize: DrawerSize, zones: PlacedZone[], definitionById: Map<string, RuleDefinition>) {
  const outOfBounds = zones.filter((zone) => zone.x_cm < 0 || zone.y_cm < 0 || zone.x_cm + zone.assigned_w_cm > drawerSize.w_cm || zone.y_cm + zone.assigned_d_cm > drawerSize.d_cm).map((zone) => zone.zone_id);
  const overlaps: string[] = [];
  for (let i = 0; i < zones.length; i += 1) for (let j = i + 1; j < zones.length; j += 1) {
    if (rectanglesOverlap(zones[i], zones[j])) overlaps.push(`${zones[i].zone_id}:${zones[j].zone_id}`);
  }
  const passed = outOfBounds.length === 0 && overlaps.length === 0;
  return evaluation("ZONE_INTEGRITY", definitionById, { status: passed ? "pass" : "violation", message: passed ? "All assigned zones are inside the drawer and do not overlap." : "One or more assigned zones are out of bounds or overlapping.", details: { assigned_zone_count: zones.length, out_of_bounds_zone_ids: outOfBounds, overlapping_zone_pairs: overlaps } });
}

function evaluateD01(zones: PlacedZone[], definitionById: Map<string, RuleDefinition>) {
  const categories = [...new Set(zones.map((zone) => semanticStorageCategory(zone.content_type)))];
  const disconnected = categories.filter((category) => !categoryIsConnected(zones.filter((zone) => semanticStorageCategory(zone.content_type) === category)));
  if (zones.length <= 1 || categories.every((category) => zones.filter((zone) => semanticStorageCategory(zone.content_type) === category).length <= 1)) return evaluation("D01", definitionById, { status: "not_applicable", message: "No repeated semantic storage category requires adjacency.", details: { semantic_storage_categories: categories } });
  return evaluation("D01", definitionById, { status: disconnected.length ? "violation" : "pass", message: disconnected.length ? "At least one semantic storage-category group is not contiguous after placement." : "Semantic storage-category groups are contiguous after placement.", details: { semantic_storage_categories: categories, disconnected_storage_categories: disconnected } });
}

function evaluateD02(zones: PlacedZone[], definitionById: Map<string, RuleDefinition>) {
  const socks = zones.find((zone) => zone.content_type === "socks_regular" || zone.content_type === "socks");
  const bras = zones.find((zone) => zone.content_type === "bras");
  const panties = zones.find((zone) => zone.content_type === "panties");
  if (!socks || !bras || !panties) return evaluation("D02", definitionById, { status: "not_applicable", message: "Socks, bras, and panties are not all present.", details: { has_socks: Boolean(socks), has_bras: Boolean(bras), has_panties: Boolean(panties) } });
  const socksBetween = centerBetween(socks, bras, panties, "x") || centerBetween(socks, bras, panties, "y");
  return evaluation("D02", definitionById, { status: socksBetween ? "violation" : "pass", message: socksBetween ? "Socks are geometrically between bras and panties after placement." : "Socks are not between bras and panties after placement.", details: { socks_center: center(socks), bras_center: center(bras), panties_center: center(panties) } });
}

function evaluateD03(zones: PlacedZone[], definitionById: Map<string, RuleDefinition>) {
  if (zones.length === 0) return evaluation("D03", definitionById, { status: "not_applicable", message: "No assigned zones are available for compactness reporting.", details: { assigned_zone_count: 0 } });
  const minX = Math.min(...zones.map((zone) => zone.x_cm));
  const minY = Math.min(...zones.map((zone) => zone.y_cm));
  const maxX = Math.max(...zones.map((zone) => zone.x_cm + zone.assigned_w_cm));
  const maxY = Math.max(...zones.map((zone) => zone.y_cm + zone.assigned_d_cm));
  const assignedArea = zones.reduce((sum, zone) => sum + zone.assigned_w_cm * zone.assigned_d_cm, 0);
  const boundingArea = (maxX - minX) * (maxY - minY);
  return evaluation("D03", definitionById, { status: "report", message: "Compactness is reported only and does not change placement.", details: { assigned_zone_count: zones.length, assigned_area_cm2: round(assignedArea), bounding_area_cm2: round(boundingArea), compactness_ratio: boundingArea > 0 ? round(assignedArea / boundingArea) : 0 } });
}

function evaluateD04(drawerSize: DrawerSize, freeRectangles: FreeRectangle[], definitionById: Map<string, RuleDefinition>) {
  const edgeReserveCount = freeRectangles.filter((rect) => touchesDrawerEdge(rect, drawerSize)).length;
  return evaluation("D04", definitionById, { status: "report", message: "Reserve edge placement is reported only and does not change placement.", details: { reserve_rectangle_count: freeRectangles.length, edge_reserve_rectangle_count: edgeReserveCount, all_reserve_at_edge: freeRectangles.every((rect) => touchesDrawerEdge(rect, drawerSize)) } });
}

function evaluateD04b(zones: PlacedZone[], freeRectangles: FreeRectangle[], definitionById: Map<string, RuleDefinition>) {
  const opportunities = freeRectangles.flatMap((rect) => zones.filter((zone) => sameWidthSpan(zone, rect) && (nearlyEqual(zone.y_cm + zone.assigned_d_cm, rect.y_cm) || nearlyEqual(rect.y_cm + rect.d_cm, zone.y_cm))).map((zone) => ({ zone_id: zone.zone_id, content_type: zone.content_type, reserve_rect: rect, absorbable_depth_cm: rect.d_cm })));
  return evaluation("D04b", definitionById, { status: opportunities.length ? "opportunity" : "report", message: opportunities.length ? "Depth reserve absorption opportunities were found; assigned dimensions and capacity were not mutated." : "No depth reserve absorption opportunity was found; placement remains unchanged.", details: { opportunity_count: opportunities.length, opportunities } });
}

function evaluateD05(zones: PlacedZone[], definitionById: Map<string, RuleDefinition>) {
  const violations: string[] = [];
  for (const high of zones.filter((zone) => accessScore(zone.access_frequency) >= 8)) {
    for (const lower of zones.filter((zone) => accessScore(zone.access_frequency) < accessScore(high.access_frequency))) {
      if (high.y_cm > lower.y_cm && xSpansOverlap(high, lower)) violations.push(`${high.zone_id}_behind_${lower.zone_id}`);
    }
  }
  return evaluation("D05", definitionById, { status: violations.length ? "violation" : "pass", message: violations.length ? "At least one high-frequency zone is behind a lower-frequency zone." : "High-frequency zones are not behind lower-frequency zones.", details: { violation_pairs: violations } });
}

function evaluateD06(zones: PlacedZone[], definitionById: Map<string, RuleDefinition>) {
  const brasZones = zones.filter((zone) => zone.content_type === "bras");
  if (brasZones.length === 0) return evaluation("D06", definitionById, { status: "not_applicable", message: "No bras zone is assigned.", details: { bras_zone_count: 0 } });
  const compressed = brasZones.filter((zone) => zone.assigned_h_cm < zone.zone_h_cm || zone.soft_height_warning?.warning_code === "deformation_risk").map((zone) => zone.zone_id);
  return evaluation("D06", definitionById, { status: compressed.length ? "violation" : "pass", message: compressed.length ? "At least one bras zone relies on compressed-height placement." : "Bras zones do not rely on compressed-height placement.", details: { bras_zone_count: brasZones.length, compressed_bras_zone_ids: compressed } });
}

function rectanglesOverlap(a: PlacedZone, b: PlacedZone) { return a.x_cm < b.x_cm + b.assigned_w_cm && a.x_cm + a.assigned_w_cm > b.x_cm && a.y_cm < b.y_cm + b.assigned_d_cm && a.y_cm + a.assigned_d_cm > b.y_cm; }
function categoryIsConnected(zones: PlacedZone[]) {
  if (zones.length <= 1) return true;
  const visited = new Set<string>();
  const pending = [zones[0]];
  while (pending.length) {
    const zone = pending.pop();
    if (!zone || visited.has(zone.zone_id)) continue;
    visited.add(zone.zone_id);
    for (const next of zones) if (!visited.has(next.zone_id) && zonesAdjacent(zone, next)) pending.push(next);
  }
  return visited.size === zones.length;
}
function zonesAdjacent(a: PlacedZone, b: PlacedZone) { return (nearlyEqual(a.x_cm + a.assigned_w_cm, b.x_cm) || nearlyEqual(b.x_cm + b.assigned_w_cm, a.x_cm)) && rangesOverlap(a.y_cm, a.y_cm + a.assigned_d_cm, b.y_cm, b.y_cm + b.assigned_d_cm) || (nearlyEqual(a.y_cm + a.assigned_d_cm, b.y_cm) || nearlyEqual(b.y_cm + b.assigned_d_cm, a.y_cm)) && rangesOverlap(a.x_cm, a.x_cm + a.assigned_w_cm, b.x_cm, b.x_cm + b.assigned_w_cm); }
function center(zone: PlacedZone) { return { x_cm: round(zone.x_cm + zone.assigned_w_cm / 2), y_cm: round(zone.y_cm + zone.assigned_d_cm / 2) }; }
function centerBetween(target: PlacedZone, a: PlacedZone, b: PlacedZone, axis: "x" | "y") { const key = axis === "x" ? "x_cm" : "y_cm"; const t = center(target)[key]; const av = center(a)[key]; const bv = center(b)[key]; return t > Math.min(av, bv) && t < Math.max(av, bv); }
function touchesDrawerEdge(rect: FreeRectangle, drawerSize: DrawerSize) { return nearlyEqual(rect.x_cm, 0) || nearlyEqual(rect.y_cm, 0) || nearlyEqual(rect.x_cm + rect.w_cm, drawerSize.w_cm) || nearlyEqual(rect.y_cm + rect.d_cm, drawerSize.d_cm); }
function sameWidthSpan(zone: PlacedZone, rect: FreeRectangle) { return nearlyEqual(zone.x_cm, rect.x_cm) && nearlyEqual(zone.assigned_w_cm, rect.w_cm); }
function xSpansOverlap(a: PlacedZone, b: PlacedZone) { return rangesOverlap(a.x_cm, a.x_cm + a.assigned_w_cm, b.x_cm, b.x_cm + b.assigned_w_cm); }
function rangesOverlap(a1: number, a2: number, b1: number, b2: number) { return a1 < b2 && a2 > b1; }
function nearlyEqual(a: number, b: number) { return Math.abs(a - b) < 0.0001; }
function accessScore(value: number | string) { return typeof value === "number" ? value : ({ high: 9, medium: 6, low: 3 }[value] ?? 0); }
function round(value: number) { return Number(value.toFixed(4)); }

function semanticStorageCategory(contentType: string) {
  if (["socks", "socks_regular", "panties", "boxers", "bras", "tights", "sport_tops", "thermals"].includes(contentType)) return "underwear";
  if (["tshirts", "longsleeves", "sweaters", "jeans", "leggings", "shorts", "pajamas", "nightgowns"].includes(contentType)) return "soft_clothes";
  if (["belts", "jewelry_large", "jewelry_small", "scarves", "ties", "swimwear"].includes(contentType)) return "accessories";
  return "mixed";
}
