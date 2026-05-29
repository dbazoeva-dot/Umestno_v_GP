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

const z = out.scheme_payload.assigned_zones.find((zz: any) => zz.content_type === "boxers");
console.log(`zone: w=${z.assigned_w_cm} d=${z.assigned_d_cm} h=${z.assigned_h_cm}`);
console.log(`unit: ${z.unit_w_cm}×${z.unit_d_cm}×${z.unit_h_cm}, gap=${z.item_gap}, needs_gap=${z.needs_item_gap}, count=${z.count}`);
console.log(`division=${z.division_type}, preferred_rigidity=${z.preferred_rigidity}\n`);

const itemGap = z.needs_item_gap ? (z.item_gap ?? 0) : 0;
const effW = z.unit_w_cm + itemGap, effD = z.unit_d_cm + itemGap;

const candidates = ["UM-SKU-031", "UM-SKU-022", "UM-SKU-010", "UM-SKU-017", "UM-SKU-023"];
for (const id of candidates) {
  const sku = skuCatalog.find((s) => s.sku_id === id);
  if (!sku) { console.log(`${id}: not in catalog`); continue; }
  const cw = sku.cell_width_cm ?? sku.width_cm, cd = sku.cell_depth_cm ?? sku.depth_cm;
  const f1 = sku.availability_status === "out_of_stock" ? "out_of_stock" : "ok";
  const f2 = sku.division_type !== z.division_type ? `wrong div ${sku.division_type}` : "ok";
  const f3 = (sku.capacity_units ?? 0) < z.count ? `cap ${sku.capacity_units}<${z.count}` : "ok";
  const f4 = Math.abs(cw - effW) > 3 ? `cellW |${cw}-${effW}|=${Math.abs(cw-effW).toFixed(1)}>3` : "ok";
  const f5 = Math.abs(cd - effD) > 1.5 ? `cellD |${cd}-${effD}|=${Math.abs(cd-effD).toFixed(1)}>1.5` : "ok";
  const f6 = (sku.height_cm < z.unit_h_cm - 3 || sku.height_cm > z.unit_h_cm + 5) ? `H ${sku.height_cm} not in [${z.unit_h_cm-3}, ${z.unit_h_cm+5}]` : "ok";
  const fpN = sku.width_cm <= z.assigned_w_cm && sku.depth_cm <= z.assigned_d_cm;
  const fpR = sku.can_rotate === "yes" && sku.depth_cm <= z.assigned_w_cm && sku.width_cm <= z.assigned_d_cm;
  const f7 = (fpN || fpR) ? "ok" : `FP ${sku.width_cm}×${sku.depth_cm} not in ${z.assigned_w_cm}×${z.assigned_d_cm}`;
  console.log(`${id} (${sku.width_cm}×${sku.depth_cm}×${sku.height_cm}, cell ${cw}×${cd}, cap ${sku.capacity_units}, rig ${sku.rigidity}):`);
  console.log(`  avail: ${f1}  div: ${f2}  cap: ${f3}  cellW: ${f4}  cellD: ${f5}  H: ${f6}  FP: ${f7}`);
}

console.log("\n=== ACTUAL MATCHER RESULT FOR BOXERS ===");
const m = out.debug.sku_matching_result.find((mm: any) => mm.content_type === "boxers");
console.log("status:", m.match_status, "candidates count:", m.candidates.length);
if (m.candidates.length) console.log("top:", m.candidates[0].sku_id);
