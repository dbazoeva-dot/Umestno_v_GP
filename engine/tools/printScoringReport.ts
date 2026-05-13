/**
 * Comprehensive per-scenario report:
 *   - inputs (drawer, items, calculated zone dimensions)
 *   - current engine rule evaluations
 *   - proposed numeric scoring (0..1 × weight)
 *   - ASCII top-down layout diagram
 *
 * Uses the FULL engine pipeline (depth-stack candidates enabled).
 * S3 runs fit manually to bypass the 3-item production limit.
 */

import { runUmestnoEngine } from "../index.js";
import { evaluatePlacementRules } from "../rules/evaluatePlacementRules.js";
import { normalizeInput } from "../input/normalizeInput.js";
import { volumeToCount } from "../count/volumeToCount.js";
import { buildStorageRequirements } from "../requirements/buildStorageRequirements.js";
import { generateCalculatedZones } from "../zones/generateCalculatedZones.js";
import { buildLayoutPlan } from "../layout/buildLayoutPlan.js";
import { runFitCheck } from "../fit/runFitCheck.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import type { DrawerSize, FitResult, LayoutRuleEvaluation, PlacedZone, UserInput } from "../types.js";

// ── proposed scoring ─────────────────────────────────────────────────────────

function accessScore(v: number | string) {
  return typeof v === "number" ? v : ({ high: 9, medium: 6, low: 3 }[v] ?? 0);
}
function ne(a: number, b: number) { return Math.abs(a - b) < 0.001; }
function ro(a1: number, a2: number, b1: number, b2: number) { return a1 < b2 && a2 > b1; }

function scoreD08access(zones: PlacedZone[]) {
  let pairs = 0, violations = 0;
  for (const hi of zones) for (const lo of zones) {
    if (accessScore(hi.access_frequency) <= accessScore(lo.access_frequency)) continue;
    if (lo.y_cm < hi.y_cm && ro(hi.x_cm, hi.x_cm + hi.assigned_w_cm, lo.x_cm, lo.x_cm + lo.assigned_w_cm)) violations++;
    pairs++;
  }
  return pairs === 0 ? 1 : 1 - violations / pairs;
}

function scoreD06pos(zones: PlacedZone[], d: DrawerSize) {
  const bras = zones.filter((z) => z.content_type === "bras");
  if (!bras.length) return 1;
  return bras.some((z) =>
    ne(z.y_cm, 0) || ne(z.x_cm, 0) ||
    ne(z.x_cm + z.assigned_w_cm, d.w_cm) ||
    ne(z.y_cm + z.assigned_d_cm, d.d_cm)
  ) ? 1 : 0;
}

function scoreD01(fit: FitResult, d: DrawerSize) {
  const ev = evaluatePlacementRules({ drawerSize: d, fitResult: fit });
  const r = ev.find((e) => e.rule_id === "D01");
  if (!r || r.status === "not_applicable") return 0.5;
  return r.status === "pass" ? 1 : 0;
}

function scoreD05cells(zones: PlacedZone[]) {
  const c = zones.filter((z) => z.division_type === "cells");
  if (c.length <= 1) return 1;
  const vis = new Set<string>();
  const q = [c[0]];
  while (q.length) {
    const z = q.pop()!;
    if (vis.has(z.zone_id)) continue;
    vis.add(z.zone_id);
    for (const o of c) {
      if (vis.has(o.zone_id)) continue;
      const ax = (ne(z.x_cm + z.assigned_w_cm, o.x_cm) || ne(o.x_cm + o.assigned_w_cm, z.x_cm)) &&
        ro(z.y_cm, z.y_cm + z.assigned_d_cm, o.y_cm, o.y_cm + o.assigned_d_cm);
      const ay = (ne(z.y_cm + z.assigned_d_cm, o.y_cm) || ne(o.y_cm + o.assigned_d_cm, z.y_cm)) &&
        ro(z.x_cm, z.x_cm + z.assigned_w_cm, o.x_cm, o.x_cm + o.assigned_w_cm);
      if (ax || ay) q.push(o);
    }
  }
  return vis.size === c.length ? 1 : 0;
}

