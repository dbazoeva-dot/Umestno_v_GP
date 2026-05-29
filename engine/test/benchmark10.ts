// 10 эталонных сценариев — baseline текущего движка.
// Запуск:
//   python3 engine/scripts/extractSkuCatalog.py E_SKU_catalog_v2905.xlsx > /tmp/catalog.json
//   npm run build
//   CATALOG=/tmp/catalog.json node dist/engine/test/benchmark10.js
//
// Ожидание (на текущем движке): все 10 должны давать fit_all.

import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import type { SkuCatalogRow } from "../types.js";

const skuCatalog: SkuCatalogRow[] = JSON.parse(readFileSync(process.env.CATALOG ?? "/tmp/catalog.json", "utf8"));
defaultLibraries.skuCatalog = skuCatalog;

interface Scenario { id: string; group: string; name: string; input: Parameters<typeof runUmestnoEngine>[0] }

const scenarios: Scenario[] = [
  // ── Группа A — простые (1–2 категории) ─────────────────────
  { id: "S1",  group: "A", name: "60×40×10  socks medium",
    input: { drawer_width_cm: 60, drawer_depth_cm: 40, drawer_height_cm: 10, storage_category: "underwear",
             items: [{ content_type: "socks_regular", volume_level: "medium" }], priority: "convenient" } },
  { id: "S2",  group: "A", name: "80×45×12  panties + bras medium",
    input: { drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 12, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "medium" }, { content_type: "bras", volume_level: "medium" }], priority: "convenient" } },
  { id: "S3",  group: "A", name: "50×35×15  jewelry_small + jewelry_large medium",
    input: { drawer_width_cm: 50, drawer_depth_cm: 35, drawer_height_cm: 15, storage_category: "accessories",
             items: [{ content_type: "jewelry_small", volume_level: "medium" }, { content_type: "jewelry_large", volume_level: "medium" }], priority: "convenient" } },

  // ── Группа B — основа (3–4 категории underwear) ────────────
  { id: "S4",  group: "B", name: "90×50×15  panties + bras + socks medium",
    input: { drawer_width_cm: 90, drawer_depth_cm: 50, drawer_height_cm: 15, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "medium" }, { content_type: "bras", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "medium" }], priority: "convenient" } },
  { id: "S5",  group: "B", name: "100×50×15 panties + bras + socks + boxers medium  (РЕФЕРЕНС)",
    input: { drawer_width_cm: 100, drawer_depth_cm: 50, drawer_height_cm: 15, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "medium" }, { content_type: "bras", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "medium" }, { content_type: "boxers", volume_level: "medium" }], priority: "convenient" } },
  { id: "S6",  group: "B", name: "110×55×15 panties + bras + socks + boxers LARGE",
    input: { drawer_width_cm: 110, drawer_depth_cm: 55, drawer_height_cm: 15, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "large" }, { content_type: "bras", volume_level: "large" }, { content_type: "socks_regular", volume_level: "large" }, { content_type: "boxers", volume_level: "large" }], priority: "convenient" } },
  { id: "S7",  group: "B", name: "120×45×20 socks + bras + panties large + tights medium",
    input: { drawer_width_cm: 120, drawer_depth_cm: 45, drawer_height_cm: 20, storage_category: "underwear",
             items: [{ content_type: "socks_regular", volume_level: "large" }, { content_type: "bras", volume_level: "large" }, { content_type: "panties", volume_level: "large" }, { content_type: "tights", volume_level: "medium" }], priority: "convenient" } },

  // ── Группа C — soft_clothes (большие вещи) ────────────────
  { id: "S8",  group: "C", name: "90×50×20  tshirts + sweaters medium",
    input: { drawer_width_cm: 90, drawer_depth_cm: 50, drawer_height_cm: 20, storage_category: "soft_clothes",
             items: [{ content_type: "tshirts", volume_level: "medium" }, { content_type: "sweaters", volume_level: "medium" }], priority: "convenient" } },
  { id: "S9",  group: "C", name: "100×55×20 jeans + tshirts + sweaters medium",
    input: { drawer_width_cm: 100, drawer_depth_cm: 55, drawer_height_cm: 20, storage_category: "soft_clothes",
             items: [{ content_type: "jeans", volume_level: "medium" }, { content_type: "tshirts", volume_level: "medium" }, { content_type: "sweaters", volume_level: "medium" }], priority: "convenient" } },

  // ── Группа D — accessories ────────────────────────────────
  { id: "S10", group: "D", name: "60×35×12  belts + ties + jewelry_small medium",
    input: { drawer_width_cm: 60, drawer_depth_cm: 35, drawer_height_cm: 12, storage_category: "accessories",
             items: [{ content_type: "belts", volume_level: "medium" }, { content_type: "ties", volume_level: "medium" }, { content_type: "jewelry_small", volume_level: "medium" }], priority: "convenient" } },
];

