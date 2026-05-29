// Прогоняет matchSkus напрямую на boxers-зоне с одним SKU UM-SKU-031 в каталоге,
// чтобы найти, какой именно шаг матчера убирает SKU.

import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import { matchSkus } from "../sku/matchSkus.js";
import type { SchemePayload, SkuCatalogRow } from "../types.js";

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

const placed = out.scheme_payload.assigned_zones;
const boxersZone = placed.find((z: any) => z.content_type === "boxers");

const onlyOneSku = skuCatalog.filter((s) => s.sku_id === "UM-SKU-031");
console.log("Каталог-подмножество:", onlyOneSku.length, "штук");
console.log("zone.items_per_lane:", boxersZone.items_per_lane);
console.log("zone.lanes_needed:", boxersZone.lanes_needed);
console.log("zone.split_used:", boxersZone.split_used);
console.log("zone.assigned:", boxersZone.assigned_w_cm, "x", boxersZone.assigned_d_cm, "x", boxersZone.assigned_h_cm);
console.log("zone.unit:", boxersZone.unit_w_cm, "x", boxersZone.unit_d_cm, "x", boxersZone.unit_h_cm);
console.log("zone.count:", boxersZone.count, "preferred_rigidity:", boxersZone.preferred_rigidity);

const payload: SchemePayload = {
  ...out.scheme_payload,
  assigned_zones: [boxersZone],
};

const m = matchSkus({ schemePayload: payload, skuCatalog: onlyOneSku, colorPreference: "neutral_light" })[0];
console.log("\nmatchSkus result with ONLY UM-SKU-031:");
console.log("  status:", m.match_status, "kind:", m.match_kind);
console.log("  units_needed:", m.units_needed, "packs_needed:", m.packs_needed);
console.log("  lane_footprint:", m.lane_footprint_cm);
console.log("  candidates count:", m.candidates.length);
if (m.candidates.length) {
  console.log("  top:", m.candidates[0].sku_id);
}
if (m.no_match_log) {
  console.log("  no_match_log:", m.no_match_log);
}