function scoreD03(zones: PlacedZone[]) {
  if (!zones.length) return 1;
  const minX = Math.min(...zones.map((z) => z.x_cm));
  const minY = Math.min(...zones.map((z) => z.y_cm));
  const maxX = Math.max(...zones.map((z) => z.x_cm + z.assigned_w_cm));
  const maxY = Math.max(...zones.map((z) => z.y_cm + z.assigned_d_cm));
  const area = zones.reduce((s, z) => s + z.assigned_w_cm * z.assigned_d_cm, 0);
  const bnd = (maxX - minX) * (maxY - minY);
  return bnd > 0 ? Math.min(1, area / bnd) : 1;
}

function scoreD04(fit: FitResult, d: DrawerSize) {
  const r = fit.free_rectangles;
  if (!r.length) return 1;
  return r.filter((x) =>
    ne(x.x_cm, 0) || ne(x.y_cm, 0) ||
    ne(x.x_cm + x.w_cm, d.w_cm) ||
    ne(x.y_cm + x.d_cm, d.d_cm)
  ).length / r.length;
}

function scoreD04b(fit: FitResult, d: DrawerSize) {
  const ev = evaluatePlacementRules({ drawerSize: d, fitResult: fit });
  const r = ev.find((e) => e.rule_id === "D04b");
  return ((r?.details?.opportunity_count as number | undefined) ?? 0) > 0 ? 1 : 0;
}

const WEIGHTS = {
  D08_access: 200, D06_pos: 150, D01: 130,
  D05_cells: 100, depth_util: 80, D03: 70, D04: 60, D04b: 30,
};

function computeProposedScore(fit: FitResult, d: DrawerSize) {
  if (fit.fit_status !== "fit_all") return null;
  const z = fit.placed_zones;
  const raw = {
    D08_access: scoreD08access(z),
    D06_pos:    scoreD06pos(z, d),
    D01:        scoreD01(fit, d),
    D05_cells:  scoreD05cells(z),
    depth_util: fit.used_depth_cm / d.d_cm,
    D03:        scoreD03(z),
    D04:        scoreD04(fit, d),
    D04b:       scoreD04b(fit, d),
  };
  const total = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((s, k) => s + raw[k] * WEIGHTS[k], 0);
  return { ...raw, total };
}

// ── ASCII layout diagram ─────────────────────────────────────────────────────

const LABELS: Record<string, string> = {
  panties: "PAN", socks_regular: "SOC", bras: "BRA", tights: "TIG",
  tshirts: "TSH", longsleeves: "LSL", sweaters: "SWT", leggings: "LEG",
  shorts: "SHT", pajamas: "PAJ", thermals: "THM", boxers: "BOX",
  belts: "BLT", scarves: "SCR", jewelry_small: "JWS",
  jewelry_large: "JWL", swimwear: "SWM", ties: "TIE",
  sport_tops: "SPT", nightgowns: "NGW",
};

