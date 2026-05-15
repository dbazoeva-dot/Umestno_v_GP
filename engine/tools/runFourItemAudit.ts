// Dev-only audit script: 4-item scenario diagnostics.
// Run via: npm run build --silent && node dist/engine/tools/runFourItemAudit.js
// Not for production use; does not mutate engine or library files.

import { normalizeInput } from "../input/normalizeInput.js";
import { validateInput } from "../input/validateInput.js";
import { volumeToCount } from "../count/volumeToCount.js";
import { buildStorageRequirements } from "../requirements/buildStorageRequirements.js";
import { generateZoneVariants } from "../zones/generateZoneVariants.js";
import { generatePlacementCandidates } from "../fit/generatePlacementCandidates.js";
import { selectBestCandidate } from "../fit/selectBestCandidate.js";
import { normalizePlacement } from "../fit/normalizePlacement.js";
import { evaluatePlacementRules } from "../rules/evaluatePlacementRules.js";
import { scorePlacementCandidate } from "../fit/scorePlacementCandidate.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import type { FitResult, PlacedZone, UserInput } from "../types.js";

const NO_FIT_MESSAGE =
  "По введённым размерам и объему вещей мы не можем собрать надёжную схему для этого ящика. Попробуйте уменьшить объём одной из категорий или проверьте внутренние размеры ящика: ширину, глубину и полезную высоту до закрытия.";

const SCENARIOS: Array<{ id: string; input: UserInput }> = [
  {
    id: "F1",
    input: {
      drawer_width_cm: 120,
      drawer_depth_cm: 50,
      drawer_height_cm: 20,
      storage_category: "underwear",
      items: [
        { content_type: "panties", volume_level: "large" },
        { content_type: "bras", volume_level: "large" },
        { content_type: "socks_regular", volume_level: "large" },
        { content_type: "tights", volume_level: "medium" },
      ],
      priority: "convenient",
    },
  },
  {
    id: "F2",
    input: {
      drawer_width_cm: 90,
      drawer_depth_cm: 45,
      drawer_height_cm: 15,
      storage_category: "underwear",
      items: [
        { content_type: "panties", volume_level: "medium" },
        { content_type: "bras", volume_level: "medium" },
        { content_type: "socks_regular", volume_level: "medium" },
        { content_type: "tights", volume_level: "small" },
      ],
      priority: "convenient",
    },
  },
  {
    // NOTE: Original F3 used pajamas which belongs to underwear, not soft_clothes.
    // Substituting pajamas → shorts (valid soft_clothes type) to exercise the scenario geometry.
    // See audit notes section for full explanation.
    id: "F3",
    input: {
      drawer_width_cm: 100,
      drawer_depth_cm: 50,
      drawer_height_cm: 20,
      storage_category: "soft_clothes",
      items: [
        { content_type: "tshirts", volume_level: "medium" },
        { content_type: "leggings", volume_level: "medium" },
        { content_type: "longsleeves", volume_level: "small" },
        { content_type: "shorts", volume_level: "small" },
      ],
      priority: "convenient",
    },
  },
  {
    id: "F4",
    input: {
      drawer_width_cm: 70,
      drawer_depth_cm: 40,
      drawer_height_cm: 12,
      storage_category: "accessories",
      items: [
        { content_type: "belts", volume_level: "small" },
        { content_type: "scarves", volume_level: "medium" },
        { content_type: "jewelry_small", volume_level: "small" },
        { content_type: "ties", volume_level: "small" },
      ],
      priority: "convenient",
    },
  },
];

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function fmtZoneRow(z: PlacedZone): string {
  const ct = pad(z.content_type, 18);
  const oid = pad(z.option_id, 14);
  const x = pad(String(z.x_cm), 6);
  const y = pad(String(z.y_cm), 6);
  const zw = pad(String(z.zone_w_cm), 8);
  const zd = pad(String(z.zone_d_cm), 8);
  const aw = pad(String(z.assigned_w_cm), 10);
  const ad = pad(String(z.assigned_d_cm), 10);
  return `  ${ct} ${oid} ${x} ${y} ${zw} ${zd} ${aw} ${ad}`;
}

