/**
 * Scoring simulation: generates all N! zone-ordering permutations per scenario,
 * runs raw greedy placement for each, scores with proposed reward weights,
 * and prints a ranked table showing which ordering wins and why.
 *
 * Proposed scoring weights (reward system, 0..1 per rule × weight):
 *   D08_access (frequent zones front, not blocked): 200
 *   D06_pos    (bras at drawer front edge y=0):     150
 *   D01        (semantic groups stay adjacent):      130
 *   D05_cells  (cells zones form one connected component): 100
 *   depth_util (used_depth / drawer_depth):          80
 *   D03        (compactness ratio):                  70
 *   D04        (all reserve at drawer edge):          60
 *   D04b       (depth absorption opportunity):        30
 */

import { normalizeInput } from "../input/normalizeInput.js";
import { validateInput } from "../input/validateInput.js";
import { volumeToCount } from "../count/volumeToCount.js";
import { buildStorageRequirements } from "../requirements/buildStorageRequirements.js";
import { generateCalculatedZones } from "../zones/generateCalculatedZones.js";
import { runFitCheck } from "../fit/runFitCheck.js";
import { evaluatePlacementRules } from "../rules/evaluatePlacementRules.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import type { CalculatedZone, DrawerSize, FitResult, PlacedZone, UserInput } from "../types.js";

// ── scoring helpers ──────────────────────────────────────────────────────────

function accessScore(value: number | string): number {
  return typeof value === "number" ? value : ({ high: 9, medium: 6, low: 3 }[value] ?? 0);
}

function nearlyEqual(a: number, b: number) { return Math.abs(a - b) < 0.001; }
function rangesOverlap(a1: number, a2: number, b1: number, b2: number) { return a1 < b2 && a2 > b1; }

/** D08_access: what fraction of (high-freq, lower-freq) pairs have the high-freq zone NOT blocked. */
function scoreD08access(zones: PlacedZone[]): number {
  let pairs = 0, violations = 0;
  for (const hi of zones) {
    for (const lo of zones) {
      if (accessScore(hi.access_frequency) <= accessScore(lo.access_frequency)) continue;
      // hi is more frequent; lo blocks hi if lo is in front (lower y) and x-spans overlap
      if (lo.y_cm < hi.y_cm && rangesOverlap(hi.x_cm, hi.x_cm + hi.assigned_w_cm, lo.x_cm, lo.x_cm + lo.assigned_w_cm)) {
        violations++;
      }
      pairs++;
    }
  }
  if (pairs === 0) return 1;
  return 1 - violations / pairs;
}

/** D06_pos: bras zone starts at y=0 (front edge) or is at any drawer edge. */
function scoreD06pos(zones: PlacedZone[], drawerSize: DrawerSize): number {
  const bras = zones.filter((z) => z.content_type === "bras");
  if (bras.length === 0) return 1; // not applicable → neutral
  const atEdge = bras.some(
    (z) => nearlyEqual(z.y_cm, 0) || nearlyEqual(z.x_cm, 0) ||
           nearlyEqual(z.x_cm + z.assigned_w_cm, drawerSize.w_cm) ||
           nearlyEqual(z.y_cm + z.assigned_d_cm, drawerSize.d_cm)
  );
  return atEdge ? 1 : 0;
}

/** D01: use existing rule evaluator. pass=1, not_applicable=0.5, violation=0 */
function scoreD01(fitResult: FitResult, drawerSize: DrawerSize): number {
  const evals = evaluatePlacementRules({ drawerSize, fitResult });
  const d01 = evals.find((e) => e.rule_id === "D01");
  if (!d01 || d01.status === "not_applicable") return 0.5;
  return d01.status === "pass" ? 1 : 0;
}

/** D05_cells: all cells-division zones form one connected component. */
function scoreD05cells(zones: PlacedZone[]): number {
  const cellZones = zones.filter((z) => z.division_type === "cells");
  if (cellZones.length <= 1) return 1;
  const visited = new Set<string>();
  const pending = [cellZones[0]];
  while (pending.length) {
    const z = pending.pop();
    if (!z || visited.has(z.zone_id)) continue;
    visited.add(z.zone_id);
    for (const other of cellZones) {
      if (visited.has(other.zone_id)) continue;
      const adjX =
        (nearlyEqual(z.x_cm + z.assigned_w_cm, other.x_cm) || nearlyEqual(other.x_cm + other.assigned_w_cm, z.x_cm)) &&
        rangesOverlap(z.y_cm, z.y_cm + z.assigned_d_cm, other.y_cm, other.y_cm + other.assigned_d_cm);
      const adjY =
        (nearlyEqual(z.y_cm + z.assigned_d_cm, other.y_cm) || nearlyEqual(other.y_cm + other.assigned_d_cm, z.y_cm)) &&
        rangesOverlap(z.x_cm, z.x_cm + z.assigned_w_cm, other.x_cm, other.x_cm + other.assigned_w_cm);
      if (adjX || adjY) pending.push(other);
    }
  }
  return visited.size === cellZones.length ? 1 : 0;
}

