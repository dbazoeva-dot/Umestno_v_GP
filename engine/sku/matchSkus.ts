// SKU matching — реализация спеки из engine/sku/SPEC.md.
// Размерная конвенция:
//   width  — левая стенка → правая
//   depth  — передняя → задняя
//   height — высота борта
// Slot-органайзеры предпочитают ориентацию «слоты вдоль depth».

import type { DivisionType, PlacedZone, SchemePayload, SkuCatalogRow } from "../types.js";

const TOL = { cellW: 3, cellD: 1.5, hUnder: 3, hOver: 5 } as const;

export type MatchKind = "set" | "multipack" | "singles" | null;
export type MatchStatus = "exact" | "composed_from_slots" | "alternative_division" | "no_match";

export interface NoMatchLogEntry {
  zone_id: string;
  content_type: string;
  division_type: DivisionType;
  zone_w_cm: number; zone_d_cm: number; zone_h_cm: number;
  unit_w_cm: number; unit_d_cm: number; unit_h_cm: number;
  units_needed: number;
  preferred_rigidity: string;
}

export interface SkuMatch {
  zone_id: string;
  content_type: string;
  match_status: MatchStatus;
  match_kind: MatchKind;
  units_needed: number;
  packs_needed: number;
  lane_footprint_cm: { w: number; d: number; h: number; capacity: number };
  candidates: SkuCatalogRow[];
  no_match_log?: NoMatchLogEntry;
}

interface LaneGeom { lane_w: number; lane_d: number; lane_h: number; cap_per_lane: number; units_needed: number }

function laneGeometryFromZone(zone: PlacedZone): LaneGeom {
  const lanes = zone.split_used && zone.lanes_needed && zone.lanes_needed > 1 ? zone.lanes_needed : 1;
  const cap = lanes > 1 && zone.items_per_lane?.length ? Math.max(...zone.items_per_lane) : zone.count;
  const gap = lanes > 1 ? zone.slot_lane_gap_cm ?? 0 : 0;
  return {
    lane_w: (zone.assigned_w_cm - gap * (lanes - 1)) / lanes,
    lane_d: zone.assigned_d_cm,
    lane_h: zone.assigned_h_cm,
    cap_per_lane: cap,
    units_needed: lanes,
  };
}

function fitsFootprint(sku: SkuCatalogRow, lane_w: number, lane_d: number, lane_h: number): boolean {
  if (sku.height_cm > lane_h + TOL.hOver) return false;
  const normal = sku.width_cm <= lane_w && sku.depth_cm <= lane_d;
  const rotated = sku.can_rotate === "yes" && sku.depth_cm <= lane_w && sku.width_cm <= lane_d;
  return normal || rotated;
}

function fitsCellSize(sku: SkuCatalogRow, unit_w: number, unit_d: number, unit_h: number): boolean {
  const cw = sku.cell_width_cm ?? sku.width_cm;
  const cd = sku.cell_depth_cm ?? sku.depth_cm;
  if (Math.abs(cw - unit_w) > TOL.cellW) return false;
  if (Math.abs(cd - unit_d) > TOL.cellD) return false;
  if (sku.height_cm < unit_h - TOL.hUnder || sku.height_cm > unit_h + TOL.hOver) return false;
  return true;
}

function passesBaseFilter(sku: SkuCatalogRow, divType: DivisionType, geom: LaneGeom, zone: PlacedZone): boolean {
  if (sku.availability_status === "out_of_stock") return false;
  if (sku.division_type !== divType) return false;
  if ((sku.capacity_units ?? 0) < geom.cap_per_lane) return false;
  if (!fitsCellSize(sku, zone.unit_w_cm, zone.unit_d_cm, zone.unit_h_cm)) return false;
  if (!fitsFootprint(sku, geom.lane_w, geom.lane_d, geom.lane_h)) return false;
  return true;
}

// Sort priority kind (lower = better)
function setKindRank(sku: SkuCatalogRow, N: number): number {
  const sq = sku.set_quantity ?? 1;
  if (sq === N) return 0;                       // ideal set
  if (sq > 1 && sq < N && N % sq === 0) return 1; // clean multipack
  if (sq === 1) return 2;                       // singles
  return 3;                                     // dirty (only if surfaced)
}