function renderAsciiLayout(zones: PlacedZone[], drawerW: number, drawerD: number): string {
  const COLS = Math.min(drawerW, 60);
  const ROWS = Math.min(drawerD, 25);
  const scaleW = COLS / drawerW;
  const scaleD = ROWS / drawerD;

  const grid: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill("·"));

  const labels = ["A", "B", "C", "D", "E", "F"];
  const legend: string[] = [];

  zones.forEach((z, i) => {
    const label = labels[i] ?? String(i);
    legend.push(`${label}=${z.content_type}`);
    const x0 = Math.round(z.x_cm * scaleW);
    const y0 = Math.round(z.y_cm * scaleD);
    const x1 = Math.min(Math.round((z.x_cm + z.assigned_w_cm) * scaleW), COLS);
    const y1 = Math.min(Math.round((z.y_cm + z.assigned_d_cm) * scaleD), ROWS);
    for (let r = y0; r < y1; r++) {
      for (let c = x0; c < x1; c++) {
        grid[r][c] = r === y0 || r === y1 - 1 || c === x0 || c === x1 - 1 ? "+" : label;
      }
    }
  });

  const top = "+" + "-".repeat(COLS) + "+";
  const rows = grid.map((row) => "|" + row.join("") + "|");
  return [top, ...rows, top, "  " + legend.join("  ")].join("\n");
}

function scoreBreakdown(fitResult: FitResult, drawerW: number, drawerD: number, drawerH: number): string {
  const drawerSize = { w_cm: drawerW, d_cm: drawerD, h_cm: drawerH };
  const evals = evaluatePlacementRules({ drawerSize, fitResult });
  const total = scorePlacementCandidate(fitResult, drawerSize, evals);
  const zones = fitResult.placed_zones;

  const no_deform = fitResult.content_warnings.some((w) => w.warning_code === "deformation_risk") ? 0 : 1;
  const no_compress = fitResult.content_warnings.some((w) => w.warning_code === "compressed_storage") ? 0 : 1;
  const depth_util = Math.min(fitResult.used_depth_cm / drawerD, 1);

  const d05ev = evals.find((e) => e.rule_id === "D05");
  const d08score = d05ev?.status === "pass" || d05ev?.status === "not_applicable" ? 1 : d05ev?.status === "report" || d05ev?.status === "opportunity" ? 0.5 : 0;

  const d01ev = evals.find((e) => e.rule_id === "D01");
  const d01score = d01ev?.status === "pass" || d01ev?.status === "not_applicable" ? 1 : 0;

  const d03ev = evals.find((e) => e.rule_id === "D03");
  const d03score = typeof d03ev?.details?.compactness_ratio === "number" ? d03ev.details.compactness_ratio : 0;

  const d04ev = evals.find((e) => e.rule_id === "D04");
  const d04total = d04ev?.details?.reserve_rectangle_count as number ?? 0;
  const d04edge = d04ev?.details?.edge_reserve_rectangle_count as number ?? 0;
  const d04score = d04total === 0 ? 1 : d04edge / d04total;

  const bras = zones.filter((z) => z.content_type === "bras");
  const brasAtEdge = bras.length === 0 ? 1 : bras.every((z) => Math.abs(z.x_cm) < 0.001 || Math.abs(z.x_cm + z.assigned_w_cm - drawerW) < 0.001) ? 1 : 0;

  const cells = zones.filter((z) => z.division_type === "cells");
  let d05cells = 1;
  if (cells.length > 1) {
    const visited = new Set<string>();
    const stack = [cells[0]];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur.zone_id)) continue;
      visited.add(cur.zone_id);
      for (const other of cells) {
        if (visited.has(other.zone_id)) continue;
        const xT = (Math.abs(cur.x_cm + cur.assigned_w_cm - other.x_cm) < 0.001 || Math.abs(other.x_cm + other.assigned_w_cm - cur.x_cm) < 0.001) && cur.y_cm < other.y_cm + other.assigned_d_cm && other.y_cm < cur.y_cm + cur.assigned_d_cm;
        const yT = (Math.abs(cur.y_cm + cur.assigned_d_cm - other.y_cm) < 0.001 || Math.abs(other.y_cm + other.assigned_d_cm - cur.y_cm) < 0.001) && cur.x_cm < other.x_cm + other.assigned_w_cm && other.x_cm < cur.x_cm + cur.assigned_w_cm;
        if (xT || yT) stack.push(other);
      }
    }
    d05cells = visited.size === cells.length ? 1 : 0;
  }

  const zone_eff = zones.length === 0 ? 1 : zones.reduce((s, z) => s + (z.count / Math.max(z.capacity, 1)), 0) / zones.length;

  return [
    `  total score:          ${total.toFixed(2)}`,
    `  no_deformation_risk:  ${no_deform} × 180 = ${(no_deform * 180).toFixed(1)}`,
    `  D05_access:           ${d08score.toFixed(2)} × 200 = ${(d08score * 200).toFixed(1)}`,
    `  D06_bras_pos:         ${brasAtEdge} × 150 = ${(brasAtEdge * 150).toFixed(1)}`,
    `  D01_grouping:         ${d01score.toFixed(2)} × 130 = ${(d01score * 130).toFixed(1)}`,
    `  D05_cells_adj:        ${d05cells} × 100 = ${(d05cells * 100).toFixed(1)}`,
    `  depth_utilization:    ${depth_util.toFixed(3)} × 80 = ${(depth_util * 80).toFixed(1)}`,
    `  D03_compactness:      ${(d03score as number).toFixed(3)} × 70 = ${((d03score as number) * 70).toFixed(1)}`,
    `  no_compressed_storage:${no_compress} × 60 = ${(no_compress * 60).toFixed(1)}`,
    `  D04_edge_reserve:     ${(d04score).toFixed(3)} × 60 = ${((d04score) * 60).toFixed(1)}`,
    `  zone_efficiency:      ${zone_eff.toFixed(3)} × 4.9 = ${(zone_eff * 4.9).toFixed(2)}`,
  ].join("\n");
}