/** D03: compactness ratio (assigned_area / bounding_area). */
function scoreD03(zones: PlacedZone[]): number {
  if (zones.length === 0) return 1;
  const minX = Math.min(...zones.map((z) => z.x_cm));
  const minY = Math.min(...zones.map((z) => z.y_cm));
  const maxX = Math.max(...zones.map((z) => z.x_cm + z.assigned_w_cm));
  const maxY = Math.max(...zones.map((z) => z.y_cm + z.assigned_d_cm));
  const assigned = zones.reduce((s, z) => s + z.assigned_w_cm * z.assigned_d_cm, 0);
  const bounding = (maxX - minX) * (maxY - minY);
  return bounding > 0 ? Math.min(1, assigned / bounding) : 1;
}

/** D04: fraction of free rectangles touching a drawer edge. */
function scoreD04(fitResult: FitResult, drawerSize: DrawerSize): number {
  const rects = fitResult.free_rectangles;
  if (rects.length === 0) return 1;
  const atEdge = rects.filter(
    (r) => nearlyEqual(r.x_cm, 0) || nearlyEqual(r.y_cm, 0) ||
            nearlyEqual(r.x_cm + r.w_cm, drawerSize.w_cm) ||
            nearlyEqual(r.y_cm + r.d_cm, drawerSize.d_cm)
  ).length;
  return atEdge / rects.length;
}

/** D04b: opportunity count > 0 → bonus. */
function scoreD04b(fitResult: FitResult, drawerSize: DrawerSize): number {
  const evals = evaluatePlacementRules({ drawerSize, fitResult });
  const d04b = evals.find((e) => e.rule_id === "D04b");
  const count = (d04b?.details?.opportunity_count as number | undefined) ?? 0;
  return count > 0 ? 1 : 0;
}

const WEIGHTS = {
  D08_access: 200,
  D06_pos:    150,
  D01:        130,
  D05_cells:  100,
  depth_util:  80,
  D03:         70,
  D04:         60,
  D04b:        30,
};

interface ScoreBreakdown {
  D08_access: number; D06_pos: number; D01: number; D05_cells: number;
  depth_util: number; D03: number; D04: number; D04b: number;
  total: number;
}

function scoreLayout(fitResult: FitResult, drawerSize: DrawerSize): ScoreBreakdown {
  if (fitResult.fit_status !== "fit_all") {
    return { D08_access: 0, D06_pos: 0, D01: 0, D05_cells: 0, depth_util: 0, D03: 0, D04: 0, D04b: 0, total: -9999 };
  }
  const zones = fitResult.placed_zones;
  const raw = {
    D08_access: scoreD08access(zones),
    D06_pos:    scoreD06pos(zones, drawerSize),
    D01:        scoreD01(fitResult, drawerSize),
    D05_cells:  scoreD05cells(zones),
    depth_util: fitResult.used_depth_cm / drawerSize.d_cm,
    D03:        scoreD03(zones),
    D04:        scoreD04(fitResult, drawerSize),
    D04b:       scoreD04b(fitResult, drawerSize),
  };
  const total = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce(
    (sum, k) => sum + raw[k] * WEIGHTS[k], 0
  );
  return { ...raw, total };
}

// ── permutation generator ────────────────────────────────────────────────────

function permute<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  return items.flatMap((item, i) =>
    permute([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest])
  );
}

// ── run a single permutation ─────────────────────────────────────────────────

function runPermutation(zones: CalculatedZone[], drawerSize: DrawerSize): FitResult {
  const layoutPlan = {
    layout_id: "sim",
    selected_zones: zones,
    placement_order: zones.map((z) => z.content_type),
    rules_applied: [],
    reserve_policy: "edge",
  };
  return runFitCheck({ layoutPlan, calculatedZones: zones, drawerSize, enableDepthStackCandidates: false });
}

// ── scenario runner ──────────────────────────────────────────────────────────

function buildScenarioZones(input: UserInput, skipValidation = false): { zones: CalculatedZone[]; drawerSize: DrawerSize } | null {
  const normalizedInput = normalizeInput(input);
  if (!skipValidation) {
    const validation = validateInput(normalizedInput);
    if (!validation.ok) { console.error("Validation failed:", validation.errors); return null; }
  }
  const countedItems = volumeToCount(normalizedInput.items, defaultLibraries.volumeToCount);
  const storageRequirements = buildStorageRequirements({ countedItems, storageUnitProfile: defaultLibraries.storageUnitProfile, zoneLayoutOptions: defaultLibraries.zoneLayoutOptions });
  const zones = generateCalculatedZones(storageRequirements);
  return { zones, drawerSize: normalizedInput.drawerSize };
}

