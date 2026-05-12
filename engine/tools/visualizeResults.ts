/**
 * Lightweight results visualizer.
 * Edit the TEST_CASES array, then run: npm run viz
 * Output: /tmp/umestno-viz.html  (or pass a path as argv[2])
 */
import { writeFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import type { DrawerSize, PlacedZone, UserInput } from "../types.js";

const OUTPUT_PATH = process.argv[2] ?? "/tmp/umestno-viz.html";

// ─── EDIT YOUR TEST CASES HERE ───────────────────────────────────────────────

type Case = { label: string; input: UserInput };

const TEST_CASES: Case[] = [
  {
    label: "underwear 80×45×15 — panties+socks+bras",
    input: {
      drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15,
      storage_category: "underwear", priority: "convenient",
      items: [
        { content_type: "panties",       volume_level: "medium" },
        { content_type: "socks_regular", volume_level: "small" },
        { content_type: "bras",          volume_level: "small" },
      ],
    },
  },
  {
    label: "underwear 120×50×20 — socks+panties+bras large",
    input: {
      drawer_width_cm: 120, drawer_depth_cm: 50, drawer_height_cm: 20,
      storage_category: "underwear", priority: "capacity",
      items: [
        { content_type: "socks_regular", volume_level: "large" },
        { content_type: "panties",       volume_level: "large" },
        { content_type: "bras",          volume_level: "medium" },
      ],
    },
  },
  {
    label: "mixed 80×45×15 — panties+tshirts+socks",
    input: {
      drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15,
      storage_category: "mixed", priority: "convenient",
      items: [
        { content_type: "panties",       volume_level: "medium" },
        { content_type: "tshirts",       volume_level: "small" },
        { content_type: "socks_regular", volume_level: "large" },
      ],
    },
  },
  {
    label: "underwear 100×50×15 — panties+bras+socks large",
    input: {
      drawer_width_cm: 100, drawer_depth_cm: 50, drawer_height_cm: 15,
      storage_category: "underwear", priority: "convenient",
      items: [
        { content_type: "panties",       volume_level: "large" },
        { content_type: "bras",          volume_level: "large" },
        { content_type: "socks_regular", volume_level: "large" },
      ],
    },
  },
  {
    label: "underwear 80×40×10 — bras+socks (low drawer, soft height)",
    input: {
      drawer_width_cm: 80, drawer_depth_cm: 40, drawer_height_cm: 10,
      storage_category: "underwear", priority: "convenient",
      items: [
        { content_type: "bras",          volume_level: "medium" },
        { content_type: "socks_regular", volume_level: "medium" },
      ],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────

type RunResult =
  | { ok: true;  zones: PlacedZone[]; reserve: FreeRect[]; fitStatus: string; warnings: string[] }
  | { ok: false; error: string };

type FreeRect = { x_cm: number; y_cm: number; w_cm: number; d_cm: number };

function runCase(c: Case): RunResult {
  try {
    const out = runUmestnoEngine(c.input);
    if (!out.scheme_payload) {
      const dbg = out.debug as Record<string, unknown> | undefined;
      const v = dbg?.["validation_result"] as { errors?: string[] } | undefined;
      return { ok: false, error: `validation failed: ${(v?.errors ?? []).join("; ")}` };
    }
    const sp = out.scheme_payload;
    const warns = sp.content_warnings.map((w) => `${w.content_type}: ${w.warning_code} (+${w.overflow_h_cm}cm)`);
    return { ok: true, zones: sp.assigned_zones, reserve: sp.reserve_zones, fitStatus: sp.fit_status, warnings: warns };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── SVG ─────────────────────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, string> = {
  cells:    "#bfdbfe", // blue-200
  slots:    "#ddd6fe", // violet-200
  open:     "#bbf7d0", // green-200
  dividers: "#fed7aa", // orange-200
};

const ZONE_STROKE: Record<string, string> = {
  cells:    "#1d4ed8",
  slots:    "#6d28d9",
  open:     "#15803d",
  dividers: "#c2410c",
};

function fmt(n: number) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }
function esc(s: unknown) {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function buildSvg(drawer: DrawerSize, zones: PlacedZone[], reserve: FreeRect[]): string {
  const scale = Math.min(9, Math.max(4, 520 / Math.max(drawer.w_cm, drawer.d_cm)));
  const pad = { l: 40, r: 16, t: 28, b: 36 };
  const iw = drawer.w_cm * scale;
  const ih = drawer.d_cm * scale;
  const W = iw + pad.l + pad.r;
  const H = ih + pad.t + pad.b;

  const rects = [
    // reserve zones (hatched)
    ...reserve.map((r) => {
      const x = pad.l + r.x_cm * scale;
      const y = pad.t + (drawer.d_cm - r.y_cm - r.d_cm) * scale;
      const w = r.w_cm * scale;
      const h = r.d_cm * scale;
      if (w < 1 || h < 1) return "";
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
        fill="url(#hatch)" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>`;
    }),
    // placed zones
    ...zones.map((z, i) => {
      const x = pad.l + z.x_cm * scale;
      const y = pad.t + (drawer.d_cm - z.y_cm - z.assigned_d_cm) * scale;
      const w = z.assigned_w_cm * scale;
      const h = z.assigned_d_cm * scale;
      const fill   = ZONE_COLORS[z.division_type] ?? "#e2e8f0";
      const stroke = ZONE_STROKE[z.division_type] ?? "#475467";
      const hasWarn = Boolean(z.soft_height_warning);
      const labelMain = z.content_type;
      const labelSub  = `${fmt(z.assigned_w_cm)}×${fmt(z.assigned_d_cm)} cm  cap ${z.capacity}`;
      const fs = w < 72 ? 9 : 11;
      return `<g>
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
          fill="${fill}" stroke="${hasWarn ? "#d97706" : stroke}" stroke-width="${hasWarn ? 2.5 : 1.5}" rx="3"/>
        ${hasWarn ? `<circle cx="${(x + w - 10).toFixed(1)}" cy="${(y + 10).toFixed(1)}" r="7" fill="#f59e0b"/>
          <text x="${(x + w - 10).toFixed(1)}" y="${(y + 14).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">!</text>` : ""}
        <text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2 - 5).toFixed(1)}" text-anchor="middle"
          font-size="${fs}" font-weight="700" fill="#1e293b" dominant-baseline="middle">${esc(labelMain)}</text>
        <text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2 + 9).toFixed(1)}" text-anchor="middle"
          font-size="9" fill="#475467" dominant-baseline="middle">${esc(labelSub)}</text>
        <text x="${(x + 4).toFixed(1)}" y="${(y + 11).toFixed(1)}" font-size="8" fill="#64748b">${i + 1}</text>
      </g>`;
    }),
  ].join("\n");

  const axisW = `<text x="${(pad.l + iw / 2).toFixed(1)}" y="${(H - 4).toFixed(1)}"
    text-anchor="middle" font-size="10" fill="#64748b">ширина ${drawer.w_cm} cm →</text>`;
  const axisD = `<text x="8" y="${(pad.t + ih / 2).toFixed(1)}"
    transform="rotate(-90 8 ${(pad.t + ih / 2).toFixed(1)})"
    text-anchor="middle" font-size="10" fill="#64748b">глубина ${drawer.d_cm} cm</text>`;
  const labelFar   = `<text x="${(pad.l + iw / 2).toFixed(1)}" y="${(pad.t - 6).toFixed(1)}"
    text-anchor="middle" font-size="10" fill="#94a3b8">дальняя стенка</text>`;
  const labelNear  = `<text x="${(pad.l + iw / 2).toFixed(1)}" y="${(pad.t + ih + 14).toFixed(1)}"
    text-anchor="middle" font-size="10" fill="#94a3b8">ближний край</text>`;

  return `<svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" xmlns="http://www.w3.org/2000/svg"
      style="max-width:100%;height:auto;display:block;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px">
    <defs>
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse">
        <path d="M-1 7L7-1M0 8L8 0" stroke="#94a3b8" stroke-width="1" opacity="0.6"/>
      </pattern>
    </defs>
    ${labelFar}
    <rect x="${pad.l}" y="${pad.t}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}"
      fill="#fff" stroke="#334155" stroke-width="2" rx="2"/>
    ${rects}
    ${labelNear}
    ${axisW}
    ${axisD}
  </svg>`;
}

// ─── HTML assembly ────────────────────────────────────────────────────────────

const FIT_COLOR: Record<string, string> = {
  fit_all:                  "#dcfce7",
  fit_all_after_adjustment: "#d1fae5",
  fit_partial:              "#fef9c3",
  fit_none:                 "#fee2e2",
};

function card(c: Case, run: RunResult): string {
  const drawer: DrawerSize = {
    w_cm: c.input.drawer_width_cm,
    d_cm: c.input.drawer_depth_cm,
    h_cm: c.input.drawer_height_cm,
  };

  if (!run.ok) {
    return `<div class="card">
      <div class="card-title">${esc(c.label)}</div>
      <div class="pill err">ошибка</div>
      <p style="color:#b91c1c;font-size:13px">${esc(run.error)}</p>
    </div>`;
  }

  const bg = FIT_COLOR[run.fitStatus] ?? "#f1f5f9";
  const zoneLegend = run.zones
    .map((z, i) => `<div class="leg-row"><span class="dot" style="background:${ZONE_COLORS[z.division_type] ?? "#e2e8f0"};border:1px solid ${ZONE_STROKE[z.division_type] ?? "#475467"}"></span>${i + 1} — ${esc(z.content_type)} <span class="muted">${z.division_type} ${fmt(z.assigned_w_cm)}×${fmt(z.assigned_d_cm)}×${fmt(z.assigned_h_cm)} cm · cap ${z.capacity}</span>${z.soft_height_warning ? ` <span class="warn-tag">⚠ high</span>` : ""}</div>`)
    .join("");

  const warnBlock = run.warnings.length
    ? `<div class="warn-list">${run.warnings.map((w) => `<div>⚠ ${esc(w)}</div>`).join("")}</div>`
    : "";

  return `<div class="card">
    <div class="card-title">${esc(c.label)}</div>
    <div class="meta-row">
      <span class="pill" style="background:${bg}">${esc(run.fitStatus)}</span>
      <span class="pill">${drawer.w_cm}×${drawer.d_cm}×${drawer.h_cm} cm</span>
      <span class="pill">${esc(c.input.storage_category)}</span>
      <span class="pill">${esc(c.input.priority)}</span>
    </div>
    <div class="layout">
      <div class="svg-wrap">${buildSvg(drawer, run.zones, run.reserve)}</div>
      <div class="legend">${zoneLegend}${warnBlock}</div>
    </div>
  </div>`;
}

const renderedAt = new Date().toLocaleString("ru-RU");
const cards = TEST_CASES.map((c) => card(c, runCase(c))).join("\n");

const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Umestno — results visualizer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; background: #f1f5f9; color: #1e293b;
           font: 14px/1.5 Inter, system-ui, -apple-system, sans-serif; }
    header { background: #0f172a; color: #e2e8f0; padding: 18px 28px; }
    header h1 { margin: 0 0 4px; font-size: 20px; }
    header p  { margin: 0; font-size: 12px; color: #94a3b8; }
    main { display: grid; gap: 20px; padding: 20px 28px 48px; max-width: 1200px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
            box-shadow: 0 2px 8px rgb(0 0 0/6%); padding: 16px 20px; }
    .card-title { font-weight: 700; font-size: 15px; margin-bottom: 10px; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .pill { border-radius: 999px; background: #f1f5f9; padding: 3px 10px;
            font-size: 12px; font-weight: 600; }
    .pill.err { background: #fee2e2; color: #b91c1c; }
    .layout { display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; }
    .svg-wrap { flex: 0 0 auto; }
    .legend { flex: 1 1 220px; min-width: 180px; }
    .leg-row { display: flex; align-items: center; gap: 7px;
               font-size: 12px; margin-bottom: 5px; }
    .dot { display: inline-block; width: 12px; height: 12px;
           border-radius: 3px; flex-shrink: 0; }
    .muted { color: #64748b; }
    .warn-tag { background: #fef3c7; color: #92400e; border-radius: 4px;
                padding: 1px 5px; font-size: 11px; font-weight: 700; }
    .warn-list { margin-top: 10px; font-size: 12px; color: #92400e;
                 background: #fef9c3; border-radius: 6px; padding: 8px 10px; }
    .warn-list div { margin-bottom: 3px; }
  </style>
</head>
<body>
  <header>
    <h1>Umestno — results visualizer</h1>
    <p>Сгенерировано: ${esc(renderedAt)} · Y-ось: дальняя стенка = вверх, ближний край = вниз</p>
  </header>
  <main>${cards}</main>
</body>
</html>`;

writeFileSync(OUTPUT_PATH, html, "utf8");
console.log(`Wrote ${OUTPUT_PATH}`);