function runScenario(scenarioId: string, userInput: UserInput): void {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`SCENARIO ${scenarioId}`);
  console.log("=".repeat(70));

  // --- 1. Input ---
  const items = userInput.items ?? [];
  console.log("\n[1] INPUT");
  console.log(`  drawer: ${userInput.drawer_width_cm}×${userInput.drawer_depth_cm}×${userInput.drawer_height_cm} cm`);
  console.log(`  storage_category: ${userInput.storage_category}`);
  console.log(`  priority: ${userInput.priority}`);
  items.forEach((it, i) => console.log(`  item_${i + 1}: ${it.content_type} ${it.volume_level}`));
  if (scenarioId === "F3") {
    console.log("  AUDIT NOTE: Original scenario specified pajamas which belongs to underwear,");
    console.log("  not soft_clothes, in the current library. Substituted shorts (valid soft_clothes).");
    console.log("  If pajamas support for soft_clothes is needed, that requires a library update.");
  }

  // Production validation check
  const prodNorm = normalizeInput(userInput);  // max_items=3 by default
  const prodVal = validateInput(prodNorm);
  const devNorm = normalizeInput(userInput, { maxItems: 4 });
  const devVal = validateInput(devNorm);

  console.log("\n[VALIDATION]");
  if (!prodVal.ok) {
    console.log(`  production (max_items=3): REJECTED — ${prodVal.errors.join("; ")}`);
    console.log(`  dev path (max_items=4): ${devVal.ok ? "ACCEPTED" : "REJECTED — " + devVal.errors.join("; ")}`);
    console.log("  NOTE: Using dev/test normalization path (maxItems=4 override).");
  } else {
    console.log(`  production (max_items=3): ACCEPTED`);
  }
  if (devVal.warnings.length > 0) {
    console.log(`  warnings: ${devVal.warnings.join("; ")}`);
  }

  if (!devVal.ok) {
    console.log(`\n  CANNOT RUN: dev validation also failed — ${devVal.errors.join("; ")}`);
    return;
  }

  // --- Pipeline ---
  const counted = volumeToCount(devNorm.items, defaultLibraries.volumeToCount);
  const reqs = buildStorageRequirements({ countedItems: counted, storageUnitProfile: defaultLibraries.storageUnitProfile, zoneLayoutOptions: defaultLibraries.zoneLayoutOptions });
  const drawerSize = devNorm.drawerSize;
  const zoneVariants = generateZoneVariants(reqs, defaultLibraries.zoneLayoutOptions, drawerSize);
  const candidates = generatePlacementCandidates({ zoneVariants, drawerSize });
  const bestRaw = selectBestCandidate({ candidates, drawerSize });

  // --- 2. Final status ---
  console.log("\n[2] FINAL STATUS");
  if (!bestRaw) {
    console.log("  fit_status: no_fit");
    console.log(`\n[3] RESULT null? YES — no_fit_message: "${NO_FIT_MESSAGE}"`);

    const bestFailed = candidates.reduce<FitResult | undefined>((best, c) => !best || c.best_attempt.placed_count > best.best_attempt.placed_count ? c : best, undefined);
    if (bestFailed) {
      console.log(`\n  best partial attempt: ${bestFailed.best_attempt.placed_count}/${items.length} placed`);
      console.log(`  overflow: w=${bestFailed.overflow_width_cm} d=${bestFailed.overflow_depth_cm} h=${bestFailed.overflow_height_cm}`);
      console.log(`  failed_dimension: ${bestFailed.failed_dimension ?? "unknown"}`);
      if (bestFailed.unplaced_zones.length > 0) {
        console.log(`  unplaced: ${bestFailed.unplaced_zones.map((z) => z.content_type).join(", ")}`);
      }
    }
    return;
  }

  console.log("  fit_status: fit_all");

  // --- 3. Result null? ---
  console.log("\n[3] RESULT null? NO — no_fit_message: none");

  // --- 4. Selected order / permutation ---
  console.log("\n[4] SELECTED ORDER / PERMUTATION");
  bestRaw.placed_zones.forEach((z, i) => console.log(`  ${i + 1}. ${z.content_type} (${z.option_id})`));

  // --- 5. Selected zone variants ---
  console.log("\n[5] SELECTED ZONE VARIANTS");
  bestRaw.placed_zones.forEach((z) => {
    console.log(`  ${z.content_type}: ${z.option_id} | ${z.division_type} | ${z.calculation_mode} | zone ${z.zone_w_cm}×${z.zone_d_cm}×${z.zone_h_cm} | cap ${z.capacity}`);
  });

  // --- 6. Score ---
  console.log("\n[6] SCORE TOTAL AND BREAKDOWN");
  console.log(scoreBreakdown(bestRaw, drawerSize.w_cm, drawerSize.d_cm, drawerSize.h_cm));

  // --- 7. Hard filter status ---
  const evals = evaluatePlacementRules({ drawerSize, fitResult: bestRaw });
  const zi = evals.find((e) => e.rule_id === "ZONE_INTEGRITY");
  const d02 = evals.find((e) => e.rule_id === "D02");
  console.log("\n[7] HARD FILTER STATUS");
  console.log(`  fit_all:       ${bestRaw.fit_status === "fit_all" ? "PASS" : "FAIL"}`);
  console.log(`  ZONE_INTEGRITY:${zi?.status === "pass" ? "PASS" : ("FAIL — " + zi?.message)}`);
  console.log(`  D02:           ${d02?.status === "pass" || d02?.status === "not_applicable" ? (d02.status === "not_applicable" ? "not_applicable" : "PASS") : "VIOLATION — " + d02?.message}`);

  // --- 8. Zones before normalization ---
  console.log("\n[8] ZONES BEFORE NORMALIZATION");
  const hdr = `  ${"content_type".padEnd(18)} ${"option_id".padEnd(14)} ${"x".padEnd(6)} ${"y".padEnd(6)} ${"zone_w".padEnd(8)} ${"zone_d".padEnd(8)} ${"asgn_w".padEnd(10)} ${"asgn_d".padEnd(10)}`;
  console.log(hdr);
  for (const z of bestRaw.placed_zones) {
    console.log(fmtZoneRow(z));
  }

  // --- Normalization ---
  const normalized = normalizePlacement({ fitResult: bestRaw, drawerSize });

  // --- 9. Zones after normalization ---
  console.log("\n[9] ZONES AFTER NORMALIZATION");
  console.log(hdr);
  for (const z of normalized.placed_zones) {
    console.log(fmtZoneRow(z));
  }

  // --- 10. Normalization changes ---
  console.log("\n[10] NORMALIZATION CHANGES");
  const beforeById = new Map(bestRaw.placed_zones.map((z) => [z.zone_id, z]));
  const afterById = new Map(normalized.placed_zones.map((z) => [z.zone_id, z]));
  const alignChanges: string[] = [];
  const d04bChanges: string[] = [];

  for (const [id, after] of afterById) {
    const before = beforeById.get(id);
    if (!before) continue;
    if (Math.abs(after.assigned_w_cm - before.assigned_w_cm) > 0.001) {
      alignChanges.push(`${after.content_type}: assigned_w ${before.assigned_w_cm} → ${after.assigned_w_cm}`);
    }
    if (Math.abs(after.assigned_d_cm - before.assigned_d_cm) > 0.001) {
      d04bChanges.push(`${after.content_type}: assigned_d ${before.assigned_d_cm} → ${after.assigned_d_cm} (+${(after.assigned_d_cm - before.assigned_d_cm).toFixed(2)})`);
    }
  }
  console.log(`  alignColumns:  ${alignChanges.length > 0 ? alignChanges.join("; ") : "no changes"}`);
  console.log(`  D04b absorption: ${d04bChanges.length > 0 ? d04bChanges.join("; ") : "no changes"}`);

  // --- 11. Content warnings ---
  const allWarnings = [...bestRaw.content_warnings, ...normalized.content_warnings.filter((w) => !bestRaw.content_warnings.some((b) => b.zone_id === w.zone_id))];
  console.log("\n[11] CONTENT WARNINGS");
  if (allWarnings.length === 0) {
    console.log("  none");
  } else {
    for (const w of allWarnings) {
      console.log(`  [${w.warning_code}] ${w.content_type}: h_needed=${w.needed_h_cm} h_available=${w.available_h_cm} overflow=${w.overflow_h_cm} max_allowed=${w.max_allowed_overflow_h_cm}`);
    }
  }

  // --- 12. ASCII layout ---
  console.log("\n[12] VISUAL LAYOUT (after normalization)");
  console.log(`  drawer: ${drawerSize.w_cm}×${drawerSize.d_cm} cm (width×depth)  top=front`);
  console.log(renderAsciiLayout(normalized.placed_zones, drawerSize.w_cm, drawerSize.d_cm));

  // --- 13. Interpretation ---
  const hasDeform = allWarnings.some((w) => w.warning_code === "deformation_risk");
  const hasCompress = allWarnings.some((w) => w.warning_code === "compressed_storage");
  const zoneIntOk = zi?.status === "pass";
  const d02ok = d02?.status === "pass" || d02?.status === "not_applicable";
  const totalScore = scorePlacementCandidate(bestRaw, drawerSize, evals);

  let interpretation = "good";
  const issues: string[] = [];
  if (hasDeform) { interpretation = "suspicious"; issues.push("deformation_risk warning"); }
  if (hasCompress) { if (interpretation === "good") interpretation = "acceptable"; issues.push("compressed_storage warning"); }
  if (!zoneIntOk) { interpretation = "regression"; issues.push("ZONE_INTEGRITY violation"); }
  if (!d02ok) { interpretation = "regression"; issues.push("D02 violation"); }
  if (totalScore < 500) { if (interpretation === "good") interpretation = "acceptable"; issues.push(`low score (${totalScore.toFixed(0)})`); }

  console.log("\n[13] INTERPRETATION");
  console.log(`  verdict: ${interpretation.toUpperCase()}${issues.length ? " — " + issues.join(", ") : ""}`);
  if (interpretation === "good") console.log("  All hard rules pass, no height warnings, healthy score.");
}

