import type { DrawerSize, FitResult, LayoutRuleEvaluation, PlacedZone, RuleDefinition, StorageUnitProfileRow } from "../types.js";
import { layoutRuleDefinitions } from "./ruleDefinitions.js";

type Rect = { x_cm: number; y_cm: number; w_cm: number; d_cm: number };

type RuleContext = {
  drawerSize: DrawerSize;
  fitResult: FitResult;
  storageUnitProfile: StorageUnitProfileRow[];
  layoutRuleDefinitions?: RuleDefinition[];
};

const EPS = 0.000001;
const evaluatedRuleIds = ["ZONE_INTEGRITY", "D01", "D02", "D03", "D04", "D04b", "D05", "D06"];

export function evaluatePlacementRules({ drawerSize, fitResult, storageUnitProfile, layoutRuleDefinitions: definitions = layoutRuleDefinitions }: RuleContext): LayoutRuleEvaluation[] {
  const definitionMap = new Map(definitions.map((definition) => [definition.rule_id, definition]));
  const zones = fitResult.placed_zones;
  return evaluatedRuleIds.map((ruleId) => {
    const definition = definitionMap.get(ruleId);
    if (!definition) return { rule_id: ruleId, rule_name: ruleId, status: "not_verifiable", is_hard_rule: false, message: "Rule definition is missing from runtime layout rules.", affected_zones: [], evidence: {} };
    if (ruleId === "ZONE_INTEGRITY") return evaluateZoneIntegrity(definition, zones);
    if (ruleId === "D01") return evaluateD01(definition, zones, storageUnitProfile);
    if (ruleId === "D02") return evaluateD02(definition, zones);
    if (ruleId === "D03") return evaluateD03(definition, zones);
    if (ruleId === "D04") return evaluateD04(definition, fitResult.free_rectangles, drawerSize);
    if (ruleId === "D04b") return evaluateD04b(definition, zones, fitResult.free_rectangles, drawerSize);
    if (ruleId === "D05") return evaluateD05(definition, zones);
    return evaluateD06(definition, zones, drawerSize);
  });
}

function base(definition: RuleDefinition, status: LayoutRuleEvaluation["status"], message: string, affected_zones: string[], evidence: Record<string, unknown>): LayoutRuleEvaluation {
  return { rule_id: definition.rule_id, rule_name: definition.rule_name, status, is_hard_rule: definition.is_hard_rule, message, affected_zones, evidence };
}

function evaluateZoneIntegrity(definition: RuleDefinition, zones: PlacedZone[]) {
  if (!zones.length) return base(definition, "not_applicable", "No placed zones to evaluate.", [], { placed_count: 0 });
  const byContent = new Map<string, Set<string>>();
  for (const zone of zones) {
    const divisions = byContent.get(zone.content_type) ?? new Set<string>();
    divisions.add(zone.division_type);
    byContent.set(zone.content_type, divisions);
  }
  const violations = [...byContent.entries()].filter(([, divisions]) => divisions.size > 1);
  if (violations.length) return base(definition, "violated", "At least one content_type is split across multiple division_type values.", violations.map(([contentType]) => contentType), { divisions_by_content_type: Object.fromEntries(violations.map(([contentType, divisions]) => [contentType, [...divisions]])) });
  return base(definition, "ok", "Each placed content_type uses a single division_type. Internal multi-lane slots remain one parent slots zone.", zones.map((zone) => zone.zone_id), { divisions_by_content_type: Object.fromEntries([...byContent.entries()].map(([contentType, divisions]) => [contentType, [...divisions]])) });
}

