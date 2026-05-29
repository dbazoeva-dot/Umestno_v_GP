import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import { featureFlags } from "../fit/generatePlacementCandidates.js";
import type { SkuCatalogRow } from "../types.js";

const skuCatalog: SkuCatalogRow[] = JSON.parse(readFileSync(process.env.CATALOG ?? "/tmp/catalog.json", "utf8"));
defaultLibraries.skuCatalog = skuCatalog;

featureFlags.columnFirst = true;
const out = runUmestnoEngine({
  drawer_width_cm: 90, drawer_depth_cm: 50, drawer_height_cm: 15,
  storage_category: "underwear",
  items: [
    { content_type: "panties", volume_level: "medium" },
    { content_type: "bras", volume_level: "medium" },
    { content_type: "socks_regular", volume_level: "medium" },
  ],
  priority: "convenient",
}) as any;

console.log("ZONES (assigned):");
let zonesArea = 0;
for (const z of out.scheme_payload.assigned_zones) {
  const a = z.assigned_w_cm * z.assigned_d_cm;
  zonesArea += a;
  console.log(`  ${z.content_type.padEnd(16)} ${z.assigned_w_cm}×${z.assigned_d_cm} @ (${z.x_cm}, ${z.y_cm}) → ${a} см²`);
}
console.log(`  TOTAL зоны: ${zonesArea} см²`);
console.log(`  Drawer: 90×50 = 4500 см²`);
console.log(`  Свободно геометрически: ${4500 - zonesArea} см²`);

console.log("\nFREE RECTANGLES (как их видит engine):");
const rects = out.scheme_payload.reserve_zones;
let sumArea = 0;
for (const r of rects) {
  const a = r.w_cm * r.d_cm;
  sumArea += a;
  console.log(`  ${r.w_cm}×${r.d_cm} @ (${r.x_cm}, ${r.y_cm}) → ${a} см²`);
}
console.log(`  Сумма: ${sumArea} см²`);
console.log(`  (если > геометрически свободного → прямоугольники перекрываются)`);