// --- Summary table ---
function printSummaryTable(results: Array<{ id: string; status: string; score: string; order: string; variants: string; warnings: string; normalization: string; interpretation: string }>): void {
  console.log(`\n${"=".repeat(70)}`);
  console.log("SUMMARY TABLE");
  console.log("=".repeat(70));
  console.log(`${"scenario".padEnd(10)} ${"status".padEnd(10)} ${"score".padEnd(8)} ${"order".padEnd(40)} ${"warnings".padEnd(20)} ${"norm".padEnd(20)} ${"interpretation"}`);
  for (const r of results) {
    console.log(`${r.id.padEnd(10)} ${r.status.padEnd(10)} ${r.score.padEnd(8)} ${r.order.padEnd(40)} ${r.warnings.padEnd(20)} ${r.normalization.padEnd(20)} ${r.interpretation}`);
  }
}

// Run all scenarios
const summaryRows: Array<{ id: string; status: string; score: string; order: string; variants: string; warnings: string; normalization: string; interpretation: string }> = [];

for (const scenario of SCENARIOS) {
  runScenario(scenario.id, scenario.input);

  // Collect summary data
  const devNorm = normalizeInput(scenario.input, { maxItems: 4 });
  const devVal = validateInput(devNorm);
  if (!devVal.ok) {
    summaryRows.push({ id: scenario.id, status: "INVALID", score: "—", order: "—", variants: "—", warnings: "—", normalization: "—", interpretation: "ERROR" });
    continue;
  }
  const counted = volumeToCount(devNorm.items, defaultLibraries.volumeToCount);
  const reqs = buildStorageRequirements({ countedItems: counted, storageUnitProfile: defaultLibraries.storageUnitProfile, zoneLayoutOptions: defaultLibraries.zoneLayoutOptions });
  const drawerSize = devNorm.drawerSize;
  const zoneVariants = generateZoneVariants(reqs, defaultLibraries.zoneLayoutOptions, drawerSize);
  const candidates = generatePlacementCandidates({ zoneVariants, drawerSize });
  const bestRaw = selectBestCandidate({ candidates, drawerSize });

  if (!bestRaw) {
    summaryRows.push({ id: scenario.id, status: "no_fit", score: "—", order: "—", variants: "—", warnings: "—", normalization: "—", interpretation: "no_fit" });
    continue;
  }

  const evals = evaluatePlacementRules({ drawerSize, fitResult: bestRaw });
  const normalized = normalizePlacement({ fitResult: bestRaw, drawerSize });
  const totalScore = scorePlacementCandidate(bestRaw, drawerSize, evals);
  const warnings = bestRaw.content_warnings.map((w) => w.warning_code).join(",") || "none";
  const order = bestRaw.placed_zones.map((z) => z.content_type.replace("socks_regular", "socks").replace("jewelry_small", "jewelry")).join(">");

  const beforeById = new Map(bestRaw.placed_zones.map((z) => [z.zone_id, z]));
  const afterById = new Map(normalized.placed_zones.map((z) => [z.zone_id, z]));
  const normChanges: string[] = [];
  for (const [id, after] of afterById) {
    const before = beforeById.get(id);
    if (!before) continue;
    if (Math.abs(after.assigned_w_cm - before.assigned_w_cm) > 0.001) normChanges.push(`align:${after.content_type}`);
    if (Math.abs(after.assigned_d_cm - before.assigned_d_cm) > 0.001) normChanges.push(`D04b:${after.content_type}`);
  }

  const d02 = evals.find((e) => e.rule_id === "D02");
  const zi = evals.find((e) => e.rule_id === "ZONE_INTEGRITY");
  const hasDeform = bestRaw.content_warnings.some((w) => w.warning_code === "deformation_risk");
  const hasCompress = bestRaw.content_warnings.some((w) => w.warning_code === "compressed_storage");
  const d02ok = d02?.status === "pass" || d02?.status === "not_applicable";
  const zOk = zi?.status === "pass";
  let interp = "good";
  if (!zOk || !d02ok) interp = "regression";
  else if (hasDeform) interp = "suspicious";
  else if (hasCompress || totalScore < 500) interp = "acceptable";

  summaryRows.push({
    id: scenario.id,
    status: "fit_all",
    score: totalScore.toFixed(0),
    order,
    variants: bestRaw.placed_zones.map((z) => z.option_id).join("|"),
    warnings,
    normalization: normChanges.length > 0 ? normChanges.join(";") : "none",
    interpretation: interp,
  });
}

printSummaryTable(summaryRows);

console.log("\n=== PRODUCTION READINESS ASSESSMENT ===");
const allFitAll = summaryRows.every((r) => r.status === "fit_all");
const anyRegression = summaryRows.some((r) => r.interpretation === "regression");
const anySuspicious = summaryRows.some((r) => r.interpretation === "suspicious");
if (anyRegression) {
  console.log("VERDICT: NOT READY — regression detected in one or more scenarios.");
} else if (!allFitAll) {
  console.log("VERDICT: NEEDS REVIEW — one or more scenarios returned no_fit.");
} else if (anySuspicious) {
  console.log("VERDICT: CONDITIONAL — all fit_all but suspicious warnings present. Investigate before enabling production maxItems=4.");
} else {
  console.log("VERDICT: READY — all scenarios fit_all, hard rules pass, no regressions detected.");
}
console.log("NOTE: Production validation currently rejects max_items=4. This audit used dev path (maxItems override). To enable production support, update normalizeInput default maxItems to 4 and the validation error message.");
