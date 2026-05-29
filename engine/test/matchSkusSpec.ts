// Focused tests for matchSkus per engine/sku/SPEC.md.
// Build minimal PlacedZone fixtures by hand so each branch is exercised
// in isolation without depending on the upstream engine pipeline.

import type { DivisionType, PlacedZone, SchemePayload, SkuCatalogRow } from "../types.js";
import { matchSkus } from "../sku/matchSkus.js";

function assert(cond: unknown, msg: string): asserts cond { if (!cond) throw new Error("matchSkus spec: " + msg); }

interface ZoneOverrides {
  zone_id?: string;
  content_type?: string;
  division_type?: DivisionType;
  alternative_division?: DivisionType;
  preferred_rigidity?: string;
  unit_w_cm?: number; unit_d_cm?: number; unit_h_cm?: number;
  count?: number;
  assigned_w_cm?: number; assigned_d_cm?: number; assigned_h_cm?: number;
  calculated_cols?: number; calculated_rows?: number;
  split_used?: boolean;
  lanes_needed?: number;
  items_per_lane?: number[];
  slot_lane_gap_cm?: number;
}

function zoneFixture(o: ZoneOverrides = {}): PlacedZone {
  const division_type: DivisionType = o.division_type ?? "cells";
  return {
    // CountedItem
    content_type: o.content_type ?? "socks",
    volume_level: "medium",
    count: o.count ?? 10,
    count_unit: "items",
    // StorageUnitProfileRow (sans content_type, storage_category)
    storage_method: "lay_flat",
    primary_division: division_type,
    alternative_division: o.alternative_division,
    preferred_rigidity: o.preferred_rigidity ?? "semi_rigid",
    unit_w_cm: o.unit_w_cm ?? 8,
    unit_d_cm: o.unit_d_cm ?? 8,
    unit_h_cm: o.unit_h_cm ?? 6,
    needs_item_gap: false,
    side_clear: 0, fb_clear: 0, h_clear: 0,
    access_frequency: 1,
    can_rotate: true,
    can_split: false,
    open_fallback_allowed: true,
    open_fallback_rank: 1,
    open_storage_penalty: "low",
    // CalculatedZone
    zone_id: o.zone_id ?? "z1",
    original_division_type: division_type,
    division_type,
    option_id: "test_opt",
    calculation_mode: "fixed_grid",
    zone_w_cm: o.assigned_w_cm ?? 40,
    zone_d_cm: o.assigned_d_cm ?? 40,
    zone_h_cm: o.assigned_h_cm ?? 10,
    capacity: o.count ?? 10,
    calculated_cols: o.calculated_cols,
    calculated_rows: o.calculated_rows,
    split_used: o.split_used,
    lanes_needed: o.lanes_needed,
    items_per_lane: o.items_per_lane,
    slot_lane_gap_cm: o.slot_lane_gap_cm,
    // PlacedZone
    x_cm: 0, y_cm: 0,
    assigned_w_cm: o.assigned_w_cm ?? 40,
    assigned_d_cm: o.assigned_d_cm ?? 40,
    assigned_h_cm: o.assigned_h_cm ?? 10,
  };
}

function skuFixture(o: Partial<SkuCatalogRow> & { sku_id: string }): SkuCatalogRow {
  return {
    division_type: "cells",
    rigidity: "semi_rigid",
    width_cm: 20, depth_cm: 20, height_cm: 8,
    capacity_units: 100,
    set_quantity: 1,
    cell_width_cm: 8, cell_depth_cm: 8,
    can_rotate: "yes",
    color_group: "neutral_light",
    availability_status: "in_stock",
    product_title: "test sku",
    ...o,
  };
}

function payload(zones: PlacedZone[]): SchemePayload {
  return {
    scheme_id: "test",
    fit_status: "fit_all",
    selected_calculated_zones: zones,
    assigned_zones: zones,
    layout_plan: { layout_id: "test", selected_zones: zones, placement_order: zones.map((z) => z.zone_id), rules_applied: [], reserve_policy: "ignore" },
    reserve_zones: [],
    warnings: [],
    content_warnings: [],
    layout_rule_evaluations: [],
  };
}

function run(zone: PlacedZone, catalog: SkuCatalogRow[], colorPreference = "neutral_light") {
  return matchSkus({ schemePayload: payload([zone]), skuCatalog: catalog, colorPreference })[0];
}

// ── 1. exact match (singles) ───────────────────────────────────
{
  const zone = zoneFixture({ count: 12, assigned_w_cm: 32, assigned_d_cm: 32 });
  const sku = skuFixture({ sku_id: "EXACT1" });
  const r = run(zone, [sku]);
  assert(r.match_status === "exact", "1: status should be exact");
  // For N=1 the trivial sq==N branch wins → kind is 'set' (no badge rendered anyway).
  assert(r.match_kind === "set", `1: kind should be 'set' for N=1, got ${r.match_kind}`);
  assert(r.units_needed === 1 && r.packs_needed === 1, "1: units/packs should be 1");
  assert(r.candidates[0]?.sku_id === "EXACT1", "1: top candidate is EXACT1");
}

