import { runUmestnoEngine } from "./dist/engine/index.js";
import fs from "fs";

const input = {
  drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15,
  storage_category: "underwear", priority: "convenient",
  items: [
    { content_type: "panties",       volume_level: "medium" },
    { content_type: "socks_regular", volume_level: "small"  },
    { content_type: "bras",          volume_level: "small"  },
  ],
};

const { result } = runUmestnoEngine(input);
if (!result) { console.error("Engine returned no result"); process.exit(1); }

const zones     = result.scheme.assigned_zones;
const whatWhere = result.what_to_store_where;
const warnings  = [...result.scheme.warnings, ...result.scheme.content_warnings.map(w => w.message)];

const BRAND = {
  frame: "#BFA07A", frameInner: "#E2D4C0", drawerBg: "#F0E8DC",
  text: "#2E2E2E", textLight: "#7A6A5A", accent: "#D08A72",
  sage: "#A6B49B", cream: "#F7F4EF", white: "#FFFFFF",
  border: "#E5DDD4",
};
const ZONE_FILLS   = ["#EDE5D8","#A6B49B","#C8B9AC","#D4BFB0","#B5C0AF","#DDD0C4"];
const ZONE_STROKES = ["#C8A898","#7A9980","#A89080","#B09080","#889480","#BCA090"];

const CONTENT_RU = {
  socks_regular:"Носки", panties:"Трусы", boxers:"Боксёры", bras:"Бюстгальтеры",
  tights:"Колготки", tshirts:"Майки", jeans:"Джинсы", sport_tops:"Спорт-топы",
  thermals:"Термобельё", pajamas:"Пижамы", nightgowns:"Ночные рубашки",
  longsleeves:"Лонгсливы", sweaters:"Свитеры", leggings:"Леггинсы",
  shorts:"Шорты", belts:"Ремни", jewelry_large:"Украшения",
  jewelry_small:"Бижутерия", scarves:"Шарфы", ties:"Галстуки", swimwear:"Купальники",
};
const PRIORITY_RU  = { convenient:"Удобно", capacity:"Вместительно", budget:"Бюджетно" };
const CATEGORY_RU  = { underwear:"Нижнее бельё", soft_clothes:"Мягкая одежда", accessories:"Аксессуары", mixed:"Смешанное" };
const ITEM_ICONS   = {
  socks_regular:"🧦", panties:"🩲", boxers:"🩲", bras:"👙", tights:"🩱",
  tshirts:"👕", jeans:"👖", sport_tops:"🩱", thermals:"🧥", pajamas:"🌙",
  nightgowns:"🌙", longsleeves:"👕", sweaters:"🧥", leggings:"🩱",
  shorts:"🩳", belts:"👔", jewelry_large:"💍", jewelry_small:"📿",
  scarves:"🧣", ties:"👔", swimwear:"👙",
};

const SCALE=7, FRAME_PAD=16, ZONE_GAP=4, ZONE_R=8, FRAME_R=14;

