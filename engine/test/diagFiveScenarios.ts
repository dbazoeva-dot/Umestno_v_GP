// Прогон 5 СЛОЖНЫХ сценариев (3–4 предмета) через движок + matchSkus,
// для которых движок успешно строит схему (fit_all).
//
// Формат вывода — строго по ТЗ:
//   ASCII-схема ящика (с зонами)
//   таблица: зона | needed cap | assigned зона | подобранный SKU | capacity SKU |
//            размеры SKU | суммарные размеры (если их несколько) |
//            Δ capacity | Δw | Δd | Δh

import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import type { SkuCatalogRow } from "../types.js";

const skuCatalog: SkuCatalogRow[] = JSON.parse(readFileSync(process.env.CATALOG ?? "/tmp/catalog.json", "utf8"));
defaultLibraries.skuCatalog = skuCatalog;

interface Scenario { name: string; input: Parameters<typeof runUmestnoEngine>[0] }

const scenarios: Scenario[] = [
  { name: "S1: underwear 100×50×15 — panties+bras+socks (large)",
    input: { drawer_width_cm: 100, drawer_depth_cm: 50, drawer_height_cm: 15, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "large" }, { content_type: "bras", volume_level: "large" }, { content_type: "socks_regular", volume_level: "large" }],
             priority: "convenient" } },
  { name: "S2: underwear 90×50×15 — panties+bras+socks (medium)",
    input: { drawer_width_cm: 90, drawer_depth_cm: 50, drawer_height_cm: 15, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "medium" }, { content_type: "bras", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "medium" }],
             priority: "convenient" } },
  { name: "S3: underwear 100×50×15 — panties+bras+socks+boxers (medium) — 4 items",
    input: { drawer_width_cm: 100, drawer_depth_cm: 50, drawer_height_cm: 15, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "medium" }, { content_type: "bras", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "medium" }, { content_type: "boxers", volume_level: "medium" }],
             priority: "convenient" } },
  { name: "S4: underwear 110×55×15 — panties+bras+socks+boxers (large) — 4 items",
    input: { drawer_width_cm: 110, drawer_depth_cm: 55, drawer_height_cm: 15, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "large" }, { content_type: "bras", volume_level: "large" }, { content_type: "socks_regular", volume_level: "large" }, { content_type: "boxers", volume_level: "large" }],
             priority: "convenient" } },
  { name: "S5: underwear 120×50×15 — panties+bras+socks (large) + jewelry_small (medium) — 4 items",
    input: { drawer_width_cm: 120, drawer_depth_cm: 50, drawer_height_cm: 15, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "large" }, { content_type: "bras", volume_level: "large" }, { content_type: "socks_regular", volume_level: "large" }, { content_type: "jewelry_small", volume_level: "medium" }],
             priority: "convenient" } },
];

// ── ASCII рендер: чистый, без мусора внутри ─────────────────────
const CHAR_W_CM = 2.5;
const CHAR_H_CM = 4;
function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
function padL(s: string, n: number) { return s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s; }