function evaluateD01(definition: RuleDefinition, zones: PlacedZone[], profiles: StorageUnitProfileRow[]) {
  const profileByType = new Map(profiles.map((profile) => [profile.content_type, profile]));
  const groups = new Map<string, PlacedZone[]>();
  const missingGroupFor: string[] = [];
  for (const zone of zones) {
    const group = profileByType.get(zone.content_type)?.storage_category;
    if (!group || group === "mixed") { missingGroupFor.push(zone.content_type); continue; }
    groups.set(group, [...(groups.get(group) ?? []), zone]);
  }
  if (missingGroupFor.length) return base(definition, "not_verifiable", "Some placed zones do not have semantic group/storage_category metadata.", missingGroupFor, { missing_group_for: missingGroupFor });
  const applicable = [...groups.entries()].filter(([, groupZones]) => groupZones.length >= 2);
  if (!applicable.length) return base(definition, "not_applicable", "No semantic group has more than one placed zone.", [], { groups: Object.fromEntries([...groups.entries()].map(([group, groupZones]) => [group, groupZones.map((zone) => zone.content_type)])) });
  const disconnected = applicable.filter(([, groupZones]) => !isConnectedCluster(groupZones));
  if (disconnected.length) return base(definition, "violated", "At least one semantic group is split into disconnected 2D clusters.", disconnected.flatMap(([, groupZones]) => groupZones.map((zone) => zone.zone_id)), { groups: Object.fromEntries(applicable.map(([group, groupZones]) => [group, summarizeZones(groupZones)])), disconnected_groups: disconnected.map(([group]) => group) });
  return base(definition, "ok", "Placed zones in each applicable semantic group form a connected 2D cluster.", applicable.flatMap(([, groupZones]) => groupZones.map((zone) => zone.zone_id)), { groups: Object.fromEntries(applicable.map(([group, groupZones]) => [group, summarizeZones(groupZones)])) });
}

function evaluateD02(definition: RuleDefinition, zones: PlacedZone[]) {
  const bras = zones.find((zone) => zone.content_type === "bras");
  const panties = zones.find((zone) => zone.content_type === "panties");
  const socks = zones.find((zone) => zone.content_type === "socks_regular" || zone.content_type === "socks");
  if (!bras || !panties || !socks) return base(definition, "not_applicable", "D02 requires placed bras, panties, and socks zones.", [], { has_bras: Boolean(bras), has_panties: Boolean(panties), has_socks: Boolean(socks) });
  const brasCenter = center(bras);
  const pantiesCenter = center(panties);
  const socksCenter = center(socks);
  const axis = "x";
  const between = isBetween(socksCenter.x, brasCenter.x, pantiesCenter.x);
  return base(definition, between ? "violated" : "ok", between ? "Socks are positioned between bras and panties along the x-axis." : "Socks are not between bras and panties along the x-axis.", [bras.zone_id, socks.zone_id, panties.zone_id], { axis, centers: { bras: brasCenter, socks: socksCenter, panties: pantiesCenter } });
}

function evaluateD03(definition: RuleDefinition, zones: PlacedZone[]) {
  if (zones.length < 2) return base(definition, "not_applicable", "D03 requires multiple main zones.", zones.map((zone) => zone.zone_id), { placed_count: zones.length });
  const connected = isConnectedCluster(zones);
  return base(definition, connected ? "ok" : "violated", connected ? "Main zones form a connected compact 2D cluster." : "Main zones are separated into disconnected clusters, indicating an internal placement gap.", zones.map((zone) => zone.zone_id), { zones: summarizeZones(zones), connected });
}

function evaluateD04(definition: RuleDefinition, freeRectangles: FitResult["free_rectangles"], drawerSize: DrawerSize) {
  if (!freeRectangles.length) return base(definition, "not_applicable", "No free reserve rectangles remain after placement.", [], { free_rectangles_count: 0 });
  const internal = freeRectangles.filter((rect) => !touchesDrawerEdge(rect, drawerSize));
  if (internal.length) return base(definition, "violated", "At least one free/reserve rectangle does not touch a drawer edge.", [], { internal_free_rectangles: internal, free_rectangles: freeRectangles });
  return base(definition, "ok", "All free/reserve rectangles touch a drawer edge.", [], { free_rectangles: freeRectangles });
}

function evaluateD04b(definition: RuleDefinition, zones: PlacedZone[], freeRectangles: FitResult["free_rectangles"], drawerSize: DrawerSize) {
  const opportunities = [] as Array<Record<string, unknown>>;
  for (const zone of zones) {
    const behind = freeRectangles.find((rect) => rect.y_cm >= zone.y_cm + zone.assigned_d_cm - EPS && overlapLength(zone.x_cm, zone.x_cm + zone.assigned_w_cm, rect.x_cm, rect.x_cm + rect.w_cm) > EPS && rect.d_cm > EPS);
    if (behind) opportunities.push({ content_type: zone.content_type, zone_id: zone.zone_id, current_assigned_d_cm: zone.assigned_d_cm, drawer_d_cm: drawerSize.d_cm, available_extra_depth_cm: Math.min(drawerSize.d_cm - (zone.y_cm + zone.assigned_d_cm), behind.d_cm), free_rectangle_behind_zone: behind });
  }
  if (!opportunities.length) return base(definition, "not_applicable", "No direct free depth behind placed zones was detected.", [], { drawer_d_cm: drawerSize.d_cm });
  return base(definition, "opportunity", "One or more zones have unused free depth behind them; this PR reports the opportunity only and does not modify assigned_d.", opportunities.map((item) => String(item.zone_id)), { opportunities });
}

