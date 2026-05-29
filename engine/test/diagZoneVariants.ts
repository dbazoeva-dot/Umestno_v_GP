import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import type { SkuCatalogRow } from "../types.js";

const skuCatalog: SkuCatalogRow[] = JSON.parse(readFileSync(process.env.CATALOG ?? "/tmp/catalog.json", "utf8"));
defaultLibraries.skuCatalog = skuCatalog;

const out = runUmestnoEngine({
  drawer_width_cm: 60, drawer_depth_cm: 40, drawer_height_cm: 10,
  storage_category: "underwear",
  items: [{ content_type: "socks_regular", volume_level: "medium" }],
  priority: "convenient",
}) as any;

console.log("=== ZONE VARIANTS GENERATED ===");
const variants = out.debug.zone_variants;
for (const v of variants) {
  console.log(`${v.content_type} / ${v.division_type} / ${v.option_id}`);
  console.log(`  cols=${v.calculated_cols} rows=${v.calculated_rows} → zone ${v.zone_w_cm}×${v.zone_d_cm}×${v.zone_h_cm}  capacity=${v.capacity}`);
}

console.log("\n=== SELECTED ZONE ===");
const selected = out.scheme_payload.selected_calculated_zones[0];
console.log(`option_id: ${selected.option_id}`);
console.log(`size: ${selected.zone_w_cm}×${selected.zone_d_cm}×${selected.zone_h_cm}, capacity ${selected.capacity}`);

console.log("\n=== PLACED ZONE ===");
const placed = out.scheme_payload.assigned_zones[0];
console.log(`assigned: ${placed.assigned_w_cm}×${placed.assigned_d_cm}×${placed.assigned_h_cm}`);
console.log(`zone: ${placed.zone_w_cm}×${placed.zone_d_cm}×${placed.zone_h_cm}`);

console.log("\n=== STORAGE REQUIREMENT (UNIT INFO) ===");
const req = out.debug.storage_requirements[0];
console.log(`unit: ${req.unit_w_cm}×${req.unit_d_cm}×${req.unit_h_cm}, count=${req.count}`);
console.log(`gaps: side_clear=${req.side_clear}, fb_clear=${req.fb_clear}, item_gap=${req.item_gap ?? "-"}`);
console.log(`zone layout options available:`);
for (const opt of req.available_layout_options) {
  console.log(`  ${opt.option_id} (${opt.division_type}, cols=${opt.cols ?? "-"}, rows=${opt.rows ?? "-"})`);
}
