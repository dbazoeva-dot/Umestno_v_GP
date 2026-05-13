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
    name: "R1  80×45×15  mixed  panties M + tshirts S + socks_regular L",
    input: { drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "mixed", items: [{ content_type: "panties", volume_level: "medium" }, { content_type: "tshirts", volume_level: "small" }, { content_type: "socks_regular", volume_level: "large" }], priority: "convenient", color_preference: "not_important" },
  },
  {
    name: "R2  120×50×20  underwear  socks_regular L + panties L + bras M + tights M",
    input: { drawer_width_cm: 120, drawer_depth_cm: 50, drawer_height_cm: 20, storage_category: "underwear", items: [{ content_type: "socks_regular", volume_level: "large" }, { content_type: "panties", volume_level: "large" }, { content_type: "bras", volume_level: "medium" }, { content_type: "tights", volume_level: "medium" }], priority: "convenient", color_preference: "not_important" },
  },
  {
    name: "R3  45×80×12  underwear  socks_regular M + tights S",
    input: { drawer_width_cm: 45, drawer_depth_cm: 80, drawer_height_cm: 12, storage_category: "underwear", items: [{ content_type: "socks_regular", volume_level: "medium" }, { content_type: "tights", volume_level: "small" }], priority: "convenient", color_preference: "not_important" },
  },
  {
    name: "R4  90×45×15  mixed  tshirts M + belts S + scarves S",
    input: { drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "mixed", items: [{ content_type: "tshirts", volume_level: "medium" }, { content_type: "belts", volume_level: "small" }, { content_type: "scarves", volume_level: "small" }], priority: "convenient", color_preference: "not_important" },
  },
  {
    name: "R5  80×40×10  underwear  bras M + socks_regular M",
    input: { drawer_width_cm: 80, drawer_depth_cm: 40, drawer_height_cm: 10, storage_category: "underwear", items: [{ content_type: "bras", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "medium" }], priority: "convenient", color_preference: "not_important" },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(v, n) { return String(v ?? "—").padEnd(n); }
function rpad(v, n) { return String(v ?? "—").padStart(n); }

function gridLabel(z) {
  if (z.calculated_cols != null && z.calculated_rows != null)
    return `${z.calculated_cols}×${z.calculated_rows}`;
  if (z.lanes_needed != null) return `lanes=${z.lanes_needed}`;
  return "—";
}

// ─── Run ─────────────────────────────────────────────────────────────────────

for (const scenario of scenarios) {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`▶ ${scenario.name}`);
  console.log("═".repeat(80));

  const output = runUmestnoEngine(scenario.input, { ...defaultLibraries, skuCatalog: catalog });

  if (!output.result) {
    console.log("❌ fit failed — движок вернул null");
    continue;
  }

  const calcZones  = output.scheme_payload?.selected_calculated_zones ?? [];
  const placedZones = output.scheme_payload?.assigned_zones ?? [];
  const products   = output.result.products ?? [];
  const skuFit     = output.result.sku_fit;
  const matched    = products.filter(p => p.match_status === "exact").length;

  console.log(`\nsku_fit_status: ${skuFit?.sku_fit_status ?? "—"}   зон: ${products.length}   совпадений: ${matched}/${products.length}`);

  // ── Zone table header
  console.log(`\n${"─".repeat(80)}`);
  console.log(
    pad("zone_id", 32) +
    pad("type", 7) +
    rpad("grid", 6) +
    rpad("cnt", 5) +
    "  " +
    pad("calc W×D×H", 16) +
    pad("assigned W×D×H", 16)
  );
  console.log("─".repeat(80));

  for (const z of calcZones) {
    const pl = placedZones.find(p => p.zone_id === z.zone_id);
    const calcDims  = `${z.zone_w_cm}×${z.zone_d_cm}×${z.zone_h_cm}`;
    const asgDims   = pl ? `${pl.assigned_w_cm}×${pl.assigned_d_cm}×${pl.assigned_h_cm}` : "—";
    console.log(
      pad(z.zone_id, 32) +
      pad(z.division_type, 7) +
      rpad(gridLabel(z), 6) +
      rpad(z.count, 5) +
      "  " +
      pad(calcDims, 16) +
      asgDims
    );
  }

  // ── SKU match per zone
  console.log(`\n${"─".repeat(80)}`);
  for (const zone of products) {
    const icon     = zone.match_status === "exact" ? "✓" : "✗";
    const zoneInfo = calcZones.find(z => z.zone_id === zone.zone_id);

    console.log(`\n  ${icon} ${zone.zone_id}  (${zone.content_type})  type=${zoneInfo?.division_type ?? "?"}  grid=${gridLabel(zoneInfo ?? {})}  count=${zoneInfo?.count ?? "?"}`);

    if (zone.candidates.length > 0) {
      zone.candidates.slice(0, 3).forEach(c => {
        const price = c.price_rub != null ? `${c.price_rub}₽` : "—";
        const cap   = c.capacity_units != null ? `cap=${c.capacity_units}` : "cap=∞";
        console.log(`      ${pad(c.sku_id, 14)} ${rpad(c.width_cm, 5)}×${c.depth_cm}×${c.height_cm}  ${pad(cap, 10)} ${pad(c.rigidity, 12)} ${pad(c.color_group, 14)} ${price}`);
        console.log(`        ${c.product_title.slice(0, 70)}`);
      });
      if (zone.candidates.length > 3)
        console.log(`      … ещё ${zone.candidates.length - 3} кандидата(ов)`);
    } else {
      const dt       = zoneInfo?.division_type;
      const count    = zoneInfo?.count ?? 0;
      const zw = zoneInfo?.zone_w_cm ?? 0, zd = zoneInfo?.zone_d_cm ?? 0, zh = zoneInfo?.zone_h_cm ?? 0;
      const byType   = catalog.filter(s => s.division_type === dt);
      const byCap    = byType.filter(s => s.capacity_units == null || s.capacity_units >= count);
      const byDims   = byCap.filter(s => s.width_cm <= zw && s.depth_cm <= zd && s.height_cm <= zh);

      console.log(`      нет кандидатов`);
      console.log(`        по типу: ${byType.length}  → cap≥${count}: ${byCap.length}  → dims≤${zw}×${zd}×${zh}: ${byDims.length}`);

      // Show closest misses by dimension
      if (byDims.length === 0 && byCap.length > 0) {
        const closest = byCap
          .map(s => ({ s, miss: Math.max(s.width_cm - zw, 0) + Math.max(s.depth_cm - zd, 0) + Math.max(s.height_cm - zh, 0) }))
          .sort((a, b) => a.miss - b.miss)
          .slice(0, 3);
        console.log(`        ближайшие по размерам:`);
        for (const { s, miss } of closest) {
          const fails = [];
          if (s.width_cm  > zw) fails.push(`W+${(s.width_cm  - zw).toFixed(1)}`);
          if (s.depth_cm  > zd) fails.push(`D+${(s.depth_cm  - zd).toFixed(1)}`);
          if (s.height_cm > zh) fails.push(`H+${(s.height_cm - zh).toFixed(1)}`);
          console.log(`          ${pad(s.sku_id, 14)} ${s.width_cm}×${s.depth_cm}×${s.height_cm}  cap=${s.capacity_units ?? "∞"}  ↯ ${fails.join(", ")}`);
        }
      }
    }
  }
}
