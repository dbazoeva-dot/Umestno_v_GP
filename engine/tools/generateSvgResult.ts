/**
 * CLI tool: generates a standalone SVG from engine output.
 * Used by the GitHub Actions visualize workflow.
 *
 * Usage:
 *   node dist/engine/tools/generateSvgResult.js \
 *     --w=80 --d=45 --h=15 \
 *     --cat=underwear --pri=convenient \
 *     --items=panties:medium,bras:small,socks_regular:large \
 *     --out=viz/result.svg
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runUmestnoEngine } from "../index.js";
import type { DrawerSize, PlacedZone, UserInput, VolumeLevel } from "../types.js";

// ─── parse CLI args ───────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const w   = parseFloat(arg("w")   ?? "0");
const d   = parseFloat(arg("d")   ?? "0");
const h   = parseFloat(arg("h")   ?? "0");
const cat = arg("cat") ?? "underwear";
const pri = arg("pri") ?? "convenient";
const rawItems = arg("items") ?? "";
const outPath  = arg("out")   ?? "viz/result.svg";

if (!w || !d || !h) {
  console.error("Usage: --w=<width> --d=<depth> --h=<height> --cat=<category> --pri=<priority> --items=<ct:vol,...> [--out=<path>]");
  process.exit(1);
}

const items: NonNullable<UserInput["items"]> = rawItems
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [ct, vl] = s.split(":");
    return { content_type: ct ?? s, volume_level: (vl ?? "medium") as VolumeLevel };
  });

if (!items.length) {
  console.error("--items must not be empty, e.g. --items=panties:medium,bras:small");
  process.exit(1);
}

// ─── run engine ───────────────────────────────────────────────────────────────

const input: UserInput = {
  drawer_width_cm: w, drawer_depth_cm: d, drawer_height_cm: h,
  storage_category: cat as UserInput["storage_category"],
  priority: pri as UserInput["priority"],
  items,
};

let engineOut: ReturnType<typeof runUmestnoEngine>;
try {
  engineOut = runUmestnoEngine(input);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Engine exception: ${msg}`);
  process.exit(1);
}

if (!engineOut.scheme_payload) {
  const dbg = engineOut.debug as Record<string, unknown> | undefined;
  const v   = dbg?.["validation_result"] as { errors?: string[] } | undefined;
  console.error(`Validation failed: ${(v?.errors ?? []).join("; ")}`);
  process.exit(1);
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

const ZONE_FILL: Record<string, string> = {
  cells: "#bfdbfe", slots: "#ddd6fe", open: "#bbf7d0", dividers: "#fed7aa",
};
const ZONE_STROKE: Record<string, string> = {
  cells: "#1d4ed8", slots: "#6d28d9", open: "#15803d", dividers: "#c2410c",
};

function fmt(n: number) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }
function esc(s: unknown) {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

type FreeRect = { x_cm: number; y_cm: number; w_cm: number; d_cm: number };

function buildSvg(drawer: DrawerSize, zones: PlacedZone[], reserve: FreeRect[], fitStatus: string, generatedAt: string): string {
  const scale = Math.min(9, Math.max(4, 560 / Math.max(drawer.w_cm, drawer.d_cm)));
  const pad = { l: 42, r: 18, t: 56, b: 90 };
  const iw = drawer.w_cm * scale;
  const ih = drawer.d_cm * scale;
  const W  = iw + pad.l + pad.r;
  const H  = ih + pad.t + pad.b;

  const FIT_COLOR: Record<string, string> = {
    fit_all: "#16a34a", fit_all_after_adjustment: "#15803d",
    fit_partial: "#d97706", fit_none: "#dc2626",
  };
  const fitColor = FIT_COLOR[fitStatus] ?? "#475467";

  const reserveSvg = reserve.map((r) => {
    const x = pad.l + r.x_cm * scale;
    const y = pad.t + (drawer.d_cm - r.y_cm - r.d_cm) * scale;
    const rw = r.w_cm * scale;
    const rh = r.d_cm * scale;
    if (rw < 1 || rh < 1) return "";
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}"
      fill="url(#hatch)" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>`;
  }).join("");

  const zonesSvg = zones.map((z, i) => {
    const x  = pad.l + z.x_cm * scale;
    const y  = pad.t + (drawer.d_cm - z.y_cm - z.assigned_d_cm) * scale;
    const zw = z.assigned_w_cm * scale;
    const zh = z.assigned_d_cm * scale;
    const fill   = ZONE_FILL[z.division_type]   ?? "#e2e8f0";
    const stroke = ZONE_STROKE[z.division_type] ?? "#475467";
    const warn   = Boolean(z.soft_height_warning);
    const fs = zw < 72 ? 9 : 11;
    return `<g>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${zw.toFixed(1)}" height="${zh.toFixed(1)}"
        fill="${fill}" stroke="${warn ? "#d97706" : stroke}" stroke-width="${warn ? 2.5 : 1.5}" rx="3"/>
      ${warn ? `<circle cx="${(x+zw-10).toFixed(1)}" cy="${(y+10).toFixed(1)}" r="7" fill="#f59e0b"/>
        <text x="${(x+zw-10).toFixed(1)}" y="${(y+14).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">!</text>` : ""}
      <text x="${(x+zw/2).toFixed(1)}" y="${(y+zh/2-5).toFixed(1)}"
        text-anchor="middle" font-size="${fs}" font-weight="700" fill="#1e293b">${esc(z.content_type)}</text>
      <text x="${(x+zw/2).toFixed(1)}" y="${(y+zh/2+9).toFixed(1)}"
        text-anchor="middle" font-size="9" fill="#475467">${fmt(z.assigned_w_cm)}×${fmt(z.assigned_d_cm)} · cap ${z.capacity}</text>
      <text x="${(x+4).toFixed(1)}" y="${(y+11).toFixed(1)}" font-size="8" fill="#64748b">${i+1}</text>
    </g>`;
  }).join("");

  // legend below diagram
  const legendItems = zones.map((z, i) => {
    const fill   = ZONE_FILL[z.division_type]   ?? "#e2e8f0";
    const stroke = ZONE_STROKE[z.division_type] ?? "#475467";
    const lx = pad.l + (i % 2) * (iw / 2);
    const ly = pad.t + ih + 28 + Math.floor(i / 2) * 16;
    const warn = z.soft_height_warning ? " ⚠" : "";
    return `<g>
      <rect x="${lx.toFixed(1)}" y="${(ly-9).toFixed(1)}" width="10" height="10" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
      <text x="${(lx+14).toFixed(1)}" y="${ly.toFixed(1)}" font-size="10" fill="#1e293b">${i+1} ${esc(z.content_type)} — ${z.division_type} · ${fmt(z.assigned_w_cm)}×${fmt(z.assigned_d_cm)}×${fmt(z.assigned_h_cm)} cm · cap ${z.capacity}${warn}</text>
    </g>`;
  }).join("");

  const titleItems = items.map((it) => `${it.content_type} ${it.volume_level}`).join("  +  ");

  return `<svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" xmlns="http://www.w3.org/2000/svg"
    style="font-family: Inter, system-ui, sans-serif; background: #f8fafc;">
  <defs>
    <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse">
      <path d="M-1 7L7-1M0 8L8 0" stroke="#94a3b8" stroke-width="1" opacity="0.6"/>
    </pattern>
  </defs>

  <!-- header -->
  <text x="${pad.l.toFixed(1)}" y="18" font-size="13" font-weight="700" fill="#1e293b">${esc(titleItems)}</text>
  <text x="${pad.l.toFixed(1)}" y="34" font-size="11" fill="#475467">ящик ${drawer.w_cm}×${drawer.d_cm}×${drawer.h_cm} cm · ${esc(cat)} · ${esc(pri)}</text>
  <text x="${(pad.l + iw).toFixed(1)}" y="18" font-size="12" font-weight="700" fill="${fitColor}" text-anchor="end">${esc(fitStatus)}</text>
  <text x="${(pad.l + iw).toFixed(1)}" y="34" font-size="10" fill="#94a3b8" text-anchor="end">${esc(generatedAt)}</text>

  <!-- axis labels -->
  <text x="${(pad.l + iw/2).toFixed(1)}" y="${(pad.t - 8).toFixed(1)}"
    text-anchor="middle" font-size="10" fill="#94a3b8">дальняя стенка</text>
  <text x="${(pad.l + iw/2).toFixed(1)}" y="${(pad.t + ih + 14).toFixed(1)}"
    text-anchor="middle" font-size="10" fill="#94a3b8">ближний край</text>
  <text x="${(pad.l + iw/2).toFixed(1)}" y="${(pad.t + ih + 24).toFixed(1)}"
    text-anchor="middle" font-size="10" fill="#64748b">ширина ${drawer.w_cm} cm →</text>
  <text x="8" y="${(pad.t + ih/2).toFixed(1)}"
    transform="rotate(-90 8 ${(pad.t + ih/2).toFixed(1)})"
    text-anchor="middle" font-size="10" fill="#64748b">глубина ${drawer.d_cm} cm</text>

  <!-- drawer -->
  <rect x="${pad.l}" y="${pad.t}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}"
    fill="#fff" stroke="#334155" stroke-width="2" rx="2"/>
  ${reserveSvg}
  ${zonesSvg}

  <!-- legend -->
  ${legendItems}
</svg>`;
}

// ─── write output ─────────────────────────────────────────────────────────────

const sp       = engineOut.scheme_payload;
const zones    = sp.assigned_zones as PlacedZone[];
const reserve  = sp.reserve_zones  as FreeRect[];
const drawer: DrawerSize = { w_cm: w, d_cm: d, h_cm: h };
const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

const svg = buildSvg(drawer, zones, reserve, sp.fit_status, generatedAt);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, svg, "utf8");
console.log(`fit_status: ${sp.fit_status}`);
console.log(`zones: ${zones.map((z) => `${z.content_type}(${z.division_type})`).join(", ")}`);
console.log(`Wrote ${outPath}`);
