// Сравнивает score двух layout-кандидатов: один с rotated boxers,
// один с non-rotated. Показывает, какой компонент скоринга реально
// тащит rotated в победу.

import { readFileSync } from "node:fs";
import { normalizeInput } from "../input/normalizeInput.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import { volumeToCount } from "../count/volumeToCount.js";
import { buildStorageRequirements } from "../requirements/buildStorageRequirements.js";
import { generateZoneVariants } from "../zones/generateZoneVariants.js";
import { generatePlacementCandidates } from "../fit/generatePlacementCandidates.js";
import { scorePlacementCandidate } from "../fit/scorePlacementCandidate.js";
import { evaluatePlacementRules } from "../rules/evaluatePlacementRules.js";
import type { SkuCatalogRow } from "../types.js";

const skuCatalog: SkuCatalogRow[] = JSON.parse(readFileSync(process.env.CATALOG ?? "/tmp/catalog.json", "utf8"));
defaultLibraries.skuCatalog = skuCatalog;

const normalized = normalizeInput({
  drawer_width_cm: 100, drawer_depth_cm: 50, drawer_height_cm: 15,
  storage_category: "underwear",
  items: [
    { content_type: "panties", volume_level: "medium" },
    { content_type: "bras",    volume_level: "medium" },
    { content_type: "socks_regular", volume_level: "medium" },
    { content_type: "boxers",  volume_level: "medium" },
  ],
  priority: "convenient",
});

const counted = volumeToCount(normalized.items, defaultLibraries.volumeToCount);
const requirements = buildStorageRequirements({ countedItems: counted, storageUnitProfile: defaultLibraries.storageUnitProfile, zoneLayoutOptions: defaultLibraries.zoneLayoutOptions });
const zoneVariants = generateZoneVariants(requirements, defaultLibraries.zoneLayoutOptions, normalized.drawerSize);
const allCandidates = generatePlacementCandidates({ zoneVariants, drawerSize: normalized.drawerSize });

console.log(`всего layout-кандидатов: ${allCandidates.length}`);
const fitAll = allCandidates.filter((c: any) => c.fit_status === "fit_all");
console.log(`fit_all: ${fitAll.length}\n`);

// Группируем по выбранному boxers option_id, считаем score каждой группы.
interface Row { option: string; score: number; candidate: any }
const rows: Row[] = [];
for (const c of fitAll) {
  const boxers = c.placed_zones.find((z: any) => z.content_type === "boxers");
  if (!boxers) continue;
  const evals = evaluatePlacementRules({ drawerSize: normalized.drawerSize, fitResult: c });
  const zoneIntegrity = evals.find((e) => e.rule_id === "ZONE_INTEGRITY");
  const d02 = evals.find((e) => e.rule_id === "D02");
  if (zoneIntegrity?.status !== "pass") continue;
  if (d02?.status === "violation") continue;
  const score = scorePlacementCandidate(c, normalized.drawerSize, evals);
  rows.push({ option: boxers.option_id, score, candidate: c });
}

rows.sort((a, b) => b.score - a.score);

