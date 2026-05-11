// Generates a standalone HTML preview of the result page
// Run: node preview-scheme.mjs
// Then open: preview-scheme.html in a browser

import { runUmestnoEngine } from "./dist/engine/index.js";
import fs from "fs";

// --- Sample input ---
const input = {
  drawer_width_cm: 80,
  drawer_depth_cm: 45,
  drawer_height_cm: 15,
  storage_category: "underwear",
  priority: "convenient",
  items: [
    { content_type: "panties",       volume_level: "medium" },
    { content_type: "socks_regular", volume_level: "small"  },
    { content_type: "bras",          volume_level: "small"  },
  ],
};

const { result } = runUmestnoEngine(input);
if (!result) { console.error("Engine returned no result"); process.exit(1); }

const zones      = result.scheme.assigned_zones;
const whatWhere  = result.what_to_store_where;
const warnings   = [...result.scheme.warnings, ...result.scheme.content_warnings.map(w => w.message)];
const drawer     = { w_cm: input.drawer_width_cm, d_cm: input.drawer_depth_cm };

// --- Brand palette ---
const BRAND = {
  frame: "#C4A882", frameInner: "#E8DCCF", drawerBg: "#F5EFE6",
  text: "#2E2E2E", textLight: "#6B5E52", accent: "#D08A72",
  sage: "#A6B49B", cream: "#F7F4EF", white: "#FFFFFF",
};
const ZONE_FILLS   = ["#E9E1D6","#A6B49B","#C8B9AC","#D4BFB0","#B5C0AF","#DDD0C4"];
const ZONE_STROKES = ["#C8B0A0","#8A9E8E","#A89990","#B5A090","#98A894","#BCA898"];

// --- Translations ---
const CONTENT_RU = {
  socks_regular:"Носки", panties:"Трусы", boxers:"Боксёры", bras:"Бюстгальтеры",
  tights:"Колготки", tshirts:"Майки", jeans:"Джинсы", sport_tops:"Спорт-топы",
  thermals:"Термобельё", pajamas:"Пижамы", nightgowns:"Ночные рубашки",
  longsleeves:"Лонгсливы", sweaters:"Свитеры", leggings:"Леггинсы",
  shorts:"Шорты", belts:"Ремни", jewelry_large:"Украшения",
  jewelry_small:"Бижутерия", scarves:"Шарфы", ties:"Галстуки", swimwear:"Купальники",
};
const PRIORITY_RU = { convenient:"Удобно", capacity:"Вместительно", budget:"Бюджетно" };
const CATEGORY_RU = { underwear:"Нижнее бельё", soft_clothes:"Мягкая одежда", accessories:"Аксессуары", mixed:"Смешанное" };

// --- SVG ---
const SCALE=6, FRAME_PAD=14, ZONE_GAP=3, ZONE_R=6, FRAME_R=10;

function buildSvg(zones, drawer) {
  const iW = drawer.w_cm*SCALE, iH = drawer.d_cm*SCALE;
  const tW = iW+FRAME_PAD*2, tH = iH+FRAME_PAD*2;
  const half = ZONE_GAP/2;
  const zoneEls = zones.map((z, i) => {
    const px=FRAME_PAD+z.x_cm*SCALE+half, py=FRAME_PAD+z.y_cm*SCALE+half;
    const pw=z.assigned_w_cm*SCALE-ZONE_GAP, ph=z.assigned_d_cm*SCALE-ZONE_GAP;
    const cx=px+pw/2, cy=py+ph/2;
    const bfs=Math.max(7,Math.min(10,ph*0.18)), nfs=Math.max(8,Math.min(13,ph*0.22));
    const label = CONTENT_RU[z.content_type] ?? z.content_type;
    return `<g class="zone">
      <rect x="${px}" y="${py}" width="${pw}" height="${ph}"
        fill="${ZONE_FILLS[i%ZONE_FILLS.length]}" stroke="${ZONE_STROKES[i%ZONE_STROKES.length]}"
        stroke-width="1" rx="${ZONE_R}" class="zone-rect"/>
      <text x="${cx}" y="${cy-nfs*0.6}" text-anchor="middle"
        font-family="Georgia,serif" font-size="${bfs}" fill="${BRAND.textLight}">Блок ${i+1}</text>
      <text x="${cx}" y="${cy+nfs*0.8}" text-anchor="middle"
        font-family="Georgia,serif" font-size="${nfs}" font-weight="600" fill="${BRAND.text}">— ${label}</text>
    </g>`;
  }).join("");
  return `<svg viewBox="0 0 ${tW} ${tH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:560px;height:auto">
    <rect x="0" y="0" width="${tW}" height="${tH}" fill="${BRAND.frame}" rx="${FRAME_R}"/>
    <rect x="${FRAME_PAD-4}" y="${FRAME_PAD-4}" width="${iW+8}" height="${iH+8}" fill="${BRAND.frameInner}" rx="${FRAME_R-2}"/>
    <rect x="${FRAME_PAD}" y="${FRAME_PAD}" width="${iW}" height="${iH}" fill="${BRAND.drawerBg}" rx="4"/>
    ${zoneEls}
  </svg>`;
}

// --- Data helpers ---
const itemsLabel = input.items.map(it => CONTENT_RU[it.content_type] ?? it.content_type).join(", ");
const priorityLabel = PRIORITY_RU[input.priority] ?? input.priority;
const categoryLabel = CATEGORY_RU[input.storage_category] ?? input.storage_category;

