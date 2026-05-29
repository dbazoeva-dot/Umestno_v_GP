// Прогон 5 сценариев через движок + matchSkus.
// Для каждого: ASCII-схема ящика с зонами + таблица per-зона:
//   zone size  |  assigned  |  needed cap  |  picked SKU + dims + capacity
//   total assembled (если несколько org)  |  Δw / Δd / Δh / Δcap
//
// Цель: увидеть, насколько «зона 25, SKU 32» — широкая проблема.

import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import type { SkuCatalogRow } from "../types.js";

const skuCatalog: SkuCatalogRow[] = JSON.parse(readFileSync(process.env.CATALOG ?? "/tmp/catalog.json", "utf8"));
defaultLibraries.skuCatalog = skuCatalog;

interface Scenario { name: string; input: Parameters<typeof runUmestnoEngine>[0] }

const scenarios: Scenario[] = [
  { name: "S1: socks alone, big — 80×45×10 socks medium",
    input: { drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 10, storage_category: "underwear", items: [{ content_type: "socks_regular", volume_level: "medium" }], priority: "convenient" } },
  { name: "S2: socks alone, small — 50×30×10 socks small",
    input: { drawer_width_cm: 50, drawer_depth_cm: 30, drawer_height_cm: 10, storage_category: "underwear", items: [{ content_type: "socks_regular", volume_level: "small" }], priority: "convenient" } },
  { name: "S3: panties alone, mid — 60×40×10 panties medium",
    input: { drawer_width_cm: 60, drawer_depth_cm: 40, drawer_height_cm: 10, storage_category: "underwear", items: [{ content_type: "panties", volume_level: "medium" }], priority: "convenient" } },
  { name: "S4: underwear mixed — 90×50×15 socks+panties+bras medium",
    input: { drawer_width_cm: 90, drawer_depth_cm: 50, drawer_height_cm: 15, storage_category: "underwear", items: [{ content_type: "socks_regular", volume_level: "medium" }, { content_type: "panties", volume_level: "medium" }, { content_type: "bras", volume_level: "medium" }], priority: "convenient" } },
  { name: "S5: accessories — 60×40×10 belts+jewelry_small medium",
    input: { drawer_width_cm: 60, drawer_depth_cm: 40, drawer_height_cm: 10, storage_category: "accessories", items: [{ content_type: "belts", volume_level: "medium" }, { content_type: "jewelry_small", volume_level: "medium" }], priority: "convenient" } },
];

// ── ASCII rendering ─────────────────────────────────────────────
const CHAR_W_CM = 2;   // 1 char  = 2 см ширина
const CHAR_H_CM = 4;   // 1 строка = 4 см глубина

function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
function asciiDrawer(drawer: { w: number; d: number }, zones: Array<{ x: number; y: number; w: number; d: number; label: string }>): string {
  const W = Math.max(8, Math.round(drawer.w / CHAR_W_CM));
  const D = Math.max(3, Math.round(drawer.d / CHAR_H_CM));
  const grid: string[][] = Array.from({ length: D }, () => Array(W).fill(" "));
  for (const z of zones) {
    const x0 = Math.round(z.x / CHAR_W_CM);
    const y0 = Math.round(z.y / CHAR_H_CM);
    const x1 = Math.min(W - 1, Math.round((z.x + z.w) / CHAR_W_CM) - 1);
    const y1 = Math.min(D - 1, Math.round((z.y + z.d) / CHAR_H_CM) - 1);
    if (x1 < x0 || y1 < y0) continue;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x === x0 || x === x1) grid[y][x] = "│";
        else if (y === y0 || y === y1) grid[y][x] = "─";
        else grid[y][x] = "·";
      }
    }
    grid[y0][x0] = "┌"; grid[y0][x1] = "┐"; grid[y1][x0] = "└"; grid[y1][x1] = "┘";
    // label inside if room
    if (y1 > y0 + 0 && x1 - x0 >= 2) {
      const midY = Math.floor((y0 + y1) / 2);
      const labelStart = x0 + 1;
      const room = x1 - x0 - 1;
      const labelText = z.label.slice(0, room);
      for (let i = 0; i < labelText.length; i++) grid[midY][labelStart + i] = labelText[i];
    }
  }
  const top    = "┌" + "─".repeat(W) + "┐";
  const bottom = "└" + "─".repeat(W) + "┘";
  const body = grid.map((row) => "│" + row.join("") + "│").join("\n");
  return [top, body, bottom, `[ящик: ${drawer.w} × ${drawer.d} см, 1 символ = ${CHAR_W_CM}×${CHAR_H_CM} см]`].join("\n");
}

