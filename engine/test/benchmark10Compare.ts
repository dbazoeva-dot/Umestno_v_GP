// A/B сравнение column-first OFF vs ON по 10 эталонным сценариям.
// Для каждого: ASCII бок-о-бок, метрики резерва, used_depth.

import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import { featureFlags } from "../fit/generatePlacementCandidates.js";
import type { SkuCatalogRow } from "../types.js";

const skuCatalog: SkuCatalogRow[] = JSON.parse(readFileSync(process.env.CATALOG ?? "/tmp/catalog.json", "utf8"));
defaultLibraries.skuCatalog = skuCatalog;

interface Scenario { id: string; name: string; input: Parameters<typeof runUmestnoEngine>[0] }

const scenarios: Scenario[] = [
  { id: "S1",  name: "60×40×10  socks medium",
    input: { drawer_width_cm: 60, drawer_depth_cm: 40, drawer_height_cm: 10, storage_category: "underwear",
             items: [{ content_type: "socks_regular", volume_level: "medium" }], priority: "convenient" } },
  { id: "S2",  name: "80×45×12  panties + bras medium",
    input: { drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 12, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "medium" }, { content_type: "bras", volume_level: "medium" }], priority: "convenient" } },
  { id: "S3",  name: "50×35×15  jewelry_small + jewelry_large medium",
    input: { drawer_width_cm: 50, drawer_depth_cm: 35, drawer_height_cm: 15, storage_category: "accessories",
             items: [{ content_type: "jewelry_small", volume_level: "medium" }, { content_type: "jewelry_large", volume_level: "medium" }], priority: "convenient" } },
  { id: "S4",  name: "90×50×15  panties + bras + socks medium",
    input: { drawer_width_cm: 90, drawer_depth_cm: 50, drawer_height_cm: 15, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "medium" }, { content_type: "bras", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "medium" }], priority: "convenient" } },
  { id: "S5",  name: "100×50×15 4-item underwear medium (РЕФЕРЕНС)",
    input: { drawer_width_cm: 100, drawer_depth_cm: 50, drawer_height_cm: 15, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "medium" }, { content_type: "bras", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "medium" }, { content_type: "boxers", volume_level: "medium" }], priority: "convenient" } },
  { id: "S6",  name: "110×55×15 4-item underwear LARGE",
    input: { drawer_width_cm: 110, drawer_depth_cm: 55, drawer_height_cm: 15, storage_category: "underwear",
             items: [{ content_type: "panties", volume_level: "large" }, { content_type: "bras", volume_level: "large" }, { content_type: "socks_regular", volume_level: "large" }, { content_type: "boxers", volume_level: "large" }], priority: "convenient" } },
  { id: "S7",  name: "120×45×20 socks+bras+panties LARGE + tights medium",
    input: { drawer_width_cm: 120, drawer_depth_cm: 45, drawer_height_cm: 20, storage_category: "underwear",
             items: [{ content_type: "socks_regular", volume_level: "large" }, { content_type: "bras", volume_level: "large" }, { content_type: "panties", volume_level: "large" }, { content_type: "tights", volume_level: "medium" }], priority: "convenient" } },
  { id: "S8",  name: "90×50×20  tshirts + sweaters medium",
    input: { drawer_width_cm: 90, drawer_depth_cm: 50, drawer_height_cm: 20, storage_category: "soft_clothes",
             items: [{ content_type: "tshirts", volume_level: "medium" }, { content_type: "sweaters", volume_level: "medium" }], priority: "convenient" } },
  { id: "S9",  name: "100×55×20 jeans + tshirts + sweaters medium",
    input: { drawer_width_cm: 100, drawer_depth_cm: 55, drawer_height_cm: 20, storage_category: "soft_clothes",
             items: [{ content_type: "jeans", volume_level: "medium" }, { content_type: "tshirts", volume_level: "medium" }, { content_type: "sweaters", volume_level: "medium" }], priority: "convenient" } },
  { id: "S10", name: "60×35×12  belts + ties + jewelry_small medium",
    input: { drawer_width_cm: 60, drawer_depth_cm: 35, drawer_height_cm: 12, storage_category: "accessories",
             items: [{ content_type: "belts", volume_level: "medium" }, { content_type: "ties", volume_level: "medium" }, { content_type: "jewelry_small", volume_level: "medium" }], priority: "convenient" } },
];