function evaluateD05(definition: RuleDefinition, zones: PlacedZone[]) {
  const cells = zones.filter((zone) => zone.division_type === "cells");
  if (cells.length < 2) return base(definition, "not_applicable", "D05 requires at least two placed cells zones.", cells.map((zone) => zone.zone_id), { cells_count: cells.length });
  const connected = isConnectedCluster(cells);
  return base(definition, connected ? "ok" : "violated", connected ? "Cells zones form a connected 2D adjacency cluster." : "Cells zones are separated and do not form a connected 2D adjacency cluster.", cells.map((zone) => zone.zone_id), { cells: summarizeZones(cells), connected });
}

function evaluateD06(definition: RuleDefinition, zones: PlacedZone[], drawerSize: DrawerSize) {
  const bras = zones.find((zone) => zone.content_type === "bras");
  if (!bras) return base(definition, "not_applicable", "No placed bras zone.", [], { has_bras: false });
  const touchesEdge = zoneTouchesDrawerEdge(bras, drawerSize);
  return base(definition, touchesEdge ? "ok" : "violated", touchesEdge ? "Bras zone touches a drawer edge." : "Bras zone is present but touches no drawer edge.", [bras.zone_id], { bras: summarizeZone(bras), drawer: drawerSize, touches_edge: touchesEdge });
}

function isConnectedCluster(zones: PlacedZone[]) {
  if (zones.length <= 1) return true;
  const visited = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const current = queue.shift()!;
    zones.forEach((zone, index) => {
      if (!visited.has(index) && areAdjacent(zones[current]!, zone)) { visited.add(index); queue.push(index); }
    });
  }
  return visited.size === zones.length;
}

function areAdjacent(a: PlacedZone, b: PlacedZone) {
  const xOverlap = overlapLength(a.x_cm, a.x_cm + a.assigned_w_cm, b.x_cm, b.x_cm + b.assigned_w_cm) > EPS;
  const yOverlap = overlapLength(a.y_cm, a.y_cm + a.assigned_d_cm, b.y_cm, b.y_cm + b.assigned_d_cm) > EPS;
  const touchX = Math.abs(a.x_cm + a.assigned_w_cm - b.x_cm) < EPS || Math.abs(b.x_cm + b.assigned_w_cm - a.x_cm) < EPS;
  const touchY = Math.abs(a.y_cm + a.assigned_d_cm - b.y_cm) < EPS || Math.abs(b.y_cm + b.assigned_d_cm - a.y_cm) < EPS;
  return (touchX && yOverlap) || (touchY && xOverlap);
}

function overlapLength(aStart: number, aEnd: number, bStart: number, bEnd: number) { return Math.min(aEnd, bEnd) - Math.max(aStart, bStart); }
function center(zone: PlacedZone) { return { x: zone.x_cm + zone.assigned_w_cm / 2, y: zone.y_cm + zone.assigned_d_cm / 2 }; }
function isBetween(value: number, a: number, b: number) { return value > Math.min(a, b) && value < Math.max(a, b); }
function zoneTouchesDrawerEdge(zone: PlacedZone, drawerSize: DrawerSize) { return Math.abs(zone.x_cm) < EPS || Math.abs(zone.y_cm) < EPS || Math.abs(zone.x_cm + zone.assigned_w_cm - drawerSize.w_cm) < EPS || Math.abs(zone.y_cm + zone.assigned_d_cm - drawerSize.d_cm) < EPS; }
function touchesDrawerEdge(rect: FitResult["free_rectangles"][number], drawerSize: DrawerSize) { return Math.abs(rect.x_cm) < EPS || Math.abs(rect.y_cm) < EPS || Math.abs(rect.x_cm + rect.w_cm - drawerSize.w_cm) < EPS || Math.abs(rect.y_cm + rect.d_cm - drawerSize.d_cm) < EPS; }
function summarizeZones(zones: PlacedZone[]) { return zones.map(summarizeZone); }
function summarizeZone(zone: PlacedZone) { return { zone_id: zone.zone_id, content_type: zone.content_type, division_type: zone.division_type, x_cm: zone.x_cm, y_cm: zone.y_cm, w_cm: zone.assigned_w_cm, d_cm: zone.assigned_d_cm }; }
