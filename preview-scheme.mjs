import { runUmestnoEngine } from "./dist/engine/index.js";
import fs from "fs";

const input = {
  drawer_width_cm: 120, drawer_depth_cm: 50, drawer_height_cm: 30,
  storage_category: "underwear", priority: "convenient",
  items: [
    { content_type: "socks_regular", volume_level: "large"  },
    { content_type: "panties",       volume_level: "large"  },
    { content_type: "bras",          volume_level: "large"  },
    { content_type: "tights",        volume_level: "medium" },
  ],
};

const { result, scheme_payload } = runUmestnoEngine(input);
if (!result) { console.error("Engine error"); process.exit(1); }

const assignedZones = result.scheme.assigned_zones;
const whatWhere     = result.what_to_store_where;
const warnings      = [...result.scheme.warnings, ...result.scheme.content_warnings.map(w => w.message)];

// Build scheme_zones: content + reserve (mirrors schemeZones.ts logic)
function selectBestReserveRect(rects, drawerW, drawerD) {
  const minArea = drawerW * drawerD * 0.06;
  return rects
    .filter(r => r.w_cm * r.d_cm >= minArea)
    .sort((a, b) => b.w_cm * b.d_cm - a.w_cm * a.d_cm)[0] ?? null;
}

const contentZones = assignedZones.map(z => ({
  zone_id: z.zone_id, type: "content", content_type: z.content_type,
  x_cm: z.x_cm, y_cm: z.y_cm, assigned_w_cm: z.assigned_w_cm, assigned_d_cm: z.assigned_d_cm,
  zone_w_cm: z.zone_w_cm, zone_d_cm: z.zone_d_cm, zone_h_cm: z.zone_h_cm,
}));

const bestReserve = selectBestReserveRect(scheme_payload.reserve_zones ?? [], input.drawer_width_cm, input.drawer_depth_cm);
const reserveZones = bestReserve ? [{
  zone_id: "reserve_0", type: "reserve", content_type: null,
  x_cm: bestReserve.x_cm, y_cm: bestReserve.y_cm,
  assigned_w_cm: bestReserve.w_cm, assigned_d_cm: bestReserve.d_cm,
}] : [];

const scheme_zones = [...contentZones, ...reserveZones];
const zones = assignedZones; // keep for dimensions list

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  cream:      "#F7F4EF",
  surface:    "#FFFFFF",
  frameOuter: "#B8956A",
  frameInner: "#DDD0BE",
  drawerBg:   "#EDE5D8",
  text:       "#2C2520",
  textMid:    "#6B5C4E",
  textLight:  "#9C8C80",
  accent:     "#C97B5E",
  sage:       "#8FA885",
  border:     "#E8E0D6",
};

// Zone colors: base fill + highlight (for gradient) + label color
const ZONES_PALETTE = [
  { base:"#E8DECE", hi:"#F5F0E8", stroke:"#C8B8A4", label:"#4A3C30" },
  { base:"#8FA885", hi:"#AEC2A4", stroke:"#6E8A72", label:"#2A4030" },
  { base:"#BEB0A0", hi:"#D4C8BA", stroke:"#9E9080", label:"#3C3028" },
  { base:"#CEC0AE", hi:"#E0D4C4", stroke:"#AE9E8C", label:"#3E3428" },
  { base:"#A8BAA4", hi:"#C2D0BE", stroke:"#849A80", label:"#2C3E2C" },
  { base:"#D8CCBE", hi:"#EAE0D4", stroke:"#B8AA9C", label:"#3E3830" },
];

const CONTENT_RU = {
  socks_regular:"Носки",   panties:"Трусы",       boxers:"Боксёры",
  bras:"Бюстгальтеры",     tights:"Колготки",     tshirts:"Майки",
  jeans:"Джинсы",          sport_tops:"Спорт",    thermals:"Термобельё",
  pajamas:"Пижамы",        nightgowns:"Рубашки",  longsleeves:"Лонгсливы",
  sweaters:"Свитеры",      leggings:"Леггинсы",   shorts:"Шорты",
  belts:"Ремни",           jewelry_large:"Украшения", jewelry_small:"Бижутерия",
  scarves:"Шарфы",         ties:"Галстуки",       swimwear:"Купальники",
};
const PRIORITY_RU = { convenient:"Удобно", capacity:"Вместительно", budget:"Бюджетно" };
const ITEM_ICONS  = {
  socks_regular:"🧦", panties:"🩲", boxers:"🩲", bras:"👙", tights:"🩱",
  tshirts:"👕", jeans:"👖", sport_tops:"🩱", thermals:"🧥", pajamas:"🌙",
  nightgowns:"🌙", longsleeves:"👕", sweaters:"🧥", leggings:"🩱",
  shorts:"🩳", belts:"👔", jewelry_large:"💍", jewelry_small:"📿",
  scarves:"🧣", ties:"👔", swimwear:"👙",
};

