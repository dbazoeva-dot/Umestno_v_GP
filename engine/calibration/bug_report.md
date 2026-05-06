# Bug Report — Drawer Organizer Configuration Engine
Date: 2026-05-06

## Environment
- Engine: `umestno-engine v0.1.0` (TypeScript ESM)
- Runtime library: `engine/libraries/defaultLibraries.ts` (7 content types)
- Source library: `Internal Library ABCD_v0605.xlsx` (21 content types)
- Audit report: `engine/calibration/library_audit_report.json`

---

## 1. Library Coverage Gap (Critical)

**14 content types exist in source ABCD xlsx but are absent from runtime:**

Underwear: `bra_wired`, `bra_soft`, `bra_sport`, `thongs`, `socks_sport`, `socks_knee_high`, `stockings`
Clothing: `shorts`, `leggings`, `homewear`, `sports_tops`, `nightgowns`
Accessories: `belts`, `scarves`, `sweaters` (accessories group entirely absent)

**Impact:** Scenarios 4 and 6 return `VALIDATION_FAILED` for `belts`, `scarves`, `sweaters` — these content types are not registered in `allowedByCategory` nor in any ABCD table. The engine correctly rejects them, but the runtime library is structurally incomplete.

---

## 2. D-Rule Violations in Layout Output

### BUG-001: D02 violated in Scenario 2 (socks between bras and panties)
- **Scenario:** socks_regular large + panties large + bras medium, 120×50×20 cm
- **Layout:** bras@x=0, socks_regular@x=29, panties@x=60
- **Rule D02:** socks must NOT be placed between other zones
- **Actual:** socks_regular is placed between bras and panties → D02 ✗
- **Expected:** socks should be at one edge (x=0 or rightmost)

### BUG-002: D05 violated in Scenario 7 (cells zones not adjacent)
- **Scenario:** panties large + bras large + socks_regular large, 100×50×15 cm
- **Layout:** bras@x=0 (slots), socks_regular@x=58 (cells), panties@x=0/row2 (cells)
- **Rule D05:** all cells zones must be adjacent to each other
- **Actual:** socks_regular@x=58, panties@x=0 — not adjacent → D05 ✗
- **Note:** Panties is placed in the second row (y≠0), making adjacency check by x-only unreliable. D05 needs 2D proximity check, not just x-axis gap.

### BUG-003: D01 gap detection is ambiguous
- **Rule D01:** slots zone must be adjacent to cells zone (gap = 0)
- **Observed:** In Scenario 1 and Scenario 7, D01 reports gap < 0 (overlap or 2-row layout confuses single-axis check)
- **Root cause:** The D01 check compares `slots_max_x` vs `cells_min_x` on a flat x-axis, ignoring y-offsets from 2-row layout. Zones in different rows can appear to "overlap" on x-axis.

---

## 3. Adjustment Loop Behavior

### BUG-004: Open fallback converts `cells` to `open` even when cells zone fits by height
- **Scenario 5:** bras overflow (h=13 > drawer 10). socks_regular cells zone fits fine (h=8 < 10).
- **Actual:** Engine applies open fallback and converts `socks_regular` from `cells` to `open_single_section`. bras are dropped (unplaced).
- **Expected:** Only the overflowing zone (bras) should be affected. socks_regular should remain as `cells`.
- **Impact:** `fit_partial` is returned correctly, but the surviving zone unnecessarily loses its structured cells layout.

Same behavior observed in Scenario 6* (jeans+socks_regular): jeans overflow → socks_regular forced to `open`.

### BUG-005: Adjustment iteration count reported as 1 when bras require `slots_multi_lane_auto`
- **Scenario 7:** `iterations: 1` is shown, but this iteration is the successful multi-lane split for bras, not a fallback. The label "Выполнен локальный open fallback" is printed even though no open fallback was used.
- **Root cause:** `runScenarioTests.ts` uses `adjustmentIterations > 0` to infer fallback type; it cannot distinguish between "multi-lane split succeeded" and "open fallback triggered."