// ── run all scenarios ──────────────────────────────────────────
for (const sc of scenarios) {
  console.log("═".repeat(78));
  console.log(sc.name);
  console.log("═".repeat(78));

  const out = runUmestnoEngine(sc.input) as any;

  if (!out.scheme_payload) {
    console.log(`\n⚠ scheme не построен. fit_status: ${out.debug?.fit_result?.fit_status}`);
    if (out.debug?.fit_result?.failed_zones?.length) {
      console.log(`  failed zones: ${out.debug.fit_result.failed_zones.map((z: any) => z.content_type).join(", ")}`);
    }
    console.log();
    continue;
  }

  const placed = out.scheme_payload.assigned_zones;
  const matches = out.debug.sku_matching_result ?? [];

  // ── ASCII
  console.log();
  console.log(asciiDrawer(
    { w: sc.input.drawer_width_cm, d: sc.input.drawer_depth_cm },
    placed.map((z: any) => ({ x: z.x_cm, y: z.y_cm, w: z.assigned_w_cm, d: z.assigned_d_cm, label: z.content_type.slice(0, 12) })),
  ));
  console.log();

  // ── table
  const cols = ["zone", "div", "min zone WxDxH", "assigned WxDxH", "need cap", "kind", "picked SKU", "SKU WxDxH", "SKU cap", "packs", "total org W×D", "Δw", "Δd", "Δh", "Δcap"];
  const widths = [16, 6, 17, 17, 9, 10, 12, 14, 8, 6, 14, 5, 5, 5, 6];

  console.log(cols.map((c, i) => pad(c, widths[i])).join(" "));
  console.log(widths.map((w) => "-".repeat(w)).join(" "));

  for (let i = 0; i < placed.length; i++) {
    const z = placed[i];
    const m = matches[i];
    const top = m?.candidates?.[0];

    // composed total: if matcher returned "composed", units_needed > 1 orgs assembled in some direction
    let totalW = "—", totalD = "—";
    if (top) {
      if (m.match_status === "composed_from_slots") {
        // composed assembles units_needed orgs across width (preferred) or depth (rotated)
        totalW = `${(top.width_cm * m.units_needed).toFixed(1)}`;
        totalD = `${top.depth_cm.toFixed(1)}`;
      } else {
        // exact or alternative: 1 org occupies zone footprint
        totalW = top.width_cm.toFixed(1);
        totalD = top.depth_cm.toFixed(1);
      }
    }
    const dw = top ? (parseFloat(totalW) - z.assigned_w_cm).toFixed(1) : "—";
    const dd = top ? (parseFloat(totalD) - z.assigned_d_cm).toFixed(1) : "—";
    const dh = top ? (top.height_cm - z.assigned_h_cm).toFixed(1) : "—";
    const dcap = top ? `${(top.capacity_units * m.units_needed) - z.count}` : "—";

    const row = [
      pad(z.zone_id, widths[0]),
      pad(z.division_type, widths[1]),
      pad(`${z.zone_w_cm}×${z.zone_d_cm}×${z.zone_h_cm}`, widths[2]),
      pad(`${z.assigned_w_cm}×${z.assigned_d_cm}×${z.assigned_h_cm}`, widths[3]),
      pad(String(z.count), widths[4]),
      pad(m?.match_status === "no_match" ? "no_match" : `${m?.match_status}/${m?.match_kind ?? "-"}`, widths[5]),
      pad(top?.sku_id ?? "—", widths[6]),
      pad(top ? `${top.width_cm}×${top.depth_cm}×${top.height_cm}` : "—", widths[7]),
      pad(top ? String(top.capacity_units) : "—", widths[8]),
      pad(m?.packs_needed ? String(m.packs_needed) : "—", widths[9]),
      pad(totalW === "—" ? "—" : `${totalW}×${totalD}`, widths[10]),
      pad(dw, widths[11]),
      pad(dd, widths[12]),
      pad(dh, widths[13]),
      pad(dcap, widths[14]),
    ];
    console.log(row.join(" "));
  }
  console.log();
}

console.log("═".repeat(78));
console.log("ЛЕГЕНДА");
console.log("═".repeat(78));
console.log("Δw, Δd, Δh — насколько SKU больше/меньше assigned зоны по осям (см)");
console.log("            положительное = SKU торчит за зону (нужен footprint pad)");
console.log("            отрицательное = SKU меньше зоны (запас по геометрии)");
console.log("Δcap       — насколько кандидат покрывает нужное количество ячеек");
console.log("            отрицательное = недобор capacity");