function runScenario(name: string, input: UserInput, skipValidation = false) {
  const result = buildScenarioZones(input, skipValidation);
  if (!result) return;
  const { zones, drawerSize } = result;

  console.log(`\n${"═".repeat(70)}`);
  console.log(`SCENARIO: ${name}`);
  console.log(`Drawer: ${drawerSize.w_cm}×${drawerSize.d_cm}×${drawerSize.h_cm} cm`);
  const zoneDesc = zones.map((z) => `${z.content_type}(${z.zone_w_cm}×${z.zone_d_cm})`).join(", ");
  console.log(`Zones: ${zoneDesc}`);
  console.log(`${"─".repeat(70)}`);

  if (zones.length > 5) {
    console.log(`⚠ ${zones.length}! = too many permutations, skipping permutation search`);
    return;
  }

  const allPerms = permute(zones);
  const results: Array<{ order: string; fit: FitResult; score: ScoreBreakdown }> = [];

  for (const perm of allPerms) {
    const fit = runPermutation(perm, drawerSize);
    const score = scoreLayout(fit, drawerSize);
    const order = perm.map((z) => z.content_type.replace("socks_regular", "socks").replace("panties", "pan").replace("bras", "bra").replace("tights", "tights").replace("tshirts","tsh")).join("→");
    results.push({ order, fit, score });
  }

  results.sort((a, b) => b.score.total - a.score.total);

  const topN = Math.min(5, results.length);
  const best = results[0];
  const worst = results[results.length - 1];

  // header
  const hdrs = ["Rank", "Order", "Total", "D08acc", "D06pos", "D01", "D05cel", "dUtil", "D03", "D04", "D04b", "Fit"];
  console.log(hdrs.map((h) => h.padStart(6)).join(" "));
  console.log("─".repeat(hdrs.length * 7));

  const fmt = (v: number) => v.toFixed(2).padStart(6);
  const showRow = (rank: number, r: typeof results[0]) => {
    const s = r.score;
    const fit = r.fit.fit_status === "fit_all" ? "✓" : "✗";
    const placed = r.fit.placed_zones.map((z) => `${z.content_type.slice(0,3)}@(${z.x_cm},${z.y_cm})`).join(" ");
    console.log([
      String(rank).padStart(6),
      r.order.padEnd(40),
      fmt(s.total),
      fmt(s.D08_access * WEIGHTS.D08_access),
      fmt(s.D06_pos * WEIGHTS.D06_pos),
      fmt(s.D01 * WEIGHTS.D01),
      fmt(s.D05_cells * WEIGHTS.D05_cells),
      fmt(s.depth_util * WEIGHTS.depth_util),
      fmt(s.D03 * WEIGHTS.D03),
      fmt(s.D04 * WEIGHTS.D04),
      fmt(s.D04b * WEIGHTS.D04b),
      fit,
    ].join(" "));
    console.log(`       positions: ${placed}`);
  };

  for (let i = 0; i < topN; i++) showRow(i + 1, results[i]);

  if (results.length > topN) {
    console.log(`  ... (${results.length - topN} more permutations)`);
    showRow(results.length, worst);
  }

  const gap = best.score.total - (results[1]?.score.total ?? best.score.total);
  console.log(`\n→ Winner: "${best.order}"  total=${best.score.total.toFixed(1)}, gap to #2: ${gap.toFixed(1)} pts`);
  console.log(`  Placed: ${best.fit.placed_zones.map((z) => `${z.content_type}@(${z.x_cm},${z.y_cm}) w=${z.assigned_w_cm} d=${z.assigned_d_cm}`).join(" | ")}`);
}

// ── scenarios ────────────────────────────────────────────────────────────────

// S1: classic underwear trio, wide drawer — should depth-stack and put bras at edge
runScenario("S1 underwear trio — wide drawer", {
  drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15,
  storage_category: "underwear",
  items: [{ content_type: "panties", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "small" }, { content_type: "bras", volume_level: "small" }],
  priority: "convenient",
});

// S2: panties + bras only — should depth-stack bras behind panties
runScenario("S2 panties + bras — narrow drawer", {
  drawer_width_cm: 50, drawer_depth_cm: 40, drawer_height_cm: 15,
  storage_category: "underwear",
  items: [{ content_type: "panties", volume_level: "medium" }, { content_type: "bras", volume_level: "small" }],
  priority: "convenient",
});

// S3: socks + panties + bras + tights — 4 items, 24 permutations (skip production validation)
runScenario("S3 four underwear items — large drawer (4-item override)", {
  drawer_width_cm: 120, drawer_depth_cm: 50, drawer_height_cm: 30,
  storage_category: "underwear",
  items: [
    { content_type: "socks_regular", volume_level: "large" },
    { content_type: "panties", volume_level: "large" },
    { content_type: "bras", volume_level: "large" },
    { content_type: "tights", volume_level: "medium" },
  ],
  priority: "convenient",
}, true);

// S4: mixed soft-clothes + socks — access-frequency ordering matters
runScenario("S4 socks + tshirts + panties — mixed", {
  drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15,
  storage_category: "mixed",
  items: [
    { content_type: "socks_regular", volume_level: "medium" },
    { content_type: "tshirts", volume_level: "small" },
    { content_type: "panties", volume_level: "medium" },
  ],
  priority: "convenient",
});

// S5: tshirts + tights + bras — varied frequencies
runScenario("S5 tshirts + tights + bras", {
  drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15,
  storage_category: "mixed",
  items: [
    { content_type: "tshirts", volume_level: "small" },
    { content_type: "tights", volume_level: "medium" },
    { content_type: "bras", volume_level: "small" },
  ],
  priority: "convenient",
});