// ── ASCII ───────────────────────────────────────────────────
const CHAR_W = 2.5, CHAR_H = 4;
function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
function padL(s: string, n: number) { return s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s; }

function asciiDrawer(drawer: { w: number; d: number }, zones: any[]) {
  const W = Math.round(drawer.w / CHAR_W);
  const D = Math.round(drawer.d / CHAR_H);
  const g: string[][] = Array.from({ length: D }, () => Array(W).fill(" "));
  for (const z of zones) {
    const x0 = Math.round(z.x_cm / CHAR_W);
    const y0 = Math.round(z.y_cm / CHAR_H);
    const x1 = Math.min(W - 1, Math.max(x0 + 1, Math.round((z.x_cm + z.assigned_w_cm) / CHAR_W) - 1));
    const y1 = Math.min(D - 1, Math.max(y0 + 1, Math.round((z.y_cm + z.assigned_d_cm) / CHAR_H) - 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (y === y0 || y === y1) g[y][x] = "─";
      else if (x === x0 || x === x1) g[y][x] = "│";
    }
    g[y0][x0] = "┌"; g[y0][x1] = "┐"; g[y1][x0] = "└"; g[y1][x1] = "┘";
    if (y1 - y0 >= 1 && x1 - x0 >= 3) {
      const midY = Math.floor((y0 + y1) / 2);
      const room = x1 - x0 - 1;
      const text = z.content_type.slice(0, room);
      for (let i = 0; i < text.length; i++) g[midY][x0 + 1 + i] = text[i];
    }
  }
  const top = "┌" + "─".repeat(W) + "┐";
  const bot = "└" + "─".repeat(W) + "┘";
  return [top, ...g.map((r) => "│" + r.join("") + "│"), bot].join("\n");
}

// ── prog ────────────────────────────────────────────────────
let fitAllCount = 0, partialCount = 0, noSchemeCount = 0;
const failed: string[] = [];

for (const sc of scenarios) {
  console.log("═".repeat(96));
  console.log(`${sc.id} (group ${sc.group}): ${sc.name}`);
  console.log("═".repeat(96));

  const out = runUmestnoEngine(sc.input) as any;
  const status = out.scheme_payload ? out.debug.fit_result.fit_status : "no_scheme";

  if (status === "fit_all") {
    fitAllCount++;
    const placed = out.scheme_payload.assigned_zones;
    const matches = out.debug.sku_matching_result ?? [];

    console.log(`fit_status: ✓ fit_all\n`);
    console.log(asciiDrawer({ w: sc.input.drawer_width_cm, d: sc.input.drawer_depth_cm }, placed));
    console.log();

    const cols = ["зона", "need", "assigned", "SKU", "SKU cap", "размеры SKU", "статус"];
    const widths = [16, 5, 14, 12, 8, 14, 22];
    console.log(cols.map((c, i) => pad(c, widths[i])).join(" │ "));
    console.log(widths.map((w) => "─".repeat(w)).join("─┼─"));
    for (let i = 0; i < placed.length; i++) {
      const z = placed[i], m = matches[i], top = m?.candidates?.[0];
      console.log([
        pad(z.content_type, widths[0]),
        padL(String(z.count), widths[1]),
        pad(`${z.assigned_w_cm}×${z.assigned_d_cm}×${z.assigned_h_cm}`, widths[2]),
        pad(top?.sku_id ?? "—", widths[3]),
        padL(top ? String(top.capacity_units) : "—", widths[4]),
        pad(top ? `${top.width_cm}×${top.depth_cm}×${top.height_cm}` : "—", widths[5]),
        pad(m?.match_status === "exact" ? "✓ exact"
            : m?.match_status === "composed_from_slots" ? "★ composed"
            : m?.match_status === "alternative_division" ? "▲ alt-div"
            : "✗ no_match", widths[6]),
      ].join(" │ "));
    }
  } else if (status === "fit_partial") {
    partialCount++;
    failed.push(`${sc.id}: fit_partial — ` + (out.debug.fit_result.failed_zones?.map((z: any) => z.content_type).join(", ") ?? "?"));
    console.log(`fit_status: ⚠ fit_partial`);
    console.log(`  failed: ${(out.debug.fit_result.failed_zones ?? []).map((z: any) => z.content_type).join(", ") || "—"}`);
    console.log(`  failed_dimension: ${out.debug.fit_result.failed_dimension ?? "—"}`);
  } else {
    noSchemeCount++;
    failed.push(`${sc.id}: no_scheme`);
    console.log(`fit_status: ✗ no_scheme`);
  }
  console.log();
}

console.log("═".repeat(96));
console.log(`ИТОГ:  fit_all: ${fitAllCount} / 10   fit_partial: ${partialCount}   no_scheme: ${noSchemeCount}`);
console.log("═".repeat(96));
if (failed.length) {
  console.log("\nне прошли:");
  for (const f of failed) console.log("  -", f);
}