function drawLayout(zones: PlacedZone[], d: DrawerSize): string {
  const COLS = 60;
  const scaleX = COLS / d.w_cm;
  const scaleY = scaleX * 0.45;

  const rows = Math.round(d.d_cm * scaleY) + 1;
  const cols = COLS + 1;

  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill(" "));

  for (const z of zones) {
    const x0 = Math.round(z.x_cm * scaleX);
    const y0 = Math.round(z.y_cm * scaleY);
    const x1 = Math.min(Math.round((z.x_cm + z.assigned_w_cm) * scaleX), cols - 1);
    const y1 = Math.min(Math.round((z.y_cm + z.assigned_d_cm) * scaleY), rows - 1);

    for (let r = y0 + 1; r < y1; r++)
      for (let c = x0 + 1; c < x1; c++)
        grid[r][c] = "·";

    for (let c = x0; c <= x1; c++) {
      if (y0 >= 0) grid[y0][c] = c === x0 ? "┌" : c === x1 ? "┐" : "─";
      if (y1 < rows) grid[y1][c] = c === x0 ? "└" : c === x1 ? "┘" : "─";
    }
    for (let r = y0; r <= y1; r++) {
      if (x0 >= 0) grid[r][x0] = r === y0 ? "┌" : r === y1 ? "└" : "│";
      if (x1 < cols) grid[r][x1] = r === y0 ? "┐" : r === y1 ? "┘" : "│";
    }

    const label = LABELS[z.content_type] ?? z.content_type.slice(0, 3).toUpperCase();
    const dims = `${z.assigned_w_cm}×${z.assigned_d_cm}`;
    const midR = Math.round((y0 + y1) / 2);
    const midC = Math.round((x0 + x1) / 2);
    const write = (r: number, s: string, mc: number) => {
      const st = mc - Math.floor(s.length / 2);
      for (let i = 0; i < s.length; i++) {
        const c = st + i;
        if (c > x0 && c < x1 && r > y0 && r < y1) grid[r][c] = s[i];
      }
    };
    const tall = y1 - y0 > 3;
    write(tall ? midR - 1 : midR, label, midC);
    if (y1 - y0 > 2) write(tall ? midR + 1 : midR + 1, dims, midC);
  }

  // outer border (only where still empty/space)
  for (let c = 0; c < cols; c++) {
    if (grid[0][c] === " ") grid[0][c] = "─";
    if (grid[rows - 1][c] === " ") grid[rows - 1][c] = "─";
  }
  for (let r = 0; r < rows; r++) {
    if (grid[r][0] === " " || grid[r][0] === "─") grid[r][0] = r === 0 ? "┌" : r === rows - 1 ? "└" : "│";
    const L = cols - 1;
    if (grid[r][L] === " " || grid[r][L] === "─") grid[r][L] = r === 0 ? "┐" : r === rows - 1 ? "┘" : "│";
  }

  // collect x-cuts and y-cuts for annotations
  const xCuts = [...new Set([0, d.w_cm, ...zones.flatMap((z) => [z.x_cm, z.x_cm + z.assigned_w_cm])])].sort((a, b) => a - b);
  const yCuts = [...new Set([0, d.d_cm, ...zones.flatMap((z) => [z.y_cm, z.y_cm + z.assigned_d_cm])])].sort((a, b) => a - b);

  // x-header row
  const xHeader = Array(cols + 4).fill(" ");
  for (const xv of xCuts) {
    const pos = Math.round(xv * scaleX);
    const lbl = String(Math.round(xv * 10) / 10);
    for (let i = 0; i < lbl.length; i++) { if (pos + i < xHeader.length) xHeader[pos + i] = lbl[i]; }
  }

  const lines: string[] = [xHeader.join("")];
  for (let r = 0; r < rows; r++) {
    let yLabel = "";
    for (const yv of yCuts) {
      if (Math.abs(Math.round(yv * scaleY) - r) < 0.6) {
        yLabel = `← y=${Math.round(yv * 10) / 10} cm`;
        break;
      }
    }
    lines.push(grid[r].join("") + " " + yLabel);
  }
  lines.push(`← front (y=0) at top, depth goes down, drawer ${d.w_cm}×${d.d_cm} cm`);
  return lines.join("\n");
}

// ── report ───────────────────────────────────────────────────────────────────

const HR = "═".repeat(72);
const hr = "─".repeat(72);
function r2(v: number) { return v.toFixed(2); }
function r1(v: number) { return v.toFixed(1); }
function bar(v: number) { const n = Math.round(v * 10); return "█".repeat(n) + "░".repeat(10 - n); }

interface ScenarioResult {
  drawerSize: DrawerSize;
  zones: ReturnType<typeof generateCalculatedZones>;
  fit: FitResult;
  ruleEvals: LayoutRuleEvaluation[];
  fitNotes: string[];
}

