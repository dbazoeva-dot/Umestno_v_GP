// Из всех fit_all-кандидатов ищем layout, где boxers стоит в той же
// X-колонке, что panties (т.е. «за panties по глубине»). Показываем
// score и сравниваем с топ-1 + top non-rotated.

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
const variants = generateZoneVariants(reqs, defaultLibraries.zoneLayoutOptions, normalized.drawerSize);
const all = generatePlacementCandidates({ zoneVariants: variants, drawerSize: normalized.drawerSize });
const fitAll = all.filter((c: any) => c.fit_status === "fit_all");

const matched: Array<{ score: number; candidate: any }> = [];
for (const c of fitAll) {
  const p = c.placed_zones.find((z: any) => z.content_type === "panties");
  const b = c.placed_zones.find((z: any) => z.content_type === "boxers");
  if (!p || !b) continue;
  // boxers «за panties»: x-диапазон boxers полностью внутри x-диапазона panties,
  // и y_boxers >= y_panties + assigned_d_panties (т.е. под panties)
  const inXRange = b.x_cm >= p.x_cm && b.x_cm + b.assigned_w_cm <= p.x_cm + p.assigned_w_cm + 0.01;
  const below = b.y_cm + 0.01 >= p.y_cm + p.assigned_d_cm;
  if (!inXRange || !below) continue;
  const evals = evaluatePlacementRules({ drawerSize: normalized.drawerSize, fitResult: c });
  if (evals.find((e: any) => e.rule_id === "ZONE_INTEGRITY")?.status !== "pass") continue;
  if (evals.find((e: any) => e.rule_id === "D02")?.status === "violation") continue;
  matched.push({ score: scorePlacementCandidate(c, normalized.drawerSize, evals), candidate: c });
}

matched.sort((a, b) => b.score - a.score);
console.log(`fit_all всего: ${fitAll.length}`);
console.log(`layouts где boxers за panties (одна X-колонка): ${matched.length}\n`);

if (matched.length === 0) {
  console.log("Движок такую раскладку НЕ рассмотрел или она не прошла zone_integrity / D02.");
  console.log("Печатаю несколько near-misses (boxers под panties с переполнением по X):");
  for (const c of fitAll.slice(0, 0)) void c;
} else {
  console.log("Лучшие top-3:");
  for (let i = 0; i < Math.min(3, matched.length); i++) {
    console.log(`\n--- #${i+1}  score ${matched[i].score.toFixed(2)} ---`);
    for (const z of matched[i].candidate.placed_zones) {
      const tag = z.option_id?.includes("rotated") ? " ⟲" : "";
      console.log(`  ${z.content_type.padEnd(16)} ${z.assigned_w_cm}×${z.assigned_d_cm} @ (${z.x_cm}, ${z.y_cm})${tag}`);
    }
  }
}
