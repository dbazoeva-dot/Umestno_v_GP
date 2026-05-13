// Dev-only: detailed zone vs SKU size analysis
// Usage: node engine/tools/runSkuSizeAnalysis.mjs

import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../../dist/engine/index.js";
import { defaultLibraries } from "../../dist/engine/libraries/defaultLibraries.js";

const raw = JSON.parse(readFileSync("/tmp/sku_catalog_raw.json", "utf8"));

const catalog = raw
  .filter(r => ["cells", "slots", "open"].includes(r.division_type))
  .map(r => ({
    sku_id: r.sku_id ?? "",
    division_type: r.division_type,
    rigidity: r.rigidity ?? "",
    width_cm: parseFloat(r.width_cm ?? "0"),
    depth_cm: parseFloat(r.depth_cm ?? "0"),
    height_cm: parseFloat(r.height_cm ?? "0"),
    capacity_units: r.capacity_units != null ? parseInt(r.capacity_units) : null,
    color_group: r.color_group ?? undefined,
    availability_status: r.availability_status === "unavailable" ? "unavailable" : "available",
    product_title: r.product_title ?? "",
    storage_use_case: r.storage_use_case ?? undefined,
  }));

const input = {
  drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15,
  storage_category: "underwear",
  item_1_content_type: "socks_regular", item_1_volume_level: "medium",
  item_2_content_type: "bras",         item_2_volume_level: "medium",
  item_3_content_type: "panties",      item_3_volume_level: "medium",
  priority: "convenient", color_preference: "not_important",
};

const output = runUmestnoEngine(input, { ...defaultLibraries, skuCatalog: catalog });

const zones   = output.scheme_payload?.selected_calculated_zones ?? [];
const placed  = output.result?.scheme?.assigned_zones ?? [];
const products = output.result?.products ?? [];

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("ASSIGNED ZONES — что движок выдал");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("zone_id                        type    count  zone_w  zone_d  zone_h  placed_w placed_d placed_h");
console.log("─".repeat(100));
for (const z of placed) {
  const line = [
    z.zone_id.padEnd(30),
    z.division_type.padEnd(7),
    String(z.count).padStart(5),
    String(z.zone_w_cm).padStart(7),
    String(z.zone_d_cm).padStart(7),
    String(z.zone_h_cm).padStart(7),
    String(z.assigned_w_cm).padStart(8),
    String(z.assigned_d_cm).padStart(8),
    String(z.assigned_h_cm).padStart(8),
  ].join(" ");
  console.log(line);
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("SKU FIT — проверка каждого SKU по каждой зоне");
console.log("═══════════════════════════════════════════════════════════════");

for (const zone of zones) {
  const placed_zone = placed.find(p => p.zone_id === zone.zone_id);
  const zw = zone.zone_w_cm, zd = zone.zone_d_cm, zh = zone.zone_h_cm;

  console.log(`\n▶ ${zone.zone_id}  (${zone.content_type})`);
  console.log(`  Зона:   ${zw} × ${zd} × ${zh} см,  нужно ≥${zone.count} ед.,  тип=${zone.division_type}`);
  if (placed_zone) {
    console.log(`  Placed: ${placed_zone.assigned_w_cm} × ${placed_zone.assigned_d_cm} × ${placed_zone.assigned_h_cm} см`);
  }

  const byType = catalog.filter(s => s.division_type === zone.division_type);
  console.log(`\n  SKU с типом ${zone.division_type}: ${byType.length}`);
  console.log(`  ${"sku_id".padEnd(12)} ${"w".padStart(5)} ${"d".padStart(5)} ${"h".padStart(5)} ${"cap".padStart(5)}  W≤${zw}? D≤${zd}? H≤${zh}? cap≥${zone.count}?  →`);
  console.log("  " + "─".repeat(80));

  for (const s of byType) {
    const okW   = s.width_cm  <= zw;
    const okD   = s.depth_cm  <= zd;
    const okH   = s.height_cm <= zh;
    const okCap = s.capacity_units == null ? true : s.capacity_units >= zone.count;
    const pass  = okW && okD && okH && okCap;

    const failReasons = [];
    if (!okW)   failReasons.push(`W ${s.width_cm}>${zw}`);
    if (!okD)   failReasons.push(`D ${s.depth_cm}>${zd}`);
    if (!okH)   failReasons.push(`H ${s.height_cm}>${zh}`);
    if (!okCap) failReasons.push(`cap ${s.capacity_units}<${zone.count}`);

    const icon = pass ? "✓" : "✗";
    const verdict = pass ? "MATCH" : failReasons.join(", ");
    console.log(`  ${icon} ${s.sku_id.padEnd(12)} ${String(s.width_cm).padStart(5)} ${String(s.depth_cm).padStart(5)} ${String(s.height_cm).padStart(5)} ${String(s.capacity_units ?? "∞").padStart(5)}  ${verdict}`);
  }
}