// ── SVG Scheme ─────────────────────────────────────────────────────────────
const SC = 7.5;   // scale: px per cm
const FP = 22;    // frame padding (thick outer frame)
const ZG = 5;     // zone gap
const ZR = 14;    // zone border radius
const FR = 18;    // frame border radius

function buildSvg(zones, wCm, dCm) {
  const iW = wCm * SC, iH = dCm * SC;
  const tW = iW + FP*2, tH = iH + FP*2;
  const half = ZG / 2;

  const defs = `<defs>
    <!-- Per-zone gradients (top-light → base for soft puff feel) -->
    ${ZONES_PALETTE.map((p, i) => `
    <linearGradient id="zg${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${p.hi}" stop-opacity="1"/>
      <stop offset="55%"  stop-color="${p.base}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${p.base}" stop-opacity="0.88"/>
    </linearGradient>`).join("")}

    <!-- Drawer background gradient -->
    <linearGradient id="drawerGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#F2EBE0"/>
      <stop offset="100%" stop-color="#E4DAC8"/>
    </linearGradient>

    <!-- Frame gradient -->
    <linearGradient id="frameGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#C9A476"/>
      <stop offset="100%" stop-color="#A8824E"/>
    </linearGradient>

    <!-- Linen fabric texture (very subtle noise overlay) -->
    <filter id="linen" x="0%" y="0%" width="100%" height="100%"
            color-interpolation-filters="linearRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.75 0.35"
        numOctaves="4" seed="7" stitchTiles="stitch" result="noise"/>
      <feColorMatrix type="matrix"
        values="0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.88  0 0 0 0.055 0"
        in="noise" result="warmNoise"/>
      <feBlend mode="soft-light" in="SourceGraphic" in2="warmNoise"/>
    </filter>

    <!-- Soft zone shadow -->
    <filter id="zshadow" x="-8%" y="-8%" width="116%" height="124%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#8B6B4A" flood-opacity="0.18"/>
    </filter>

    <!-- Frame inner shadow (depth) -->
    <filter id="frameDepth" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#5A3A1A" flood-opacity="0.22"/>
    </filter>
  </defs>`;

  let contentCount = 0;
  const zoneEls = scheme_zones.map((z, i) => {
    const px = FP + z.x_cm * SC + half;
    const py = FP + z.y_cm * SC + half;
    const pw = z.assigned_w_cm * SC - ZG;
    const ph = z.assigned_d_cm * SC - ZG;
    const cx = px + pw / 2;
    const cy = py + ph / 2;

    // Reserve zone: dashed outline, "Свободно" label
    if (z.type === "reserve") {
      const fs = Math.max(7, Math.min(12, ph * 0.13));
      return `
    <!-- Reserve zone -->
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}"
      fill="#F5EFE6" fill-opacity="0.45"
      stroke="#BFA07A" stroke-width="1.5" stroke-dasharray="6,4" rx="${ZR}"/>
    <text x="${cx}" y="${cy + fs*0.4}" text-anchor="middle"
      font-family="Manrope,'Helvetica Neue',sans-serif"
      font-size="${fs}" fill="#BFA07A" opacity="0.7" letter-spacing="0.07em">Свободно</text>`;
    }

    // Content zone
    contentCount++;
    const pi  = (contentCount - 1) % ZONES_PALETTE.length;
    const pal = ZONES_PALETTE[pi];
    const numFs  = Math.max(7.5, Math.min(10.5, ph * 0.14));
    const nameFs = Math.max(9,   Math.min(15,   ph * 0.22));
    const numY   = cy - nameFs * 0.5;
    const nameY  = cy + nameFs * 0.85;
    const label  = CONTENT_RU[z.content_type] ?? z.content_type;

    return `
    <!-- Zone ${contentCount}: ${label} -->
    <g filter="url(#zshadow)">
      <rect x="${px}" y="${py}" width="${pw}" height="${ph}"
        fill="url(#zg${pi})" rx="${ZR}"/>
    </g>
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}"
      fill="url(#zg${pi})" rx="${ZR}" filter="url(#linen)" opacity="0.9"/>
    <rect x="${px+2}" y="${py+2}" width="${pw-4}" height="${Math.min(ph*0.28, 16)}"
      fill="white" rx="${ZR-2}" opacity="0.18"/>
    <text x="${cx}" y="${numY}"
      font-family="Manrope,'Helvetica Neue',sans-serif"
      font-size="${numFs}" font-weight="500" letter-spacing="0.06em"
      text-anchor="middle" fill="${pal.label}" opacity="0.65">Блок ${contentCount}.</text>
    <text x="${cx}" y="${nameY}"
      font-family="Manrope,'Helvetica Neue',sans-serif"
      font-size="${nameFs}" font-weight="700"
      text-anchor="middle" fill="${pal.label}">${label}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${tW} ${tH}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;height:auto;display:block;border-radius:${FR}px;
           box-shadow:0 8px 40px rgba(90,58,26,0.18)">
    ${defs}
    <!-- Outer frame -->
    <rect x="0" y="0" width="${tW}" height="${tH}"
      fill="url(#frameGrad)" rx="${FR}" ry="${FR}" filter="url(#frameDepth)"/>
    <!-- Frame inner bevel -->
    <rect x="${FP-7}" y="${FP-7}" width="${iW+14}" height="${iH+14}"
      fill="${C.frameInner}" rx="${FR-4}" ry="${FR-4}"/>
    <!-- Drawer surface -->
    <rect x="${FP}" y="${FP}" width="${iW}" height="${iH}"
      fill="url(#drawerGrad)" rx="6" ry="6" filter="url(#linen)"/>
    ${zoneEls}
  </svg>`;
}

// ── HTML helpers ───────────────────────────────────────────────────────────
const priorityLabel = PRIORITY_RU[input.priority] ?? input.priority;
const itemsLabel    = input.items.map(it => CONTENT_RU[it.content_type] ?? it.content_type).join(", ");

function infoCardsHtml() {
  return [
    { label:"Место хранения",     value:"Выдвижной ящик" },
    { label:"Размеры",            value:`Ш ${input.drawer_width_cm} × Г ${input.drawer_depth_cm} × В ${input.drawer_height_cm} см` },
    { label:"Вы выбрали хранить", value:itemsLabel },
    { label:"Ваш приоритет",      value:priorityLabel },
  ].map(c => `<div class="info-card">
    <div class="info-label">${c.label}</div>
    <div class="info-value">${c.value}</div>
  </div>`).join("");
}

function whatWhereHtml() {
  return whatWhere.map((w, i) => {
    const pal = ZONES_PALETTE[i % ZONES_PALETTE.length];
    return `<div class="list-item">
      <span class="zone-dot" style="background:${pal.base};border:1.5px solid ${pal.stroke}">${i+1}</span>
      <span>Блок ${i+1} — ${CONTENT_RU[w.content_type] ?? w.content_type}</span>
    </div>`;
  }).join("");
}

function foldingHtml() {
  return whatWhere.map(w => {
    const icon = ITEM_ICONS[w.content_type] ?? "○";
    return `<div class="fold-item">
      <span class="fold-icon">${icon}</span>
      <div>
        <div class="fold-name">${CONTENT_RU[w.content_type] ?? w.content_type}</div>
        <div class="fold-hint">${w.instruction}</div>
      </div>
    </div>`;
  }).join("");
}

function whyHtml() {
  return [
    `Подобрана под ваши размеры: ${input.drawer_width_cm} × ${input.drawer_depth_cm} × ${input.drawer_height_cm} см`,
    `Учитывает все выбранные типы вещей`,
    `Оптимизирована под приоритет «${priorityLabel}»`,
    result.scheme.fit_status === "fit_all" ? `Все блоки входят без перекрытий` : null,
  ].filter(Boolean).map(t => `
    <div class="why-item"><span class="check">✓</span><span>${t}</span></div>`).join("");
}

function dimensionsHtml() {
  return zones.map((z, i) => {
    const pal = ZONES_PALETTE[i % ZONES_PALETTE.length];
    return `<div class="dim-item">
      <span class="dim-dot" style="background:${pal.base};border:1.5px solid ${pal.stroke}"></span>
      <span>Блок ${i+1} — ${z.zone_w_cm} × ${z.zone_d_cm} × ${z.zone_h_cm} см</span>
    </div>`;
  }).join("");
}

// ── Full page HTML ─────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Уместно — схема хранения</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

  body {
    font-family: 'Manrope', sans-serif;
    background: ${C.cream};
    color: ${C.text};
    padding: 48px 32px;
    max-width: 1080px;
    margin: 0 auto;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Header ── */
  .page-title {
    font-family: 'Lora', Georgia, serif;
    font-size: 30px;
    font-weight: 400;
    letter-spacing: -0.02em;
    margin-bottom: 8px;
    color: ${C.text};
  }
  .page-sub {
    font-size: 14px;
    color: ${C.textLight};
    margin-bottom: 36px;
    font-weight: 400;
  }

  /* ── Info cards ── */
  .info-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 36px;
  }
  @media (max-width: 720px) { .info-row { grid-template-columns: 1fr 1fr; } }

  .info-card {
    background: ${C.surface};
    border-radius: 14px;
    padding: 18px 20px;
    border: 1px solid ${C.border};
    box-shadow: 0 1px 4px rgba(90,58,26,0.06);
  }
  .info-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: ${C.textLight};
    margin-bottom: 8px;
  }
  .info-value {
    font-size: 15px;
    font-weight: 600;
    color: ${C.text};
    line-height: 1.35;
  }

  /* ── Main layout ── */
  .layout {
    display: grid;
    grid-template-columns: 58% 1fr;
    gap: 28px;
    align-items: start;
  }
  @media (max-width: 720px) { .layout { grid-template-columns: 1fr; } }

  /* ── Left ── */
  .scheme-card {
    background: ${C.surface};
    border-radius: 20px;
    padding: 28px;
    border: 1px solid ${C.border};
    box-shadow: 0 2px 12px rgba(90,58,26,0.07);
  }
  .scheme-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: ${C.textLight};
    margin-bottom: 20px;
  }
  .dims { margin-top: 22px; }
  .dims-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: ${C.textLight};
    margin-bottom: 12px;
  }
  .dim-item {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; font-weight: 500;
    color: ${C.textMid};
    margin-bottom: 8px;
  }
  .dim-dot { width:14px; height:14px; border-radius:50%; flex-shrink:0; }

  /* ── Right ── */
  .right { display:flex; flex-direction:column; gap:14px; }

  .card {
    background: ${C.surface};
    border-radius: 16px;
    padding: 22px 24px;
    border: 1px solid ${C.border};
    box-shadow: 0 1px 6px rgba(90,58,26,0.06);
  }
  .card-title {
    font-size: 14px;
    font-weight: 700;
    color: ${C.text};
    margin-bottom: 16px;
    letter-spacing: -0.01em;
  }

  /* What & where */
  .list-item {
    display:flex; align-items:center; gap:12px;
    font-size:13px; font-weight:500;
    color:${C.textMid};
    margin-bottom: 11px;
  }
  .zone-dot {
    width:26px; height:26px; border-radius:8px;
    display:flex; align-items:center; justify-content:center;
    font-size:12px; font-weight:700;
    flex-shrink:0; color:${C.text};
  }

  /* Folding */
  .fold-item {
    display:flex; gap:14px; margin-bottom:14px; align-items:flex-start;
  }
  .fold-icon { font-size:22px; flex-shrink:0; line-height:1; margin-top:1px; }
  .fold-name { font-size:13px; font-weight:600; color:${C.text}; margin-bottom:3px; }
  .fold-hint { font-size:12px; color:${C.textLight}; line-height:1.45; }

  /* Why */
  .why-item {
    display:flex; gap:10px;
    font-size:13px; font-weight:500;
    color:${C.textMid};
    margin-bottom:10px; line-height:1.45;
  }
  .check { color:${C.sage}; font-weight:700; flex-shrink:0; font-size:14px; }

  /* Warning */
  .warn {
    background: #FDF0EA;
    border-left: 3px solid ${C.accent};
    padding:14px 18px;
    border-radius:12px;
    font-size:13px;
    color:${C.textMid};
    line-height:1.6;
  }
</style>
</head>
<body>

<h1 class="page-title">Ваша схема хранения готова</h1>
<p class="page-sub">Персональный результат на основе введённых вами параметров</p>

<div class="info-row">${infoCardsHtml()}</div>

<div class="layout">
  <div class="left">
    <div class="scheme-card">
      <div class="scheme-title">Схема ящика — вид сверху</div>
      ${buildSvg(zones, input.drawer_width_cm, input.drawer_depth_cm)}
      <div class="dims">
        <div class="dims-title">Размеры блоков</div>
        ${dimensionsHtml()}
      </div>
    </div>
  </div>

  <div class="right">
    <div class="card">
      <div class="card-title">Что и где хранить</div>
      ${whatWhereHtml()}
    </div>
    <div class="card">
      <div class="card-title">Как сложить вещи</div>
      ${foldingHtml()}
    </div>
    <div class="card">
      <div class="card-title">Почему схема подходит</div>
      ${whyHtml()}
    </div>
    ${warnings.length ? `<div class="warn">${warnings.map(w=>`<div>⚠ ${w}</div>`).join("")}</div>` : ""}
  </div>
</div>

</body>
</html>`;

fs.writeFileSync("preview-scheme.html", html);
console.log("✓ preview-scheme.html обновлён");