function buildResult(input: UserInput, skipValidation: boolean): ScenarioResult {
  const ni = normalizeInput(input);
  const ci = volumeToCount(ni.items, defaultLibraries.volumeToCount);
  const reqs = buildStorageRequirements({ countedItems: ci, storageUnitProfile: defaultLibraries.storageUnitProfile, zoneLayoutOptions: defaultLibraries.zoneLayoutOptions });
  const calcZones = generateCalculatedZones(reqs);
  const d = ni.drawerSize;

  if (!skipValidation) {
    const out = runUmestnoEngine(input, defaultLibraries);
    const dbg = out.debug as { fit_result: FitResult; layout_rule_evaluations: LayoutRuleEvaluation[] };
    return { drawerSize: d, zones: calcZones, fit: dbg.fit_result, ruleEvals: dbg.layout_rule_evaluations, fitNotes: dbg.fit_result.fit_notes ?? [] };
  }

  // bypass validation: build layout plan and run fit manually
  const layoutPlan = buildLayoutPlan({ calculatedZones: calcZones, drawerSize: d, priority: "convenient", layoutRules: defaultLibraries.layoutRules });
  const fit = runFitCheck({ layoutPlan, calculatedZones: calcZones, drawerSize: d });
  const ruleEvals = evaluatePlacementRules({ drawerSize: d, fitResult: fit });
  return { drawerSize: d, zones: calcZones, fit, ruleEvals, fitNotes: fit.fit_notes ?? [] };
}

function printReport(title: string, input: UserInput, skipValidation = false) {
  console.log(`\n${HR}`);
  console.log(`  ${title}`);
  console.log(HR);

  const { drawerSize: d, zones, fit, ruleEvals, fitNotes } = buildResult(input, skipValidation);
  const items = input.items ?? [];

  // inputs
  console.log(`\nDRAWER:  ${d.w_cm} × ${d.d_cm} × ${d.h_cm} cm  (W × D × H)`);
  console.log(`\nZONES:`);
  console.log(`  ${"content_type".padEnd(16)} ${"volume".padEnd(8)} ${"count".padEnd(8)} ${"W×D×H".padEnd(18)} ${"div".padEnd(8)} freq  option_id`);
  console.log(`  ${hr.slice(0, 76)}`);
  for (const z of zones) {
    const vol = items.find((i) => i.content_type === z.content_type || (i.content_type === "socks" && z.content_type === "socks_regular"))?.volume_level ?? "?";
    console.log(`  ${z.content_type.padEnd(16)} ${vol.padEnd(8)} ${`${z.count} ${z.count_unit}`.padEnd(8)} ${`${z.zone_w_cm}×${z.zone_d_cm}×${z.zone_h_cm}`.padEnd(18)} ${z.division_type.padEnd(8)} ${String(z.access_frequency).padEnd(6)}${z.option_id}`);
  }

  // fit summary
  console.log(`\nFIT:  ${fit.fit_status}   depth used ${fit.used_depth_cm}/${d.d_cm} cm   width used ${fit.used_width_cm}/${d.w_cm} cm`);
  for (const n of fitNotes) console.log(`  » ${n}`);

  // ASCII diagram
  const placed = fit.placed_zones;
  if (placed.length) {
    console.log(`\nLAYOUT (top-down view, front of drawer at top):`);
    console.log(drawLayout(placed, d));
    console.log(`\nPLACED:`);
    console.log(`  ${"content_type".padEnd(16)} ${"x".padStart(5)} ${"y".padStart(5)} ${"w".padStart(7)} ${"d".padStart(7)} ${"h".padStart(7)}`);
    console.log(`  ${hr.slice(0, 52)}`);
    for (const z of placed) {
      console.log(`  ${z.content_type.padEnd(16)} ${String(z.x_cm).padStart(5)} ${String(z.y_cm).padStart(5)} ${String(z.assigned_w_cm).padStart(7)} ${String(z.assigned_d_cm).padStart(7)} ${String(z.assigned_h_cm).padStart(7)}`);
    }
  } else {
    console.log(`\n⚠ no zones placed`);
  }

  // current rule evaluations
  console.log(`\nRULE EVALUATIONS (current engine):`);
  console.log(`  ${"rule_id".padEnd(16)} ${"status".padEnd(13)} details`);
  console.log(`  ${hr.slice(0, 68)}`);
  for (const e of ruleEvals) {
    let detail = "";
    if (e.details) {
      const d2 = e.details;
      if (e.rule_id === "D01") detail = `categories: ${JSON.stringify(d2.semantic_storage_categories)}  disconnected: ${JSON.stringify(d2.disconnected_storage_categories ?? [])}`;
      else if (e.rule_id === "D02") detail = `socks_ctr=${JSON.stringify((d2 as Record<string,unknown>).socks_center ?? "n/a")}`;
      else if (e.rule_id === "D03") detail = `compactness=${d2.compactness_ratio}  assigned=${d2.assigned_area_cm2}  bounding=${d2.bounding_area_cm2}`;
      else if (e.rule_id === "D04") detail = `all_at_edge=${d2.all_reserve_at_edge}  edge_count=${d2.edge_reserve_rectangle_count}/${d2.reserve_rectangle_count}`;
      else if (e.rule_id === "D04b") detail = `opportunities=${d2.opportunity_count}`;
      else if (e.rule_id === "D05") detail = `violations=${JSON.stringify(d2.violation_pairs ?? [])}`;
      else if (e.rule_id === "D06") detail = `compressed=${JSON.stringify(d2.compressed_bras_zone_ids ?? [])}`;
      else if (e.rule_id === "ZONE_INTEGRITY") detail = `out_of_bounds=${JSON.stringify(d2.out_of_bounds_zone_ids)}  overlaps=${JSON.stringify(d2.overlapping_zone_pairs)}`;
    }
    console.log(`  ${e.rule_id.padEnd(16)} ${e.status.padEnd(13)} ${detail}`);
  }

  // proposed scoring
  const score = computeProposedScore(fit, d);
  if (score) {
    console.log(`\nPROPOSED SCORING:`);
    console.log(`  ${"dimension".padEnd(14)} ${"raw".padStart(6)} × ${"wgt".padStart(4)} = ${"pts".padStart(7)}  bar`);
    console.log(`  ${hr.slice(0, 52)}`);
    const rows2: [string, number, number][] = [
      ["D08_access",  score.D08_access,  WEIGHTS.D08_access],
      ["D06_pos",     score.D06_pos,     WEIGHTS.D06_pos],
      ["D01",         score.D01,         WEIGHTS.D01],
      ["D05_cells",   score.D05_cells,   WEIGHTS.D05_cells],
      ["depth_util",  score.depth_util,  WEIGHTS.depth_util],
      ["D03",         score.D03,         WEIGHTS.D03],
      ["D04",         score.D04,         WEIGHTS.D04],
      ["D04b",        score.D04b,        WEIGHTS.D04b],
    ];
    for (const [name, raw, w] of rows2) {
      console.log(`  ${name.padEnd(14)} ${r2(raw).padStart(6)} × ${String(w).padStart(4)} = ${r1(raw * w).padStart(7)}  ${bar(raw)}`);
    }
    console.log(`  ${hr.slice(0, 52)}`);
    console.log(`  ${"TOTAL".padEnd(28)} ${r1(score.total).padStart(7)}`);
  } else {
    console.log(`\n⚠ fit_status ≠ fit_all — proposed score not computed`);
  }
}

