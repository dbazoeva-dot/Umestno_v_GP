// Прогоняет полный движок (включая matchSkus) на реальном
// SKU-каталоге, извлечённом из E_SKU_catalog_v2905.xlsx.
// Цель: увидеть, что матчит/не матчит на боевых данных.
//
// Запуск:
//   python3 engine/scripts/extractSkuCatalog.py E_SKU_catalog_v2905.xlsx > /tmp/catalog.json
//   npm run build
//   CATALOG=/tmp/catalog.json node dist/engine/test/runWithRealCatalog.js

import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import type { SkuCatalogRow } from "../types.js";

const catalogPath = process.env.CATALOG ?? "/tmp/catalog.json";
const skuCatalog: SkuCatalogRow[] = JSON.parse(readFileSync(catalogPath, "utf8"));
defaultLibraries.skuCatalog = skuCatalog;

console.log(`loaded ${skuCatalog.length} SKUs from ${catalogPath}`);
console.log();

interface Scenario { name: string; input: Parameters<typeof runUmestnoEngine>[0] }

const scenarios: Scenario[] = [
  {
    name: "underwear 80x45x15 — panties+bras+socks (large)",
    input: {
      drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15,
      storage_category: "underwear",
      items: [
        { content_type: "panties", volume_level: "large" },
        { content_type: "bras", volume_level: "large" },
        { content_type: "socks_regular", volume_level: "large" },
      ],
      priority: "convenient",
    },
  },
  {
    name: "underwear 60x40x10 — only socks (medium)",
    input: {
      drawer_width_cm: 60, drawer_depth_cm: 40, drawer_height_cm: 10,
      storage_category: "underwear",
      items: [{ content_type: "socks_regular", volume_level: "medium" }],
      priority: "convenient",
    },
  },
  {
    name: "soft_clothes 90x50x20 — jeans+sweaters+tshirts (medium)",
    input: {
      drawer_width_cm: 90, drawer_depth_cm: 50, drawer_height_cm: 20,
      storage_category: "soft_clothes",
      items: [
        { content_type: "jeans", volume_level: "medium" },
        { content_type: "sweaters", volume_level: "medium" },
        { content_type: "tshirts", volume_level: "medium" },
      ],
      priority: "convenient",
    },
  },
  {
    name: "accessories 50x35x10 — belts+jewelry_small",
    input: {
      drawer_width_cm: 50, drawer_depth_cm: 35, drawer_height_cm: 10,
      storage_category: "accessories",
      items: [
        { content_type: "belts", volume_level: "medium" },
        { content_type: "jewelry_small", volume_level: "medium" },
      ],
      priority: "convenient",
    },
  },
];

let totalZones = 0, exactN = 0, composedN = 0, altN = 0, noMatchN = 0;
const noMatchSamples: Array<{ scenario: string; zone: any }> = [];

for (const sc of scenarios) {
  const out = runUmestnoEngine(sc.input) as { result: any; scheme_payload: any; debug: any };
  if (!out.result || !out.scheme_payload) {
    console.log(`▸ ${sc.name}`);
    console.log(`  scheme not built (fit_status: ${out.debug?.fit_result?.fit_status ?? "?"})`);
    console.log();
    continue;
  }
  const skuFit = out.debug.sku_fit_result;
  const matches: any[] = out.debug.sku_matching_result ?? [];
  console.log(`▸ ${sc.name}`);
  console.log(`  scheme: ${out.scheme_payload.assigned_zones.length} zones, sku_fit_status=${skuFit?.sku_fit_status}`);
  for (const m of matches) {
    totalZones++;
    const top = m.candidates[0];
    const status = m.match_status;
    const tag =
      status === "exact" ? "✓ exact" :
      status === "composed_from_slots" ? "★ composed" :
      status === "alternative_division" ? "▲ alt-div" :
      "✗ no_match";
    if (status === "exact") exactN++;
    else if (status === "composed_from_slots") composedN++;
    else if (status === "alternative_division") altN++;
    else noMatchN++;

    const topInfo = top
      ? `${top.sku_id} (${m.match_kind}, packs=${m.packs_needed}, units=${m.units_needed})`
      : "—";
    console.log(`    [${tag}] ${m.content_type} (${m.zone_id}) → ${topInfo}, ${m.candidates.length} cand`);
    if (status === "no_match") {
      noMatchSamples.push({ scenario: sc.name, zone: m.no_match_log });
    }
  }
  console.log();
}

console.log("──── SUMMARY ────");
console.log(`zones total:      ${totalZones}`);
console.log(`  exact:          ${exactN}`);
console.log(`  composed:       ${composedN}`);
console.log(`  alt-division:   ${altN}`);
console.log(`  no_match:       ${noMatchN}`);

if (noMatchSamples.length > 0) {
  console.log();
  console.log("──── NO_MATCH SAMPLES (for catalog/spec review) ────");
  for (const s of noMatchSamples.slice(0, 10)) {
    console.log(`▸ ${s.scenario}`);
    console.log(`  ${JSON.stringify(s.zone)}`);
  }
}
