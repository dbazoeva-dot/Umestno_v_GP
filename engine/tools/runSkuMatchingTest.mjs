// Dev-only: tests SKU matching against the real catalog from E_SKU_catalog_v0605.xlsx
// Usage:
//   python3 << 'EOF'
//   ... (see scripts/extractSkuCatalog.py)
//   EOF
//   node engine/tools/runSkuMatchingTest.mjs
//
// Requires: /tmp/sku_catalog_raw.json  (generate with: npm run build first)

import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../../dist/engine/index.js";
import { defaultLibraries } from "../../dist/engine/libraries/defaultLibraries.js";

// ─── Load catalog ────────────────────────────────────────────────────────────

const raw = JSON.parse(readFileSync("/tmp/sku_catalog_raw.json", "utf8"));

const VALID_DIVISION_TYPES = ["cells", "slots", "open"];

const catalog = raw
  .filter(r => VALID_DIVISION_TYPES.includes(r.division_type))
  .map(r => ({
    sku_id: r.sku_id ?? "",
    division_type: r.division_type,
    rigidity: r.rigidity ?? "",
    width_cm: parseFloat(r.width_cm ?? "0"),
    depth_cm: parseFloat(r.depth_cm ?? "0"),
    height_cm: parseFloat(r.height_cm ?? "0"),
    // open SKUs have null capacity — store as null, matchSkus fix handles it
    capacity_units: r.capacity_units != null ? parseInt(r.capacity_units) : null,
    color_group: r.color_group ?? undefined,
    color_normalized: r.color_normalized ?? undefined,
    material_group: r.material_group ?? undefined,
    availability_status: r.availability_status === "unavailable" ? "unavailable" : "available",
    product_title: r.product_title ?? "",
    source_platform: r.source_platform ?? undefined,
    product_url: r.product_url ?? undefined,
    price_rub: r.price != null ? parseFloat(r.price) : undefined,
  }));

console.log(`\nКаталог: ${catalog.length} SKU`);
console.log(`  cells: ${catalog.filter(s => s.division_type === "cells").length}`);
console.log(`  slots: ${catalog.filter(s => s.division_type === "slots").length}`);
console.log(`  open:  ${catalog.filter(s => s.division_type === "open").length}`);
console.log(`  open с null capacity: ${catalog.filter(s => s.division_type === "open" && s.capacity_units === null).length}`);

// ─── Scenarios ───────────────────────────────────────────────────────────────

const scenarios = [
  {
    name: "90×45×15 — носки / бюстгальтеры / трусы",
    input: { drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", item_1_content_type: "socks_regular", item_1_volume_level: "medium", item_2_content_type: "bras", item_2_volume_level: "medium", item_3_content_type: "panties", item_3_volume_level: "medium", priority: "convenient", color_preference: "not_important" },
  },
  {
    name: "120×40×20 — 4 вещи (panties/bras/socks/tights large)",
    input: { drawer_width_cm: 120, drawer_depth_cm: 40, drawer_height_cm: 20, storage_category: "underwear", items: [{ content_type: "panties", volume_level: "large" }, { content_type: "bras", volume_level: "large" }, { content_type: "socks_regular", volume_level: "large" }, { content_type: "tights", volume_level: "medium" }], priority: "convenient", color_preference: "not_important" },
  },
  {
    name: "75×45×15 — open fallback",
    input: { drawer_width_cm: 75, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", item_1_content_type: "bras", item_1_volume_level: "medium", item_2_content_type: "socks_regular", item_2_volume_level: "medium", item_3_content_type: "panties", item_3_volume_level: "medium", priority: "convenient", color_preference: "not_important" },
  },
];

// ─── Run ─────────────────────────────────────────────────────────────────────

for (const scenario of scenarios) {
  console.log(`\n${"═".repeat(68)}`);
  console.log(`▶ ${scenario.name}`);
  console.log("═".repeat(68));

  const output = runUmestnoEngine(scenario.input, { ...defaultLibraries, skuCatalog: catalog });

  if (!output.result) {
    console.log("❌ fit failed — движок вернул null");
    continue;
  }

  const products = output.result.products ?? [];
  const skuFit = output.result.sku_fit;
  const matched = products.filter(p => p.match_status === "exact").length;

  console.log(`\nsku_fit_status: ${skuFit?.sku_fit_status ?? "—"}`);
  console.log(`Зон: ${products.length}  |  совпадений: ${matched}/${products.length}\n`);

  for (const zone of products) {
    const icon = zone.match_status === "exact" ? "✓" : "✗";
    const zoneInfo = output.scheme_payload?.selected_calculated_zones?.find(z => z.zone_id === zone.zone_id);
    const dims = zoneInfo ? `zone ${zoneInfo.zone_w_cm}×${zoneInfo.zone_d_cm}×${zoneInfo.zone_h_cm}` : "";

    console.log(`  ${icon} ${zone.zone_id}  (${zone.content_type})  ${dims}`);

    if (zone.candidates.length > 0) {
      zone.candidates.slice(0, 3).forEach(c => {
        const price = c.price_rub != null ? `  ${c.price_rub}₽` : "";
        const cap = c.capacity_units != null ? `cap=${c.capacity_units}` : "cap=∞(open)";
        console.log(`      ${c.sku_id}  ${c.width_cm}×${c.depth_cm}×${c.height_cm}  ${cap}  ${c.color_group ?? "—"}${price}`);
        console.log(`        ${c.product_title.slice(0, 64)}`);
      });
      if (zone.candidates.length > 3) console.log(`      … ещё ${zone.candidates.length - 3} кандидата(ов)`);
    } else {
      // Diagnose why no match
      const dt = zoneInfo?.division_type;
      const count = zoneInfo?.count ?? "?";
      const byType = catalog.filter(s => s.division_type === dt);
      const byTypeCap = byType.filter(s => s.capacity_units === null || s.capacity_units >= Number(count));
      const byTypeDims = byTypeCap.filter(s => s.width_cm <= (zoneInfo?.zone_w_cm ?? 0) && s.depth_cm <= (zoneInfo?.zone_d_cm ?? 0) && s.height_cm <= (zoneInfo?.zone_h_cm ?? 0));
      console.log(`      нет кандидатов. type=${dt}, count=${count}`);
      console.log(`        по типу: ${byType.length}  → после capacity: ${byTypeCap.length}  → после размеров: ${byTypeDims.length}`);
    }
  }
}