// ── scenarios ────────────────────────────────────────────────────────────────

printReport("S1 — underwear trio, wide drawer 80×45×15", {
  drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15,
  storage_category: "underwear",
  items: [
    { content_type: "panties", volume_level: "medium" },
    { content_type: "socks_regular", volume_level: "small" },
    { content_type: "bras", volume_level: "small" },
  ],
  priority: "convenient",
});

printReport("S2 — panties + bras, narrow drawer 50×40×15", {
  drawer_width_cm: 50, drawer_depth_cm: 40, drawer_height_cm: 15,
  storage_category: "underwear",
  items: [
    { content_type: "panties", volume_level: "medium" },
    { content_type: "bras", volume_level: "small" },
  ],
  priority: "convenient",
});

printReport("S3 — socks + panties + bras + tights, large drawer 120×50×30 (4-item override)", {
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

printReport("S4 — socks + tshirts + panties, mixed 90×45×15", {
  drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15,
  storage_category: "mixed",
  items: [
    { content_type: "socks_regular", volume_level: "medium" },
    { content_type: "tshirts", volume_level: "small" },
    { content_type: "panties", volume_level: "medium" },
  ],
  priority: "convenient",
});

printReport("S5 — tshirts + tights + bras, mixed 80×45×15", {
  drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15,
  storage_category: "mixed",
  items: [
    { content_type: "tshirts", volume_level: "small" },
    { content_type: "tights", volume_level: "medium" },
    { content_type: "bras", volume_level: "small" },
  ],
  priority: "convenient",
});