const RIGIDITY_ORDER: Record<string, string[]> = {
  soft:       ["soft", "semi_rigid", "rigid"],
  semi_rigid: ["semi_rigid", "rigid", "soft"],
  rigid:      ["rigid", "semi_rigid", "soft"],
};
function rigidityRank(sku: SkuCatalogRow, preferred: string): number {
  const order = RIGIDITY_ORDER[preferred] ?? RIGIDITY_ORDER.rigid;
  const idx = order.indexOf(sku.rigidity);
  return idx === -1 ? order.length : idx;
}

function sortCandidates(list: SkuCatalogRow[], N: number, preferred_rigidity: string, colorPreference: string): SkuCatalogRow[] {
  return [...list].sort((a, b) => {
    const sa = setKindRank(a, N), sb = setKindRank(b, N);
    if (sa !== sb) return sa - sb;
    const ra = rigidityRank(a, preferred_rigidity), rb = rigidityRank(b, preferred_rigidity);
    if (ra !== rb) return ra - rb;
    const ca = a.color_group === colorPreference ? 0 : 1;
    const cb = b.color_group === colorPreference ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return (b.width_cm * b.depth_cm) - (a.width_cm * a.depth_cm);
  });
}

// Split survivors into clean (set_quantity divides N) and dirty (remainder).
// Drops set_quantity > N entirely.
function splitBySetQuantity(list: SkuCatalogRow[], N: number): { clean: SkuCatalogRow[]; dirty: SkuCatalogRow[] } {
  const clean: SkuCatalogRow[] = [];
  const dirty: SkuCatalogRow[] = [];
  for (const sku of list) {
    const sq = sku.set_quantity ?? 1;
    if (sq > N) continue;
    if (N % sq === 0) clean.push(sku); else dirty.push(sku);
  }
  return { clean, dirty };
}

function tryNativeMatch(zone: PlacedZone, geom: LaneGeom, divType: DivisionType, catalog: SkuCatalogRow[], colorPreference: string): SkuCatalogRow[] {
  const base = catalog.filter((sku) => passesBaseFilter(sku, divType, geom, zone));
  const { clean, dirty } = splitBySetQuantity(base, geom.units_needed);
  const cleanSorted = sortCandidates(clean, geom.units_needed, zone.preferred_rigidity, colorPreference);
  if (cleanSorted.length > 0) return cleanSorted;
  return sortCandidates(dirty, geom.units_needed, zone.preferred_rigidity, colorPreference);
}

// Composed-from-slots: only when primary cells gave 0 candidates.
// Tries preferred orientation (slots along depth), then rotated.
function tryComposedFromSlots(zone: PlacedZone, catalog: SkuCatalogRow[], colorPreference: string): { candidates: SkuCatalogRow[]; geom: LaneGeom } | null {
  const cols = zone.calculated_cols, rows = zone.calculated_rows;
  if (!cols || !rows) return null;

  const preferredGeom: LaneGeom = {
    lane_w: zone.assigned_w_cm / cols,
    lane_d: zone.assigned_d_cm,
    lane_h: zone.assigned_h_cm,
    cap_per_lane: Math.ceil(zone.count / cols),
    units_needed: cols,
  };
  const rotatedGeom: LaneGeom = {
    lane_w: zone.assigned_w_cm,
    lane_d: zone.assigned_d_cm / rows,
    lane_h: zone.assigned_h_cm,
    cap_per_lane: Math.ceil(zone.count / rows),
    units_needed: rows,
  };

  // Preferred: slots run along zone's depth → need cols units side-by-side along width.
  // Slot SKU's `cols` (number of slots) must cover `rows` (= depth direction).
  const preferred = catalog.filter((sku) => {
    if (sku.availability_status === "out_of_stock") return false;
    if (sku.division_type !== "slots") return false;
    if ((sku.cols ?? 0) < rows) return false;
    if ((sku.capacity_units ?? 0) < preferredGeom.cap_per_lane) return false;
    if (!fitsCellSize(sku, zone.unit_w_cm, zone.unit_d_cm, zone.unit_h_cm)) return false;
    if (sku.width_cm > preferredGeom.lane_w) return false;
    if (sku.depth_cm > preferredGeom.lane_d) return false;
    return true;
  });

  if (preferred.length > 0) {
    const { clean, dirty } = splitBySetQuantity(preferred, cols);
    const pool = clean.length ? clean : dirty;
    return { candidates: sortCandidates(pool, cols, zone.preferred_rigidity, colorPreference), geom: preferredGeom };
  }

  // Rotated: slots run along zone's width → need rows units stacked along depth.
  // Slot SKU's `cols` must cover `cols` (= width direction). Requires can_rotate=yes.
  const rotated = catalog.filter((sku) => {
    if (sku.can_rotate !== "yes") return false;
    if (sku.availability_status === "out_of_stock") return false;
    if (sku.division_type !== "slots") return false;
    if ((sku.cols ?? 0) < cols) return false;
    if ((sku.capacity_units ?? 0) < rotatedGeom.cap_per_lane) return false;
    // when rotated, slot's cell_width aligns with zone's unit_d_cm
    const cw = sku.cell_width_cm ?? sku.width_cm;
    const cd = sku.cell_depth_cm ?? sku.depth_cm;
    if (Math.abs(cw - zone.unit_d_cm) > TOL.cellD) return false;
    if (Math.abs(cd - zone.unit_w_cm) > TOL.cellW) return false;
    if (sku.height_cm < zone.unit_h_cm - TOL.hUnder || sku.height_cm > zone.unit_h_cm + TOL.hOver) return false;
    if (sku.depth_cm > rotatedGeom.lane_w) return false;
    if (sku.width_cm > rotatedGeom.lane_d) return false;
    return true;
  });

  if (rotated.length > 0) {
    const { clean, dirty } = splitBySetQuantity(rotated, rows);
    const pool = clean.length ? clean : dirty;
    return { candidates: sortCandidates(pool, rows, zone.preferred_rigidity, colorPreference), geom: rotatedGeom };
  }

  return null;
}