function asciiDrawer(drawer: { w: number; d: number }, zones: Array<{ x: number; y: number; w: number; d: number; label: string }>): string {
  const W = Math.max(8, Math.round(drawer.w / CHAR_W_CM));
  const D = Math.max(3, Math.round(drawer.d / CHAR_H_CM));
  const grid: string[][] = Array.from({ length: D }, () => Array(W).fill(" "));
  for (const z of zones) {
    const x0 = Math.round(z.x / CHAR_W_CM);
    const y0 = Math.round(z.y / CHAR_H_CM);
    const x1 = Math.min(W - 1, Math.max(x0 + 1, Math.round((z.x + z.w) / CHAR_W_CM) - 1));
    const y1 = Math.min(D - 1, Math.max(y0 + 1, Math.round((z.y + z.d) / CHAR_H_CM) - 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (y === y0 || y === y1) grid[y][x] = "─";
      else if (x === x0 || x === x1) grid[y][x] = "│";
    }
    grid[y0][x0] = "┌"; grid[y0][x1] = "┐"; grid[y1][x0] = "└"; grid[y1][x1] = "┘";
    if (y1 - y0 >= 1 && x1 - x0 >= 3) {
      const midY = Math.floor((y0 + y1) / 2);
      const labelStart = x0 + 1;
      const room = x1 - x0 - 1;
      const text = z.label.slice(0, room);
      for (let i = 0; i < text.length; i++) grid[midY][labelStart + i] = text[i];
    }
  }
  const top    = "┌" + "─".repeat(W) + "┐";
  const bot    = "└" + "─".repeat(W) + "┘";
  const body   = grid.map((row) => "│" + row.join("") + "│").join("\n");
  return [top, body, bot, `[ящик ${drawer.w} × ${drawer.d} см, 1 символ ≈ ${CHAR_W_CM}×${CHAR_H_CM} см]`].join("\n");
}

// ── суммарные габариты сборки (если несколько органайзеров) ─────
function assembly(top: SkuCatalogRow, units: number, status: string, zone: any): { w: number; d: number; h: number } {
  if (units <= 1) return { w: top.width_cm, d: top.depth_cm, h: top.height_cm };
  if (status === "composed_from_slots") {
    // preferred-ориентация: units штук бок-о-бок по width
    return { w: top.width_cm * units, d: top.depth_cm, h: top.height_cm };
  }
  // split slot multiunit: N штук бок-о-бок по width + зазоры между lane
  const gap = zone.slot_lane_gap_cm ?? 0;
  return { w: top.width_cm * units + gap * (units - 1), d: top.depth_cm, h: top.height_cm };
}

// ── run ─────────────────────────────────────────────────────────
let scenariosShown = 0;
const skipped: string[] = [];

for (const sc of scenarios) {
  const out = runUmestnoEngine(sc.input) as any;
  if (!out.scheme_payload || out.debug.fit_result.fit_status !== "fit_all") {
    skipped.push(`${sc.name}  →  ${out.debug?.fit_result?.fit_status ?? "no scheme"}`);
    continue;
  }
  scenariosShown++;

  console.log("═".repeat(96));
  console.log(sc.name);
  console.log("═".repeat(96));

  const placed = out.scheme_payload.assigned_zones;
  const matches = out.debug.sku_matching_result ?? [];

  console.log();
  console.log(asciiDrawer(
    { w: sc.input.drawer_width_cm, d: sc.input.drawer_depth_cm },
    placed.map((z: any) => ({ x: z.x_cm, y: z.y_cm, w: z.assigned_w_cm, d: z.assigned_d_cm, label: z.content_type })),
  ));
  console.log();

  // Таблица — строго по ТЗ
  const headers = ["зона", "need cap", "assigned зона", "SKU", "SKU cap", "размеры SKU", "суммарные", "Δcap", "Δw", "Δd", "Δh"];
  const widths  = [16, 9, 14, 12, 8, 14, 16, 6, 6, 6, 6];
  const align: ("L" | "R")[] = ["L", "R", "L", "L", "R", "L", "L", "R", "R", "R", "R"];
  const printRow = (cells: string[]) => console.log(cells.map((c, i) => align[i] === "R" ? padL(c, widths[i]) : pad(c, widths[i])).join(" │ "));
  printRow(headers);
  console.log(widths.map((w) => "─".repeat(w)).join("─┼─"));

  for (let i = 0; i < placed.length; i++) {
    const z = placed[i];
    const m = matches[i];
    const top = m?.candidates?.[0];

    let summed = "—";
    let dCap = "—", dW = "—", dD = "—", dH = "—";
    if (top) {
      const asm = assembly(top, m.units_needed, m.match_status, z);
      const isMulti = m.units_needed > 1;
      summed = isMulti
        ? `${asm.w.toFixed(1)}×${asm.d.toFixed(1)}×${asm.h.toFixed(1)}`
        : "—";
      const refW = asm.w, refD = asm.d, refH = asm.h;
      dW = (refW - z.assigned_w_cm).toFixed(1);
      dD = (refD - z.assigned_d_cm).toFixed(1);
      dH = (refH - z.assigned_h_cm).toFixed(1);
      dCap = ((top.capacity_units * m.units_needed) - z.count).toString();
    }

    printRow([
      z.content_type,
      String(z.count),
      `${z.assigned_w_cm}×${z.assigned_d_cm}×${z.assigned_h_cm}`,
      top?.sku_id ?? "—",
      top ? String(top.capacity_units) : "—",
      top ? `${top.width_cm}×${top.depth_cm}×${top.height_cm}` : "—",
      summed,
      dCap, dW, dD, dH,
    ]);
  }
  console.log();
}

console.log("═".repeat(96));
console.log(`показано: ${scenariosShown} сценариев из ${scenarios.length}`);
if (skipped.length) {
  console.log("пропущено (engine не дал fit_all, не наша зона ответственности):");
  for (const s of skipped) console.log("  -", s);
}
console.log();
console.log("ЛЕГЕНДА");
console.log("─".repeat(96));
console.log("суммарные  — общая ширина/глубина/высота сборки, если органайзеров > 1; иначе «—»");
console.log("Δcap       — capacity SKU × units − needed; <0 = не хватает мест");
console.log("Δw, Δd, Δh — суммарные размеры сборки минус assigned зону; >0 = торчит за зону");
