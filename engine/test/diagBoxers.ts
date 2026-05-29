import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import type { SkuCatalogRow } from "../types.js";

const skuCatalog: SkuCatalogRow[] = JSON.parse(readFileSync(process.env.CATALOG ?? "/tmp/catalog.json", "utf8"));
defaultLibraries.skuCatalog = skuCatalog;

const out = runUmestnoEngine({
  drawer_width_cm: 100, drawer_depth_cm: 50, drawer_height_cm: 15,
  storage_category: "underwear",
  items: [
    { content_type: "panties", volume_level: "medium" },
    { content_type: "bras",    volume_level: "medium" },
    { content_type: "socks_regular", volume_level: "medium" },
    { content_type: "boxers",  volume_level: "medium" },
  ],
  priority: "convenient",
}) as any;

const boxers = out.scheme_payload.assigned_zones.find((z: any) => z.content_type === "boxers");
console.log("=== BOXERS ZONE ===");
console.log("count:", boxers.count);
console.log("unit:", boxers.unit_w_cm, "x", boxers.unit_d_cm, "x", boxers.unit_h_cm);
console.log("min zone (zone_*_cm):  ", boxers.zone_w_cm, "x", boxers.zone_d_cm, "x", boxers.zone_h_cm);
console.log("assigned (assigned_*): ", boxers.assigned_w_cm, "x", boxers.assigned_d_cm, "x", boxers.assigned_h_cm);
console.log("option_id:", boxers.option_id);
console.log("division_type:", boxers.division_type);
console.log("lanes_needed:", boxers.lanes_needed, "items_per_lane:", boxers.items_per_lane, "split_used:", boxers.split_used);
console.log("calculated_cols:", boxers.calculated_cols, "calculated_rows:", boxers.calculated_rows);
console.log("capacity (вместимость зоны):", boxers.capacity);

const boxerReq = out.debug.storage_requirements.find((r: any) => r.content_type === "boxers");
console.log("\n=== AVAILABLE LAYOUT OPTIONS FOR BOXERS ===");
for (const opt of boxerReq.available_layout_options) {
  console.log(`  ${opt.option_id}  div=${opt.division_type}  cols=${opt.cols ?? "-"}  rows=${opt.rows ?? "-"}  cap=${opt.capacity ?? "-"}  mode=${opt.calculation_mode}`);
}

console.log("\n=== ВСЕ ZONE_VARIANTS, ЧТО ДВИЖОК НАСЧИТАЛ ===");
for (const v of out.debug.zone_variants) {
  if (v.content_type !== "boxers") continue;
  console.log(`  ${v.option_id} → zone ${v.zone_w_cm}×${v.zone_d_cm}×${v.zone_h_cm}, capacity ${v.capacity}, cols=${v.calculated_cols ?? "-"} rows=${v.calculated_rows ?? "-"}, lanes_needed=${v.lanes_needed ?? "-"}`);
}

console.log("\n=== ALL PLACED ZONES (показывает, как layout раздул boxers) ===");
for (const z of out.scheme_payload.assigned_zones) {
  console.log(`  ${z.content_type}: zone ${z.zone_w_cm}×${z.zone_d_cm}, assigned ${z.assigned_w_cm}×${z.assigned_d_cm} @ (${z.x_cm}, ${z.y_cm})`);
}
