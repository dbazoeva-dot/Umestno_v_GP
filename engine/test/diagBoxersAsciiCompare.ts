// Печатает ASCII обоих топ-кандидатов (rotated vs non-rotated boxers)
// для визуального сравнения формы зон и резерва.

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
const reqs = buildStorageRequirements({ countedItems: counted, storageUnitProfile: defaultLibraries.storageUnitProfile, zoneLayoutOptions: defaultLibraries.zoneLayoutOptions });
const zoneVariants = generateZoneVariants(reqs, defaultLibraries.zoneLayoutOptions, normalized.drawerSize);
const all = generatePlacementCandidates({ zoneVariants, drawerSize: normalized.drawerSize });
const fitAll = all.filter((c: any) => c.fit_status === "fit_all");

let bestRot: any = null, bestNonRot: any = null;
let bestRotScore = -Infinity, bestNonRotScore = -Infinity;
for (const c of fitAll) {
  const b = c.placed_zones.find((z: any) => z.content_type === "boxers");
  if (!b) continue;
  const evals = evaluatePlacementRules({ drawerSize: normalized.drawerSize, fitResult: c });
  if (evals.find((e: any) => e.rule_id === "ZONE_INTEGRITY")?.status !== "pass") continue;
  if (evals.find((e: any) => e.rule_id === "D02")?.status === "violation") continue;
  const s = scorePlacementCandidate(c, normalized.drawerSize, evals);
  if (b.option_id === "slots_single_row_rotated" && s > bestRotScore) { bestRotScore = s; bestRot = c; }
  if (b.option_id === "slots_single_row" && s > bestNonRotScore) { bestNonRotScore = s; bestNonRot = c; }
}

// ── ASCII renderer ─────────────────────────────────────
const CHAR_W = 2.5, CHAR_H = 4;
function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
function drawerAscii(drawer: { w: number; d: number }, zones: any[]) {
  const W = Math.round(drawer.w / CHAR_W);
  const D = Math.round(drawer.d / CHAR_H);
  const g: string[][] = Array.from({ length: D }, () => Array(W).fill(" "));
  for (const z of zones) {
    const x0 = Math.round(z.x_cm / CHAR_W);
    const y0 = Math.round(z.y_cm / CHAR_H);
    const x1 = Math.min(W - 1, Math.max(x0 + 1, Math.round((z.x_cm + z.assigned_w_cm) / CHAR_W) - 1));
    const y1 = Math.min(D - 1, Math.max(y0 + 1, Math.round((z.y_cm + z.assigned_d_cm) / CHAR_H) - 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (y === y0 || y === y1) g[y][x] = "─";
      else if (x === x0 || x === x1) g[y][x] = "│";
    }
    g[y0][x0] = "┌"; g[y0][x1] = "┐"; g[y1][x0] = "└"; g[y1][x1] = "┘";
    if (y1 - y0 >= 1 && x1 - x0 >= 3) {
      const midY = Math.floor((y0 + y1) / 2);
      const room = x1 - x0 - 1;
      const text = z.content_type.slice(0, room);
      for (let i = 0; i < text.length; i++) g[midY][x0 + 1 + i] = text[i];
    }
  }
  const top = "┌" + "─".repeat(W) + "┐";
  const bot = "└" + "─".repeat(W) + "┘";
  return [top, ...g.map((r) => "│" + r.join("") + "│"), bot];
}

function annotate(zones: any[]): string[] {
  return zones.map((z) =>
    `  ${pad(z.content_type, 16)} ${pad(`${z.assigned_w_cm}×${z.assigned_d_cm}`, 12)} @ (${z.x_cm}, ${z.y_cm})${z.option_id?.includes("rotated") ? "  ⟲ ROTATED" : ""}`,
  );
}

console.log("══════════════════════════════════════════════════════════════");
console.log(`TOP ROTATED (score ${bestRotScore.toFixed(2)})`);
console.log("══════════════════════════════════════════════════════════════");
for (const line of drawerAscii({ w: normalized.drawerSize.w_cm, d: normalized.drawerSize.d_cm },bestRot.placed_zones)) console.log(line);
console.log("\nзоны:");
for (const line of annotate(bestRot.placed_zones)) console.log(line);
console.log(`\nused_depth: ${bestRot.used_depth_cm} см, used_width: ${bestRot.used_width_cm} см`);
console.log(`reserve: ${bestRot.free_rectangles.length} прямоугольников`);

console.log("\n");
console.log("══════════════════════════════════════════════════════════════");
console.log(`TOP NON-ROTATED (score ${bestNonRotScore.toFixed(2)})`);
console.log("══════════════════════════════════════════════════════════════");
for (const line of drawerAscii({ w: normalized.drawerSize.w_cm, d: normalized.drawerSize.d_cm },bestNonRot.placed_zones)) console.log(line);
console.log("\nзоны:");
for (const line of annotate(bestNonRot.placed_zones)) console.log(line);
console.log(`\nused_depth: ${bestNonRot.used_depth_cm} см, used_width: ${bestNonRot.used_width_cm} см`);
console.log(`reserve: ${bestNonRot.free_rectangles.length} прямоугольников`);
