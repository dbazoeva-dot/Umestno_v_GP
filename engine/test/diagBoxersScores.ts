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
interface Row { option: string; score: number; placed: any[] }
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
  rows.push({ option: boxers.option_id, score, placed: c.placed_zones });
}

rows.sort((a, b) => b.score - a.score);
console.log("Топ-10 layout-кандидатов (option_id boxers vs итоговый score):");
for (let i = 0; i < Math.min(10, rows.length); i++) {
  const r = rows[i];
  console.log(`  ${i+1}. boxers=${r.option.padEnd(36)}  score=${r.score.toFixed(2)}`);
  for (const z of r.placed) {
    console.log(`     ${z.content_type.padEnd(16)} ${z.assigned_w_cm}×${z.assigned_d_cm} @ (${z.x_cm},${z.y_cm})`);
  }
  console.log();
}

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