// Брейкдаун по компонентам — печатаем для top-rotated и top-non-rotated.
function breakdown(c: any, drawerSize: any) {
  const evals = evaluatePlacementRules({ drawerSize, fitResult: c });
  const get = (id: string) => {
    const ev = evals.find((e: any) => e.rule_id === id);
    if (!ev) return 0;
    if (ev.status === "pass" || ev.status === "not_applicable") return 1;
    if (ev.status === "report" || ev.status === "opportunity") return 0.5;
    return 0;
  };
  const zones = c.placed_zones;
  const d08 = get("D05");
  const d01 = get("D01");
  const d03 = (() => { const ev = evals.find((e: any) => e.rule_id === "D03"); return typeof ev?.details?.compactness_ratio === "number" ? ev.details.compactness_ratio : 0; })();
  const d04 = (() => {
    const ev = evals.find((e: any) => e.rule_id === "D04");
    if (!ev?.details) return 0;
    const total = ev.details.reserve_rectangle_count as number;
    const edge  = ev.details.edge_reserve_rectangle_count as number;
    if (total === 0) return 1;
    return edge / total;
  })();
  const bras = zones.filter((z: any) => z.content_type === "bras");
  const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < 0.0001;
  const d06 = bras.length === 0 ? 1 : bras.every((z: any) => nearlyEqual(z.x_cm, 0) || nearlyEqual(z.x_cm + z.assigned_w_cm, drawerSize.w_cm)) ? 1 : 0;
  const depthUtil = Math.min(c.used_depth_cm / drawerSize.d_cm, 1);
  const noDeform = c.content_warnings.some((w: any) => w.warning_code === "deformation_risk") ? 0 : 1;
  const noCompress = c.content_warnings.some((w: any) => w.warning_code === "compressed_storage") ? 0 : 1;
  const cells = zones.filter((z: any) => z.division_type === "cells");
  const d05cells = cells.length <= 1 ? 1 : 0; // упрощённо — точная adjacency требует kotlin-walk
  const zoneEff = zones.length === 0 ? 1 : zones.reduce((s: number, z: any) => s + (z.count / Math.max(z.capacity, 1)), 0) / zones.length;
  return {
    no_deform:    { val: noDeform,  weight: 180, score: noDeform * 180 },
    d08_access:   { val: d08,       weight: 200, score: d08 * 200 },
    d06_bras_pos: { val: d06,       weight: 150, score: d06 * 150 },
    d01:          { val: d01,       weight: 130, score: d01 * 130 },
    d05_cells:    { val: d05cells,  weight: 100, score: d05cells * 100 },
    depth_util:   { val: depthUtil, weight: 80,  score: depthUtil * 80, raw: `${c.used_depth_cm}/${drawerSize.d_cm}` },
    d03_compact:  { val: d03,       weight: 70,  score: d03 * 70 },
    no_compress:  { val: noCompress,weight: 60,  score: noCompress * 60 },
    d04_edge_res: { val: d04,       weight: 60,  score: d04 * 60 },
    zone_eff:     { val: zoneEff,   weight: 4.9, score: zoneEff * 4.9 },
  };
}

function printBreakdown(label: string, c: any, drawerSize: any) {
  console.log(`\n=== ${label} ===`);
  for (const z of c.placed_zones) console.log(`   ${z.content_type.padEnd(16)} ${z.assigned_w_cm}×${z.assigned_d_cm} @ (${z.x_cm},${z.y_cm})`);
  const b = breakdown(c, drawerSize);
  console.log(`\n  ${"component".padEnd(16)} ${"value".padStart(8)}  ${"weight".padStart(6)}  ${"score".padStart(8)}`);
  console.log(`  ${"-".repeat(16)} ${"-".repeat(8)}  ${"-".repeat(6)}  ${"-".repeat(8)}`);
  let total = 0;
  for (const [k, v] of Object.entries(b)) {
    const extra = (v as any).raw ? `  ← ${(v as any).raw}` : "";
    console.log(`  ${k.padEnd(16)} ${v.val.toFixed(3).padStart(8)}  ${String(v.weight).padStart(6)}  ${v.score.toFixed(2).padStart(8)}${extra}`);
    total += v.score;
  }
  console.log(`  ${"TOTAL".padEnd(16)} ${"".padStart(8)}  ${"".padStart(6)}  ${total.toFixed(2).padStart(8)}`);
}

const topRot = rows.find((r) => r.option === "slots_single_row_rotated");
const topNonRot = rows.find((r) => r.option === "slots_single_row");
if (topRot) printBreakdown("TOP ROTATED", (topRot as any).candidate, normalized.drawerSize);
if (topNonRot) printBreakdown("TOP NON-ROTATED", (topNonRot as any).candidate, normalized.drawerSize);

console.log("\nГруппировка по boxers option_id:");
const byOption = new Map<string, { count: number; best: number }>();
for (const r of rows) {
  const cur = byOption.get(r.option) ?? { count: 0, best: -Infinity };
  cur.count++;
  if (r.score > cur.best) cur.best = r.score;
  byOption.set(r.option, cur);
}
for (const [k, v] of byOption) {
  console.log(`  ${k.padEnd(36)}  кандидатов: ${v.count},  лучший score: ${v.best.toFixed(2)}`);
}