function infoCardsHtml() {
  const cards = [
    { label: "Место хранения", value: "Выдвижной ящик" },
    { label: "Размеры", value: `Ш ${input.drawer_width_cm} × Г ${input.drawer_depth_cm} × В ${input.drawer_height_cm} см` },
    { label: "Вы выбрали хранить", value: itemsLabel },
    { label: "Ваш приоритет", value: priorityLabel },
  ];
  return cards.map(c => `
    <div class="info-card">
      <div class="info-label">${c.label}</div>
      <div class="info-value">${c.value}</div>
    </div>`).join("");
}

function whatWhereHtml() {
  return whatWhere.map((w, i) => `
    <div class="list-item">
      <span class="num">${i+1}</span>
      <span>Блок ${i+1} — ${CONTENT_RU[w.content_type] ?? w.content_type}</span>
    </div>`).join("");
}

function foldingHtml() {
  return whatWhere.map(w => `
    <div class="fold-item">
      <span class="fold-dot">○</span>
      <span><b>${CONTENT_RU[w.content_type] ?? w.content_type}</b> — ${w.instruction}</span>
    </div>`).join("");
}

function whyHtml() {
  const items = [
    `Подобрана точно под ваши размеры: ${input.drawer_width_cm} × ${input.drawer_depth_cm} × ${input.drawer_height_cm} см`,
    `Учитывает все выбранные типы вещей`,
    `Оптимизирована под приоритет «${priorityLabel}»`,
    result.scheme.fit_status === "fit_all" ? `Все блоки входят в ящик без перекрытий` : null,
  ].filter(Boolean);
  return items.map(t => `
    <div class="why-item">
      <span class="check">✓</span><span>${t}</span>
    </div>`).join("");
}

function dimensionsHtml() {
  return zones.map((z, i) => `
    <div class="dim-item">
      <span class="dot" style="background:${ZONE_FILLS[i%ZONE_FILLS.length]};border:1px solid ${ZONE_STROKES[i%ZONE_STROKES.length]}"></span>
      <span>Блок ${i+1} — ${z.zone_w_cm} × ${z.zone_d_cm} × ${z.zone_h_cm} см</span>
    </div>`).join("");
}

// --- Full HTML ---
const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Уместно — схема хранения</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; background: ${BRAND.cream}; color: ${BRAND.text}; padding: 40px 24px; max-width: 1040px; margin: 0 auto; }

  /* Header */
  .page-title { font-size: 26px; font-weight: normal; margin-bottom: 6px; }
  .page-sub { color: ${BRAND.textLight}; font-size: 14px; margin-bottom: 28px; font-family: Arial, sans-serif; }

  /* Info cards row */
  .info-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
  @media (max-width: 700px) { .info-row { grid-template-columns: 1fr 1fr; } }
  .info-card { background: ${BRAND.white}; border-radius: 10px; padding: 14px 16px; border: 1px solid ${BRAND.frameInner}; }
  .info-label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: ${BRAND.textLight}; font-family: Arial,sans-serif; margin-bottom: 6px; }
  .info-value { font-size: 14px; font-weight: 600; color: ${BRAND.text}; line-height: 1.3; }

  /* Main layout */
  .layout { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  @media (max-width: 700px) { .layout { grid-template-columns: 1fr; } }

  /* Left column */
  .dims { margin-top: 20px; }
  .dims-title { font-size: 11px; font-weight: 600; margin-bottom: 10px; color: ${BRAND.textLight}; text-transform: uppercase; letter-spacing: .06em; font-family: Arial,sans-serif; }
  .dim-item { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 6px; font-family: Arial,sans-serif; }
  .dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }

  /* Right column */
  .right { display: flex; flex-direction: column; gap: 16px; }
  .card { background: ${BRAND.white}; border-radius: 12px; padding: 18px 20px; }
  .card-title { font-size: 15px; font-weight: 600; margin-bottom: 14px; }
  .list-item { display: flex; align-items: center; gap: 10px; font-size: 13px; margin-bottom: 8px; font-family: Arial,sans-serif; }
  .num { background: ${BRAND.accent}; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; font-family: Arial,sans-serif; }
  .fold-item { display: flex; gap: 10px; font-size: 13px; margin-bottom: 8px; line-height: 1.5; font-family: Arial,sans-serif; }
  .fold-dot { color: ${BRAND.textLight}; flex-shrink: 0; margin-top: 1px; }
  .why-item { display: flex; gap: 10px; font-size: 13px; margin-bottom: 8px; font-family: Arial,sans-serif; }
  .check { color: ${BRAND.sage}; font-weight: bold; flex-shrink: 0; }
  .warn { background: #FEF3EC; border-left: 3px solid ${BRAND.accent}; padding: 12px 16px; border-radius: 8px; font-size: 13px; line-height: 1.6; font-family: Arial,sans-serif; }

  .zone { cursor: default; }
  .zone:hover .zone-rect { stroke: ${BRAND.accent} !important; stroke-width: 2 !important; }
</style>
</head>
<body>

<h1 class="page-title">Ваша схема хранения готова.</h1>
<p class="page-sub">Персональный результат на основе введённых вами параметров</p>

<div class="info-row">
  ${infoCardsHtml()}
</div>

<div class="layout">
  <div class="left">
    ${buildSvg(zones, drawer)}
    <div class="dims">
      <div class="dims-title">Размеры блоков</div>
      ${dimensionsHtml()}
    </div>
  </div>
  <div class="right">
    <div class="card">
      <div class="card-title">Что где хранить</div>
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
console.log("✓ Открой в браузере: preview-scheme.html");
console.log(`  Зон: ${zones.length}, fit_status: ${result.scheme.fit_status}`);