// ── 2. set match for split slot zone (lanes=3, set_quantity=3) ──
{
  const zone = zoneFixture({
    division_type: "slots", count: 12,
    assigned_w_cm: 60, assigned_d_cm: 40, assigned_h_cm: 8,
    split_used: true, lanes_needed: 3, items_per_lane: [4, 4, 4],
    slot_lane_gap_cm: 0,
  });
  const setSku = skuFixture({
    sku_id: "SET3", division_type: "slots", set_quantity: 3,
    width_cm: 18, depth_cm: 38, height_cm: 8,
    capacity_units: 4,
    cell_width_cm: 8, cell_depth_cm: 8,
  });
  const singleSku = skuFixture({
    sku_id: "SOLO1", division_type: "slots", set_quantity: 1,
    width_cm: 18, depth_cm: 38, height_cm: 8,
    capacity_units: 4,
    cell_width_cm: 8, cell_depth_cm: 8,
  });
  const r = run(zone, [singleSku, setSku]);
  assert(r.match_status === "exact", "2: status exact");
  assert(r.match_kind === "set", "2: kind should be 'set' (set_quantity == lanes_needed)");
  assert(r.candidates[0]?.sku_id === "SET3", `2: SET3 must be top, got ${r.candidates[0]?.sku_id}`);
  assert(r.units_needed === 3 && r.packs_needed === 1, `2: packs_needed=1, got ${r.packs_needed}`);
}

// ── 3. clean multipack (N=4, set_quantity=2) ──────────────────
{
  const zone = zoneFixture({
    division_type: "slots", count: 16,
    assigned_w_cm: 80, assigned_d_cm: 40, assigned_h_cm: 8,
    split_used: true, lanes_needed: 4, items_per_lane: [4, 4, 4, 4],
  });
  const sku = skuFixture({
    sku_id: "MULTI2", division_type: "slots", set_quantity: 2,
    width_cm: 18, depth_cm: 38, height_cm: 8, capacity_units: 4,
    cell_width_cm: 8, cell_depth_cm: 8,
  });
  const r = run(zone, [sku]);
  assert(r.match_kind === "multipack", `3: kind should be 'multipack', got ${r.match_kind}`);
  assert(r.packs_needed === 2, `3: packs_needed=2, got ${r.packs_needed}`);
}

// ── 4. set_quantity > N is filtered out ────────────────────────
{
  const zone = zoneFixture({
    division_type: "slots", count: 8,
    assigned_w_cm: 40, assigned_d_cm: 40, assigned_h_cm: 8,
    split_used: true, lanes_needed: 2, items_per_lane: [4, 4],
  });
  const wasteful = skuFixture({
    sku_id: "TOOBIG", division_type: "slots", set_quantity: 5,
    width_cm: 18, depth_cm: 38, height_cm: 8, capacity_units: 4,
    cell_width_cm: 8, cell_depth_cm: 8,
  });
  const r = run(zone, [wasteful]);
  assert(r.match_status === "no_match", "4: wasteful set must be filtered out (N=2, set=5)");
}

// ── 5. dirty multipack last resort (N=7, set=4 only available) ─
{
  const zone = zoneFixture({
    division_type: "slots", count: 7,
    assigned_w_cm: 140, assigned_d_cm: 40, assigned_h_cm: 8,
    split_used: true, lanes_needed: 7, items_per_lane: [1,1,1,1,1,1,1],
  });
  const dirty = skuFixture({
    sku_id: "DIRTY4", division_type: "slots", set_quantity: 4,
    width_cm: 18, depth_cm: 38, height_cm: 8, capacity_units: 1,
    cell_width_cm: 8, cell_depth_cm: 8,
  });
  const r = run(zone, [dirty]);
  assert(r.match_status === "exact" && r.candidates[0]?.sku_id === "DIRTY4", "5: dirty SKU surfaces as last resort");
  assert(r.packs_needed === 2, `5: packs_needed=ceil(7/4)=2, got ${r.packs_needed}`);
}

// ── 6. composed_from_slots fallback (cells zone, no cells SKU) ─
{
  const zone = zoneFixture({
    division_type: "cells", count: 12,
    assigned_w_cm: 32, assigned_d_cm: 24, assigned_h_cm: 8,
    calculated_cols: 4, calculated_rows: 3,
  });
  const slotSku = skuFixture({
    sku_id: "SLOT-LINE", division_type: "slots",
    width_cm: 7, depth_cm: 24, height_cm: 8,
    capacity_units: 3,
    cols: 3, rows: 1,
    cell_width_cm: 7, cell_depth_cm: 8,   // cell_w within ±3 of unit_w, cell_d within ±1.5 of unit_d
    set_quantity: 4,                       // clean divisor of cols=4
  });
  const r = run(zone, [slotSku]);
  assert(r.match_status === "composed_from_slots", `6: status composed_from_slots, got ${r.match_status}`);
  assert(r.units_needed === 4, `6: units_needed = cols = 4, got ${r.units_needed}`);
  assert(r.match_kind === "set", `6: set_quantity==4==N → kind 'set', got ${r.match_kind}`);
}

