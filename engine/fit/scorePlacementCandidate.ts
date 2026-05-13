import type { DrawerSize, FitResult, LayoutRuleEvaluation, PlacedZone } from "../types.js";
import { evaluatePlacementRules } from "../rules/evaluatePlacementRules.js";

export function scorePlacementCandidate(fitResult: FitResult, drawerSize: DrawerSize, evaluations?: LayoutRuleEvaluation[]): number {
  const evals = evaluations ?? evaluatePlacementRules({ drawerSize, fitResult });
  const zones = fitResult.placed_zones;

  const d08_access = dimensionScore(evals, "D05");
  const d01 = dimensionScore(evals, "D01");
  const d03 = compactnessScore(evals);
  const d04 = edgeReserveScore(evals);

  const d06_pos = brasPositionScore(zones, drawerSize);
  const depth_util = Math.min(fitResult.used_depth_cm / drawerSize.d_cm, 1);
  const no_deformation_risk = fitResult.content_warnings.some((w) => w.warning_code === "deformation_risk") ? 0 : 1;
  const no_compressed_storage = fitResult.content_warnings.some((w) => w.warning_code === "compressed_storage") ? 0 : 1;
  const d05_cells = cellsAdjacentScore(zones);

  const zone_efficiency = zones.length === 0 ? 1 : zones.reduce((sum, z) => sum + (z.count / Math.max(z.capacity, 1)), 0) / zones.length;

  return (
    no_deformation_risk * 180 +
    d08_access * 200 +
    d06_pos * 150 +
    d01 * 130 +
    zone_efficiency * 100 +
    d05_cells * 100 +
    depth_util * 80 +
    d03 * 70 +
    no_compressed_storage * 60 +
    d04 * 60
  );
}

function dimensionScore(evals: LayoutRuleEvaluation[], ruleId: string): number {
  const ev = evals.find((e) => e.rule_id === ruleId);
  if (!ev) return 0;
  if (ev.status === "pass" || ev.status === "not_applicable") return 1;
  if (ev.status === "report" || ev.status === "opportunity") return 0.5;
  return 0;
}

function compactnessScore(evals: LayoutRuleEvaluation[]): number {
  const ev = evals.find((e) => e.rule_id === "D03");
  return typeof ev?.details?.compactness_ratio === "number" ? ev.details.compactness_ratio : 0;
}

function edgeReserveScore(evals: LayoutRuleEvaluation[]): number {
  const ev = evals.find((e) => e.rule_id === "D04");
  if (!ev?.details) return 0;
  const total = ev.details.reserve_rectangle_count as number;
  const edge = ev.details.edge_reserve_rectangle_count as number;
  if (total === 0) return 1;
  return edge / total;
}

function brasPositionScore(zones: PlacedZone[], drawerSize: DrawerSize): number {
  const bras = zones.filter((z) => z.content_type === "bras");
  if (bras.length === 0) return 1;
  const atEdge = bras.every((z) => nearlyEqual(z.x_cm, 0) || nearlyEqual(z.x_cm + z.assigned_w_cm, drawerSize.w_cm));
  return atEdge ? 1 : 0;
}

function cellsAdjacentScore(zones: PlacedZone[]): number {
  const cells = zones.filter((z) => z.division_type === "cells");
  if (cells.length <= 1) return 1;
  return cellsGroupConnected(cells) ? 1 : 0;
}

function cellsGroupConnected(zones: PlacedZone[]): boolean {
  const visited = new Set<string>();
  const pending = [zones[0]];
  while (pending.length) {
    const zone = pending.pop();
    if (!zone || visited.has(zone.zone_id)) continue;
    visited.add(zone.zone_id);
    for (const other of zones) if (!visited.has(other.zone_id) && zonesAdjacent(zone, other)) pending.push(other);
  }
  return visited.size === zones.length;
}

function zonesAdjacent(a: PlacedZone, b: PlacedZone): boolean {
  const xTouches = (nearlyEqual(a.x_cm + a.assigned_w_cm, b.x_cm) || nearlyEqual(b.x_cm + b.assigned_w_cm, a.x_cm)) && rangesOverlap(a.y_cm, a.y_cm + a.assigned_d_cm, b.y_cm, b.y_cm + b.assigned_d_cm);
  const yTouches = (nearlyEqual(a.y_cm + a.assigned_d_cm, b.y_cm) || nearlyEqual(b.y_cm + b.assigned_d_cm, a.y_cm)) && rangesOverlap(a.x_cm, a.x_cm + a.assigned_w_cm, b.x_cm, b.x_cm + b.assigned_w_cm);
  return xTouches || yTouches;
}

function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean { return a1 < b2 && a2 > b1; }
function nearlyEqual(a: number, b: number): boolean { return Math.abs(a - b) < 0.0001; }