function determineMatchKind(sku: SkuCatalogRow, N: number): MatchKind {
  const sq = sku.set_quantity ?? 1;
  if (sq === N) return "set";
  if (sq === 1) return "singles";
  return "multipack";
}

export function matchSkus({
  schemePayload,
  skuCatalog,
  colorPreference,
}: {
  schemePayload: SchemePayload;
  skuCatalog: SkuCatalogRow[];
  colorPreference: string;
}): SkuMatch[] {
  return schemePayload.assigned_zones.map((zone) => {
    let geom = laneGeometryFromZone(zone);
    let status: MatchStatus = "no_match";
    let candidates: SkuCatalogRow[] = [];

    // 1. Primary native
    candidates = tryNativeMatch(zone, geom, zone.division_type, skuCatalog, colorPreference);
    if (candidates.length > 0) status = "exact";

    // 2. composed_from_slots (only when primary is cells)
    if (candidates.length === 0 && zone.division_type === "cells") {
      const composed = tryComposedFromSlots(zone, skuCatalog, colorPreference);
      if (composed && composed.candidates.length > 0) {
        candidates = composed.candidates;
        geom = composed.geom;
        status = "composed_from_slots";
      }
    }

    // 3. alternative_division (usually 'open')
    if (candidates.length === 0 && zone.alternative_division && zone.alternative_division !== zone.division_type) {
      candidates = tryNativeMatch(zone, geom, zone.alternative_division, skuCatalog, colorPreference);
      if (candidates.length > 0) status = "alternative_division";
    }

    const top = candidates[0];
    const match_kind: MatchKind = top ? determineMatchKind(top, geom.units_needed) : null;
    const packs_needed = top ? Math.ceil(geom.units_needed / (top.set_quantity ?? 1)) : 0;

    const result: SkuMatch = {
      zone_id: zone.zone_id,
      content_type: zone.content_type,
      match_status: status,
      match_kind,
      units_needed: geom.units_needed,
      packs_needed,
      lane_footprint_cm: { w: geom.lane_w, d: geom.lane_d, h: geom.lane_h, capacity: geom.cap_per_lane },
      candidates,
    };

    if (status === "no_match") {
      result.no_match_log = {
        zone_id: zone.zone_id,
        content_type: zone.content_type,
        division_type: zone.division_type,
        zone_w_cm: zone.assigned_w_cm,
        zone_d_cm: zone.assigned_d_cm,
        zone_h_cm: zone.assigned_h_cm,
        unit_w_cm: zone.unit_w_cm,
        unit_d_cm: zone.unit_d_cm,
        unit_h_cm: zone.unit_h_cm,
        units_needed: geom.units_needed,
        preferred_rigidity: zone.preferred_rigidity,
      };
    }

    return result;
  });
}