// ── ASCII renderer (компактный, для side-by-side) ─────────
const CHAR_W = 3, CHAR_H = 5;
function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
function padL(s: string, n: number) { return s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s; }

function asciiLines(drawer: { w: number; d: number }, zones: any[]): string[] {
  const W = Math.max(8, Math.round(drawer.w / CHAR_W));
  const D = Math.max(3, Math.round(drawer.d / CHAR_H));
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
  const lines: string[] = [];
  lines.push("┌" + "─".repeat(W) + "┐");
  for (const r of g) lines.push("│" + r.join("") + "│");
  lines.push("└" + "─".repeat(W) + "┘");
  return lines;
}

function reserveSummary(out: any) {
  const rects = out.scheme_payload?.reserve_zones ?? out.debug?.fit_result?.free_rectangles ?? [];
  const totalArea = rects.reduce((s: number, r: any) => s + r.w_cm * r.d_cm, 0);
  let biggest = { w: 0, d: 0, area: 0 };
  for (const r of rects) {
    const a = r.w_cm * r.d_cm;
    if (a > biggest.area) biggest = { w: r.w_cm, d: r.d_cm, area: a };
  }
  return { count: rects.length, totalArea, biggest };
}

function rowJoin(left: string[], right: string[], sep = "    "): string {
  const maxLines = Math.max(left.length, right.length);
  const maxLeftW = left.reduce((m, l) => Math.max(m, l.length), 0);
  const lines: string[] = [];
  for (let i = 0; i < maxLines; i++) {
    const l = pad(left[i] ?? "", maxLeftW);
    const r = right[i] ?? "";
    lines.push(l + sep + r);
  }
  return lines.join("\n");
}

// ── run ─────────────────────────────────────────────────
for (const sc of scenarios) {
  featureFlags.columnFirst = false;
  const before = runUmestnoEngine(sc.input) as any;
  featureFlags.columnFirst = true;
  const after  = runUmestnoEngine(sc.input) as any;

  console.log("\n" + "═".repeat(96));
  console.log(sc.id + ": " + sc.name);
  console.log("═".repeat(96));

  if (!before.scheme_payload || !after.scheme_payload) {
    console.log("(один из вариантов не построил scheme; пропускаю)");
    continue;
  }

  const drawer = { w: sc.input.drawer_width_cm, d: sc.input.drawer_depth_cm };
  const linesL = ["BEFORE (greedy top-left)", "", ...asciiLines(drawer, before.scheme_payload.assigned_zones)];
  const linesR = ["AFTER  (+ column-first)",   "", ...asciiLines(drawer, after.scheme_payload.assigned_zones)];
  console.log(rowJoin(linesL, linesR, "   "));

  const rL = reserveSummary(before);
  const rR = reserveSummary(after);
  const usedDepthL = before.debug.fit_result.used_depth_cm;
  const usedDepthR = after.debug.fit_result.used_depth_cm;
  const matchesL = (before.debug.sku_matching_result ?? []).filter((m: any) => m.match_status === "exact").length;
  const matchesR = (after.debug.sku_matching_result ?? []).filter((m: any) => m.match_status === "exact").length;
  const zonesN = before.scheme_payload.assigned_zones.length;

  console.log();
  console.log(`                            ${pad("BEFORE", 22)} | AFTER`);
  console.log(`  reserve rects:            ${padL(String(rL.count), 22)} | ${rR.count}`);
  console.log(`  reserve total area, см²:  ${padL(rL.totalArea.toFixed(0), 22)} | ${rR.totalArea.toFixed(0)}`);
  console.log(`  biggest reserve rect:     ${padL(`${rL.biggest.w}×${rL.biggest.d} = ${rL.biggest.area.toFixed(0)}`, 22)} | ${rR.biggest.w}×${rR.biggest.d} = ${rR.biggest.area.toFixed(0)}`);
  console.log(`  used_depth, см:           ${padL(`${usedDepthL} / ${drawer.d}`, 22)} | ${usedDepthR} / ${drawer.d}`);
  console.log(`  matches:                  ${padL(`${matchesL}/${zonesN}`, 22)} | ${matchesR}/${zonesN}`);
}