---

## 4. `can_rotate` — Not Implemented

- **Scenario 3:** Narrow deep drawer (45×80×12). Both zones (socks_regular 25×25, tights 15×9) show `[can_rotate]` in output (the flag is present in zone options), but the engine does NOT attempt rotation.
- **Evidence:** socks_regular zone uses `cells_4x4` (25×25) — fits width=45 as-is. tights uses `cells_2x2` (15×9) — also fits. By luck both fit without rotation.
- **Risk:** In a drawer where the zone would only fit rotated (e.g., a zone wider than the drawer but fitting depth-wise), the engine will report `fit_none` instead of attempting rotation.
- **Source ABCD xlsx:** `can_rotate` column is present and populated; runtime code has no rotation logic.

---

## 5. D-rule Implementation Mismatch

### BUG-006: Runtime layout_plan rule_ids are generic; source D library has 10 specific rules
- **Runtime:** 4 hardcoded rule IDs: `cells_grouped`, `bras_not_compressed`, `frequent_items_front`, `soft_zones_absorb_reserve`
- **Source D library (xlsx):** D01–D10 with specific behavioral constraints
- **Missing rules in runtime:** D03 (thongs placement), D04 (sports items), D07 (nightgowns), D08 (leggings), D10 (accessories)
- **Implemented partially:** D01, D02, D05, D06, D09 have partial logic but are not enforced during placement — they are post-hoc checks only

---

## 6. Storage Profile Value Mismatches (from Library Audit)

The audit (`library_audit_report.json`) found systematic discrepancies between source xlsx and runtime for the 7 shared content types:

| Check | Count |
|-------|-------|
| Missing content types (A table) | 14 |
| Count mismatches (A table) | 5 |
| Missing storage profiles (B table) | 14 |
| Dimension mismatches (B table) | 12 |
| Clearance mismatches (B table) | 23 |
| Behavior mismatches (B table) | 25 |
| Division mismatches (B table) | 1 |
| Missing zone layout options (C table) | 6 |
| Count-range mismatches (C table) | 6 |
| Extra runtime options not in source | 1 (`slots_multi_lane_auto`) |

**Notable specific mismatches:**
- `tights`: source `primary_division = open`, runtime = `cells` — leads to wrong default zone type
- `socks_regular`, `panties`, `boxers`: source clearances = 0, runtime clearances = 0.5/0.5/1 — zones sized differently
- `bras`, `tights`, `jeans`, `tshirts`: source `rigidity = rigid`, runtime = `soft` — affects capacity calculations
- `slots_multi_lane_auto` exists in runtime C table but has no counterpart in source xlsx

---

## 7. Cross-Table Consistency Issues

- `dividers_linear_depth` and `dividers_grid_auto`: referenced in source C table but not implemented in engine
- `linear_depth_split`: exists as zone mode in runtime but not present in source xlsx C table

---

## Summary

| # | Bug | Severity | Affects |
|---|-----|----------|---------|
| 001 | D02 violated: socks between other zones | High | Scenario 2 |
| 002 | D05 violated: cells zones not adjacent (2D layout) | Medium | Scenario 7 |
| 003 | D01 check broken for 2-row layouts | Medium | Scenarios 1, 7 |
| 004 | Open fallback converts all zones, not just overflowing one | High | Scenarios 5, 6* |
| 005 | Adjustment iteration label misleading (multi-lane vs open fallback) | Low | Scenario 7 |
| 006 | D-rules not enforced during placement, only checked post-hoc | High | All scenarios |
| — | 14 missing content types in runtime | Critical | Scenarios 4, 6 |
| — | `can_rotate` not implemented | Medium | Scenario 3+ |
| — | 81 value mismatches between source xlsx and runtime library | High | All scenarios |