function buildSvg(zones, w, d) {
  const iW=w*SCALE, iH=d*SCALE;
  const tW=iW+FRAME_PAD*2, tH=iH+FRAME_PAD*2;
  const half=ZONE_GAP/2;

  const defs = `<defs>
    <filter id="zshadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#00000018"/>
    </filter>
    <linearGradient id="drawerbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F5EDE0"/>
      <stop offset="100%" stop-color="#EAE0D0"/>
    </linearGradient>
    <linearGradient id="framebg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#CDB08A"/>
      <stop offset="100%" stop-color="#B8976A"/>
    </linearGradient>
  </defs>`;

  const zoneEls = zones.map((z, i) => {
    const px=FRAME_PAD+z.x_cm*SCALE+half, py=FRAME_PAD+z.y_cm*SCALE+half;
    const pw=z.assigned_w_cm*SCALE-ZONE_GAP, ph=z.assigned_d_cm*SCALE-ZONE_GAP;
    const cx=px+pw/2, cy=py+ph/2;
    const numFs = Math.max(7, Math.min(11, ph*0.16));
    const nameFs = Math.max(9, Math.min(14, ph*0.25));
    const label = CONTENT_RU[z.content_type] ?? z.content_type;
    // Two lines: num line sits above center, name line below
    const numY  = cy - nameFs*0.55;
    const nameY = cy + nameFs*0.75;
    return `<g filter="url(#zshadow)">
      <rect x="${px}" y="${py}" width="${pw}" height="${ph}"
        fill="${ZONE_FILLS[i%ZONE_FILLS.length]}" stroke="${ZONE_STROKES[i%ZONE_STROKES.length]}"
        stroke-width="1" rx="${ZONE_R}"/>
    </g>
    <text x="${cx}" y="${numY}" text-anchor="middle"
      font-family="'Helvetica Neue',Arial,sans-serif" font-size="${numFs}"
      letter-spacing="0.04em" fill="${BRAND.textLight}">Блок ${i+1}.</text>
    <text x="${cx}" y="${nameY}" text-anchor="middle"
      font-family="'Helvetica Neue',Arial,sans-serif" font-size="${nameFs}"
      font-weight="700" fill="${BRAND.text}">${label}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${tW} ${tH}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;max-width:580px;height:auto;display:block;border-radius:${FRAME_R}px;
           box-shadow:0 4px 24px rgba(0,0,0,0.10)">
    ${defs}
    <rect x="0" y="0" width="${tW}" height="${tH}" fill="url(#framebg)" rx="${FRAME_R}"/>
    <rect x="${FRAME_PAD-5}" y="${FRAME_PAD-5}" width="${iW+10}" height="${iH+10}"
      fill="${BRAND.frameInner}" rx="${FRAME_R-3}"/>
    <rect x="${FRAME_PAD}" y="${FRAME_PAD}" width="${iW}" height="${iH}"
      fill="url(#drawerbg)" rx="5"/>
    ${zoneEls}
  </svg>`;
}

const itemsLabel    = input.items.map(it => CONTENT_RU[it.content_type] ?? it.content_type).join(", ");
const priorityLabel = PRIORITY_RU[input.priority] ?? input.priority;

function infoCardsHtml() {
  return [
    { label:"Место хранения",    value:"Выдвижной ящик" },
    { label:"Размеры",           value:`Ш&nbsp;${input.drawer_width_cm} × Г&nbsp;${input.drawer_depth_cm} × В&nbsp;${input.drawer_height_cm}&nbsp;см` },
    { label:"Вы выбрали хранить",value:itemsLabel },
    { label:"Ваш приоритет",     value:priorityLabel },
  ].map(c=>`<div class="info-card">
    <div class="info-label">${c.label}</div>
    <div class="info-value">${c.value}</div>
  </div>`).join("");
}

function whatWhereHtml() {
  return whatWhere.map((w, i) => `
    <div class="list-item">
      <span class="num" style="background:${ZONE_FILLS[i%ZONE_FILLS.length]};border:1.5px solid ${ZONE_STROKES[i%ZONE_STROKES.length]};color:${BRAND.text}">${i+1}</span>
      <span>Блок ${i+1} — ${CONTENT_RU[w.content_type] ?? w.content_type}</span>
    </div>`).join("");
}

function foldingHtml() {
  return whatWhere.map(w => {
    const icon = ITEM_ICONS[w.content_type] ?? "○";
    return `<div class="fold-item">
      <span class="fold-icon">${icon}</span>
      <div><b>${CONTENT_RU[w.content_type] ?? w.content_type}</b><br><span class="fold-hint">${w.instruction}</span></div>
    </div>`;
  }).join("");
}

function whyHtml() {
  return [
    `Подобрана точно под ваши размеры: ${input.drawer_width_cm} × ${input.drawer_depth_cm} × ${input.drawer_height_cm} см`,
    `Учитывает все выбранные типы вещей`,
    `Оптимизирована под приоритет «${priorityLabel}»`,
    result.scheme.fit_status === "fit_all" ? `Все блоки входят в ящик без перекрытий` : null,
  ].filter(Boolean).map(t=>`<div class="why-item"><span class="check">✓</span><span>${t}</span></div>`).join("");
}

function dimensionsHtml() {
  return zones.map((z,i)=>`<div class="dim-item">
    <span class="dot" style="background:${ZONE_FILLS[i%ZONE_FILLS.length]};border:1.5px solid ${ZONE_STROKES[i%ZONE_STROKES.length]}"></span>
    <span>Блок ${i+1} — ${z.zone_w_cm} × ${z.zone_d_cm} × ${z.zone_h_cm} см</span>
  </div>`).join("");
}

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Уместно — схема хранения</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    background: ${BRAND.cream};
    color: ${BRAND.text};
    padding: 44px 28px;
    max-width: 1040px;
    margin: 0 auto;
  }

  .page-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 28px;
    font-weight: normal;
    margin-bottom: 6px;
    letter-spacing: -0.01em;
  }
  .page-sub {
    color: ${BRAND.textLight};
    font-size: 14px;
    margin-bottom: 32px;
  }

  .info-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 36px;
  }
  @media (max-width: 680px) { .info-row { grid-template-columns: 1fr 1fr; } }
  .info-card {
    background: ${BRAND.white};
    border-radius: 12px;
    padding: 16px 18px;
    border: 1px solid ${BRAND.border};
  }
  .info-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: ${BRAND.textLight};
    margin-bottom: 7px;
  }
  .info-value {
    font-size: 14px;
    font-weight: 600;
    color: ${BRAND.text};
    line-height: 1.35;
  }

  .layout {
    display: grid;
    grid-template-columns: 55% 1fr;
    gap: 32px;
    align-items: start;
  }
  @media (max-width: 680px) { .layout { grid-template-columns: 1fr; } }

  .dims { margin-top: 18px; }
  .dims-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: ${BRAND.textLight};
    margin-bottom: 10px;
  }
  .dim-item { display:flex; align-items:center; gap:9px; font-size:13px; margin-bottom:7px; color:${BRAND.text}; }
  .dot { width:12px; height:12px; border-radius:50%; flex-shrink:0; }

  .right { display:flex; flex-direction:column; gap:14px; }

  .card {
    background: ${BRAND.white};
    border-radius: 14px;
    padding: 20px 22px;
    border: 1px solid ${BRAND.border};
  }
  .card-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 16px;
    letter-spacing: -0.01em;
  }

  .list-item { display:flex; align-items:center; gap:11px; font-size:13px; margin-bottom:10px; }
  .num {
    width: 26px; height: 26px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 600;
    flex-shrink: 0;
  }

  .fold-item { display:flex; gap:12px; margin-bottom:12px; align-items:flex-start; }
  .fold-icon { font-size:20px; flex-shrink:0; line-height:1; margin-top:1px; }
  .fold-hint { font-size:12px; color:${BRAND.textLight}; margin-top:2px; display:block; }

  .why-item { display:flex; gap:10px; font-size:13px; margin-bottom:9px; line-height:1.4; }
  .check { color:${BRAND.sage}; font-weight:700; flex-shrink:0; }

  .warn {
    background: #FEF3EC;
    border-left: 3px solid ${BRAND.accent};
    padding: 14px 18px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.6;
  }
</style>
</head>
<body>

<h1 class="page-title">Ваша схема хранения готова</h1>
<p class="page-sub">Персональный результат на основе введённых вами параметров</p>

<div class="info-row">${infoCardsHtml()}</div>

<div class="layout">
  <div class="left">
    ${buildSvg(zones, input.drawer_width_cm, input.drawer_depth_cm)}
    <div class="dims">
      <div class="dims-title">Размеры блоков</div>
      ${dimensionsHtml()}
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
console.log("✓ Открой в браузере: preview-scheme.html");