// ── 7. alternative_division fallback (cells→open) ─────────────
{
  const zone = zoneFixture({
    division_type: "cells",
    alternative_division: "open",
    count: 10,
    assigned_w_cm: 30, assigned_d_cm: 30, assigned_h_cm: 8,
    calculated_cols: 3, calculated_rows: 3,
    unit_w_cm: 8, unit_d_cm: 8,
  });
  const openSku = skuFixture({
    sku_id: "OPEN-BIN", division_type: "open",
    width_cm: 28, depth_cm: 28, height_cm: 8,
    capacity_units: 10,
    cell_width_cm: undefined,   // open has no cells; falls back to width_cm
    cell_depth_cm: undefined,
  });
  // open SKU's width_cm (28) is 28-8=20 away from unit_w_cm (8) → fails ±3 cell tolerance.
  // Set unit_w_cm/unit_d_cm to ~28 so open fits the tolerance.
  const zoneOpenSize = zoneFixture({
    division_type: "cells",
    alternative_division: "open",
    count: 10,
    assigned_w_cm: 30, assigned_d_cm: 30, assigned_h_cm: 8,
    calculated_cols: 3, calculated_rows: 3,
    unit_w_cm: 28, unit_d_cm: 28,    // single big "unit" fits open container
  });
  const r = run(zoneOpenSize, [openSku]);
  assert(r.match_status === "alternative_division", `7: status alternative_division, got ${r.match_status}`);
  assert(r.candidates[0]?.sku_id === "OPEN-BIN", "7: open SKU should be top");
}

// ── 8. rigidity hierarchy (preferred=soft) ────────────────────
{
  const zone = zoneFixture({ preferred_rigidity: "soft" });
  const rigid     = skuFixture({ sku_id: "R", rigidity: "rigid" });
  const semiRigid = skuFixture({ sku_id: "SR", rigidity: "semi_rigid" });
  const soft      = skuFixture({ sku_id: "S", rigidity: "soft" });
  const r = run(zone, [rigid, semiRigid, soft]);
  assert(r.candidates[0]?.sku_id === "S", `8: soft should be top for preferred=soft, got ${r.candidates[0]?.sku_id}`);
  assert(r.candidates[1]?.sku_id === "SR", "8: semi_rigid is 2nd");
  assert(r.candidates[2]?.sku_id === "R", "8: rigid is last");
}

// ── 9. color preference tiebreaker ────────────────────────────
{
  const zone = zoneFixture();
  const same = skuFixture({ sku_id: "MATCH",   color_group: "neutral_light" });
  const diff = skuFixture({ sku_id: "DIFF",    color_group: "bold_dark" });
  const r = run(zone, [diff, same], "neutral_light");
  assert(r.candidates[0]?.sku_id === "MATCH", `9: matching colour should rank first, got ${r.candidates[0]?.sku_id}`);
}

// ── 10. no_match emits structured log entry ───────────────────
{
  const zone = zoneFixture({ zone_id: "Z_FAIL", content_type: "socks", preferred_rigidity: "soft" });
  const r = run(zone, []);
  assert(r.match_status === "no_match", "10: empty catalog → no_match");
  assert(r.no_match_log && r.no_match_log.zone_id === "Z_FAIL", "10: no_match_log present");
  assert(r.no_match_log!.content_type === "socks", "10: log carries content_type");
  assert(r.no_match_log!.preferred_rigidity === "soft", "10: log carries preferred_rigidity");
}

// ── 11. height tolerance edge cases (−3 / +5) ─────────────────
{
  const zone = zoneFixture({ unit_h_cm: 10, assigned_h_cm: 30 });
  const justUnder    = skuFixture({ sku_id: "U3", height_cm: 7  });   // unit_h − 3 ✓
  const tooUnder     = skuFixture({ sku_id: "U4", height_cm: 6  });   // unit_h − 4 ✗
  const justOver     = skuFixture({ sku_id: "O5", height_cm: 15 });   // unit_h + 5 ✓
  const tooOver      = skuFixture({ sku_id: "O6", height_cm: 16 });   // unit_h + 6 ✗
  const r = run(zone, [tooUnder, justUnder, justOver, tooOver]);
  const ids = r.candidates.map((c) => c.sku_id);
  assert(ids.includes("U3") && ids.includes("O5"), "11: edge-pass SKUs in candidates");
  assert(!ids.includes("U4") && !ids.includes("O6"), "11: edge-fail SKUs excluded");
}

console.log("ok matchSkus spec: 11 scenarios covering all branches");
