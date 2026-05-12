/**
 * Local dev server — interactive engine playground.
 * Run:  npm run dev
 * Open: http://localhost:3131
 *
 * Fill in the form → click Run → see the drawer layout inline.
 * No npm dependencies — uses only Node.js built-ins + compiled engine dist.
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2] ?? 3131);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const enginePath = path.resolve(__dirname, "../../dist/engine/index.js");

const { runUmestnoEngine } = await import(enginePath);

// ─── known content types ──────────────────────────────────────────────────────

const CONTENT_TYPES = [
  "panties", "boxers", "bras", "socks_regular", "tights",
  "sport_tops", "thermals", "pajamas", "nightgowns",
  "tshirts", "longsleeves", "sweaters", "jeans", "leggings", "shorts",
  "belts", "jewelry_large", "jewelry_small", "scarves", "ties", "swimwear",
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }
function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ─── SVG renderer ─────────────────────────────────────────────────────────────

const ZONE_FILL   = { cells: "#bfdbfe", slots: "#ddd6fe", open: "#bbf7d0", dividers: "#fed7aa" };
const ZONE_STROKE = { cells: "#1d4ed8", slots: "#6d28d9", open: "#15803d", dividers: "#c2410c" };

function buildSvg(drawer, zones, reserve) {
  const scale = Math.min(9, Math.max(4, 540 / Math.max(drawer.w_cm, drawer.d_cm)));
  const pad = { l: 42, r: 18, t: 30, b: 38 };
  const iw = drawer.w_cm * scale;
  const ih = drawer.d_cm * scale;
  const W  = iw + pad.l + pad.r;
  const H  = ih + pad.t + pad.b;

  const reserveSvg = reserve.map((r) => {
    const x = pad.l + r.x_cm * scale;
    const y = pad.t + (drawer.d_cm - r.y_cm - r.d_cm) * scale;
    const w = r.w_cm * scale;
    const h = r.d_cm * scale;
    if (w < 1 || h < 1) return "";
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
      fill="url(#hatch)" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>`;
  }).join("");

  const zonesSvg = zones.map((z, i) => {
    const x    = pad.l + z.x_cm * scale;
    const y    = pad.t + (drawer.d_cm - z.y_cm - z.assigned_d_cm) * scale;
    const w    = z.assigned_w_cm * scale;
    const h    = z.assigned_d_cm * scale;
    const fill   = ZONE_FILL[z.division_type]   ?? "#e2e8f0";
    const stroke = ZONE_STROKE[z.division_type] ?? "#475467";
    const warn   = Boolean(z.soft_height_warning);
    const fs = w < 72 ? 9 : 11;
    return `<g>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
        fill="${fill}" stroke="${warn ? "#d97706" : stroke}" stroke-width="${warn ? 2.5 : 1.5}" rx="3"/>
      ${warn ? `<circle cx="${(x+w-10).toFixed(1)}" cy="${(y+10).toFixed(1)}" r="7" fill="#f59e0b"/>
        <text x="${(x+w-10).toFixed(1)}" y="${(y+14).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">!</text>` : ""}
      <text x="${(x+w/2).toFixed(1)}" y="${(y+h/2-5).toFixed(1)}"
        text-anchor="middle" font-size="${fs}" font-weight="700" fill="#1e293b">${esc(z.content_type)}</text>
      <text x="${(x+w/2).toFixed(1)}" y="${(y+h/2+9).toFixed(1)}"
        text-anchor="middle" font-size="9" fill="#475467">${fmt(z.assigned_w_cm)}×${fmt(z.assigned_d_cm)} · cap ${z.capacity}</text>
      <text x="${(x+4).toFixed(1)}" y="${(y+11).toFixed(1)}" font-size="8" fill="#64748b">${i+1}</text>
    </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" xmlns="http://www.w3.org/2000/svg"
      style="max-width:100%;height:auto;display:block;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px">
    <defs>
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse">
        <path d="M-1 7L7-1M0 8L8 0" stroke="#94a3b8" stroke-width="1" opacity="0.6"/>
      </pattern>
    </defs>
    <text x="${(pad.l+iw/2).toFixed(1)}" y="${(pad.t-8).toFixed(1)}"
      text-anchor="middle" font-size="10" fill="#94a3b8">дальняя стенка</text>
    <rect x="${pad.l}" y="${pad.t}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}"
      fill="#fff" stroke="#334155" stroke-width="2" rx="2"/>
    ${reserveSvg}
    ${zonesSvg}
    <text x="${(pad.l+iw/2).toFixed(1)}" y="${(pad.t+ih+14).toFixed(1)}"
      text-anchor="middle" font-size="10" fill="#94a3b8">ближний край</text>
    <text x="${(pad.l+iw/2).toFixed(1)}" y="${(H-4).toFixed(1)}"
      text-anchor="middle" font-size="10" fill="#64748b">ширина ${drawer.w_cm} cm →</text>
    <text x="8" y="${(pad.t+ih/2).toFixed(1)}"
      transform="rotate(-90 8 ${(pad.t+ih/2).toFixed(1)})"
      text-anchor="middle" font-size="10" fill="#64748b">глубина ${drawer.d_cm} cm</text>
  </svg>`;
}

// ─── HTML page ────────────────────────────────────────────────────────────────

const CONTENT_TYPE_OPTIONS = CONTENT_TYPES.map(
  (ct) => `<option value="${ct}">${ct}</option>`
).join("");

const VOLUME_OPTIONS = ["small", "medium", "large"].map(
  (v) => `<option value="${v}">${v}</option>`
).join("");

function itemRow(n) {
  return `<div class="item-row" id="item-row-${n}" style="${n > 1 ? "display:none" : ""}">
    <span class="item-label">Вещь ${n}</span>
    <select name="ct${n}" class="sel-ct"><option value="">— не задано —</option>${CONTENT_TYPE_OPTIONS}</select>
    <select name="vl${n}" class="sel-vl">${VOLUME_OPTIONS}</select>
    ${n < 3 ? `<button type="button" class="btn-add" onclick="addItem(${n+1})">+ ещё</button>` : ""}
  </div>`;
}

const PAGE_HTML = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Umestno dev</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; background: #f1f5f9; color: #1e293b;
           font: 14px/1.6 Inter, system-ui, sans-serif; }
    header { background: #0f172a; color: #e2e8f0; padding: 14px 24px; }
    header h1 { margin: 0 0 2px; font-size: 17px; }
    header p  { margin: 0; font-size: 12px; color: #64748b; }
    .wrap { display: grid; grid-template-columns: 300px 1fr; min-height: calc(100vh - 52px); }
    .sidebar { background: #fff; border-right: 1px solid #e2e8f0; padding: 20px 18px; overflow-y: auto; }
    .main    { padding: 24px; overflow: auto; }
    label    { display: block; font-size: 12px; font-weight: 600; color: #475467; margin: 12px 0 4px; }
    input[type=number], select { width: 100%; padding: 7px 9px; border: 1px solid #cbd5e1;
      border-radius: 6px; font-size: 13px; background: #f8fafc; }
    .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .row3 label { margin-top: 0; }
    .item-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .item-label { font-size: 12px; font-weight: 600; color: #64748b; min-width: 46px; }
    .sel-ct { flex: 2 1 120px; }
    .sel-vl { flex: 1 1 80px; }
    .btn-add { background: none; border: 1px dashed #94a3b8; border-radius: 6px;
               color: #475467; cursor: pointer; font-size: 12px; padding: 5px 8px; white-space: nowrap; }
    .btn-add:hover { background: #f1f5f9; }
    .btn-run { width: 100%; margin-top: 18px; padding: 10px; background: #1d4ed8;
               color: #fff; border: none; border-radius: 8px; font-size: 14px;
               font-weight: 700; cursor: pointer; }
    .btn-run:hover { background: #1e40af; }
    .result-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
    .pill { border-radius: 999px; background: #f1f5f9; padding: 3px 10px;
            font-size: 12px; font-weight: 600; }
    .legend { margin-top: 16px; }
    .leg-row { display: flex; align-items: center; gap: 7px; font-size: 12px; margin-bottom: 5px; }
    .dot { display: inline-block; width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
    .muted { color: #64748b; }
    .warn-tag { background: #fef3c7; color: #92400e; border-radius: 4px;
                padding: 1px 5px; font-size: 11px; font-weight: 700; }
    .warn-list { margin-top: 12px; font-size: 12px; color: #92400e;
                 background: #fef9c3; border-radius: 6px; padding: 8px 10px; }
    .err-box   { background: #fee2e2; color: #b91c1c; border-radius: 8px;
                 padding: 12px 14px; font-size: 13px; }
    .empty { color: #94a3b8; font-size: 14px; margin-top: 60px; text-align: center; }
    .spinner { display: none; font-size: 13px; color: #64748b; margin-top: 8px; text-align: center; }
  </style>
</head>
<body>
  <header>
    <h1>Umestno — dev playground</h1>
    <p>Введи параметры → Run → смотри схему</p>
  </header>
  <div class="wrap">
    <aside class="sidebar">
      <form id="frm">
        <label>Категория хранения</label>
        <select name="category">
          <option value="underwear">underwear</option>
          <option value="soft_clothes">soft_clothes</option>
          <option value="accessories">accessories</option>
          <option value="mixed">mixed</option>
        </select>

        <label>Приоритет</label>
        <select name="priority">
          <option value="convenient">convenient</option>
          <option value="capacity">capacity</option>
          <option value="budget">budget</option>
        </select>

        <label>Размер ящика (см)</label>
        <div class="row3">
          <div><label>Ширина</label><input type="number" name="w" value="80" min="10" max="300" step="1"></div>
          <div><label>Глубина</label><input type="number" name="d" value="45" min="10" max="300" step="1"></div>
          <div><label>Высота</label><input type="number" name="h" value="15" min="3" max="100" step="1"></div>
        </div>

        <label style="margin-top:16px">Вещи (до 3)</label>
        ${[1, 2, 3].map(itemRow).join("")}

        <button type="submit" class="btn-run">▶ Run</button>
        <div class="spinner" id="spin">Считаю…</div>
      </form>
    </aside>
    <main class="main" id="result">
      <div class="empty">← Заполни форму и нажми Run</div>
    </main>
  </div>
  <script>
    function addItem(n) {
      document.getElementById('item-row-' + n).style.display = '';
      const prevBtn = document.querySelector('#item-row-' + (n-1) + ' .btn-add');
      if (prevBtn) prevBtn.style.display = 'none';
    }
    document.getElementById('frm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const spin = document.getElementById('spin');
      spin.style.display = 'block';
      try {
        const res = await fetch('/run', { method: 'POST', body: new URLSearchParams(new FormData(e.target)) });
        document.getElementById('result').innerHTML = await res.text();
      } catch(err) {
        document.getElementById('result').innerHTML = '<div class="err-box">Ошибка: ' + err + '</div>';
      } finally {
        spin.style.display = 'none';
      }
    });
  </script>
</body>
</html>`;

// ─── run engine & build result fragment ──────────────────────────────────────

const FIT_COLOR = {
  fit_all: "#dcfce7", fit_all_after_adjustment: "#d1fae5",
  fit_partial: "#fef9c3", fit_none: "#fee2e2",
};

function handleRun(body) {
  const p = new URLSearchParams(body);
  const get = (k) => (p.get(k) ?? "").trim();

  const w = parseFloat(get("w"));
  const d = parseFloat(get("d"));
  const h = parseFloat(get("h"));
  if (!w || !d || !h) return `<div class="err-box">Укажи размеры ящика.</div>`;

  const items = [];
  for (const n of [1, 2, 3]) {
    const ct = get(`ct${n}`);
    const vl = get(`vl${n}`) || "medium";
    if (ct) items.push({ content_type: ct, volume_level: vl });
  }
  if (!items.length) return `<div class="err-box">Добавь хотя бы одну вещь.</div>`;

  const input = {
    drawer_width_cm: w, drawer_depth_cm: d, drawer_height_cm: h,
    storage_category: get("category"),
    priority: get("priority"),
    items,
  };

  let out;
  try {
    out = runUmestnoEngine(input);
  } catch (err) {
    return `<div class="err-box">Engine exception: ${esc(err instanceof Error ? err.message : String(err))}</div>`;
  }

  if (!out.scheme_payload) {
    const dbg = out.debug ?? {};
    const v   = dbg["validation_result"] ?? {};
    const errs = (v.errors ?? ["неизвестная ошибка"]).join("; ");
    return `<div class="err-box">Validation failed: ${esc(errs)}</div>`;
  }

  const sp     = out.scheme_payload;
  const drawer = { w_cm: w, d_cm: d, h_cm: h };
  const zones  = sp.assigned_zones;
  const reserve = sp.reserve_zones;
  const warns  = sp.content_warnings;
  const fitBg  = FIT_COLOR[sp.fit_status] ?? "#f1f5f9";

  const legend = zones.map((z, i) => {
    const fill   = ZONE_FILL[z.division_type]   ?? "#e2e8f0";
    const stroke = ZONE_STROKE[z.division_type] ?? "#475467";
    const warn   = z.soft_height_warning ? `<span class="warn-tag">⚠ height</span>` : "";
    return `<div class="leg-row">
      <span class="dot" style="background:${fill};border:1px solid ${stroke}"></span>
      ${i+1} — ${esc(z.content_type)}
      <span class="muted">${z.division_type} · ${fmt(z.assigned_w_cm)}×${fmt(z.assigned_d_cm)}×${fmt(z.assigned_h_cm)} cm · cap ${z.capacity}</span>
      ${warn}
    </div>`;
  }).join("");

  const warnBlock = warns.length
    ? `<div class="warn-list">${warns.map((w) => `<div>⚠ ${esc(w.content_type)}: ${esc(w.warning_code)} — +${w.overflow_h_cm} cm</div>`).join("")}</div>`
    : "";

  const adjNote = sp.adjustment_note
    ? `<span class="pill" style="background:#e0f2fe">${esc(sp.adjustment_note)}</span>`
    : "";

  const titleItems = items.map((it) => `${it.content_type} ${it.volume_level}`).join(" + ");

  return `
    <div class="result-title">${esc(titleItems)}</div>
    <div class="meta-row">
      <span class="pill" style="background:${fitBg}">${esc(sp.fit_status)}</span>
      <span class="pill">${w}×${d}×${h} cm</span>
      <span class="pill">${esc(input.storage_category)}</span>
      <span class="pill">${esc(input.priority)}</span>
      ${adjNote}
    </div>
    ${buildSvg(drawer, zones, reserve)}
    <div class="legend">${legend}${warnBlock}</div>`;
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE_HTML);
    return;
  }

  if (req.method === "POST" && req.url === "/run") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const html = handleRun(body);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Umestno dev server → http://localhost:${PORT}`);
});
