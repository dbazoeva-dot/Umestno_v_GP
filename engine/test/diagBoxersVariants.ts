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

console.log("=== zone_variants per content_type ===\n");
const reqs = out.debug.storage_requirements;
const zv = out.debug.zone_variants;  // CalculatedZone[][] — outer index = requirement index
for (let i = 0; i < reqs.length; i++) {
  const ct = reqs[i].content_type;
  if (ct !== "boxers") continue;
  console.log(`${ct}:`);
  for (const v of zv[i]) {
    console.log(`  option=${v.option_id}  zone=${v.zone_w_cm}×${v.zone_d_cm}×${v.zone_h_cm}  cap=${v.capacity}  cols=${v.calculated_cols ?? "-"} rows=${v.calculated_rows ?? "-"} split=${v.split_used ?? false}`);
  }
}

console.log("\n=== fit_result.placement_attempts для boxers ===");
const attempts = out.debug.fit_result.placement_attempts ?? [];
for (const a of attempts) {
  if (a.content_type !== "boxers") continue;
  console.log(`  zone=${a.zone_id}  placed=${a.placed}  rect=${a.selected_rect ? `${a.selected_rect.w_cm}×${a.selected_rect.d_cm}` : "-"}`);
  if (a.rejected_rectangles?.length) {
    console.log(`  rejected: ${a.rejected_rectangles.length} rects`);
  }
}

console.log("\n=== итог: выбранная boxers зона ===");
const placed = out.scheme_payload.assigned_zones.find((z: any) => z.content_type === "boxers");
console.log(`  option=${placed.option_id}  zone=${placed.zone_w_cm}×${placed.zone_d_cm}  assigned=${placed.assigned_w_cm}×${placed.assigned_d_cm}`);
