// Shared SVG generation logic — used by DrawerSchemeRenderer (React) and pdf.server.ts

export interface ZoneData {
  zone_id: string;
  content_type: string;
  x_cm: number;
  y_cm: number;
  assigned_w_cm: number;
  assigned_d_cm: number;
}

export interface DrawerSize {
  w_cm: number;
  d_cm: number;
}

const CONTENT_TYPE_RU: Record<string, string> = {
  socks_regular: "Носки",
  panties: "Трусы",
  boxers: "Боксёры",
  bras: "Бюстгальтеры",
  tights: "Колготки",
  tshirts: "Майки",
  jeans: "Джинсы",
  sport_tops: "Спорт-топы",
  thermals: "Термобельё",
  pajamas: "Пижамы",
  nightgowns: "Ночные рубашки",
  longsleeves: "Лонгсливы",
  sweaters: "Свитеры",
  leggings: "Леггинсы",
  shorts: "Шорты",
  belts: "Ремни",
  jewelry_large: "Украшения",
  jewelry_small: "Бижутерия",
  scarves: "Шарфы",
  ties: "Галстуки",
  swimwear: "Купальники",
};

// Brand palette zone fill rotation
const ZONE_FILLS = ["#E9E1D6", "#A6B49B", "#C8B9AC", "#D4BFB0", "#B5C0AF", "#DDD0C4"];
const ZONE_STROKES = ["#C8B0A0", "#8A9E8E", "#A89990", "#B5A090", "#98A894", "#BCA898"];

export const BRAND = {
  frame: "#C4A882",
  frameInner: "#E8DCCF",
  drawerBg: "#F5EFE6",
  text: "#2E2E2E",
  textLight: "#6B5E52",
  accent: "#D08A72",
  sage: "#A6B49B",
  cream: "#F7F4EF",
};

const SCALE = 6;        // px per cm
const FRAME_PAD = 14;   // px, drawer frame thickness
const ZONE_GAP = 3;     // px gap between zones
const ZONE_RADIUS = 6;
const FRAME_RADIUS = 10;

export function buildSchemeViewBox(drawer: DrawerSize) {
  const innerW = drawer.w_cm * SCALE;
  const innerH = drawer.d_cm * SCALE;
  const totalW = innerW + FRAME_PAD * 2;
  const totalH = innerH + FRAME_PAD * 2;
  return { innerW, innerH, totalW, totalH };
}

export interface ZoneRenderData extends ZoneData {
  index: number;   // 1-based block number
  fillColor: string;
  strokeColor: string;
  labelRu: string;
  // pixel positions
  px: number;
  py: number;
  pw: number;
  ph: number;
}

export function computeZoneRenders(zones: ZoneData[]): ZoneRenderData[] {
  return zones.map((z, i) => {
    const half = ZONE_GAP / 2;
    return {
      ...z,
      index: i + 1,
      fillColor: ZONE_FILLS[i % ZONE_FILLS.length],
      strokeColor: ZONE_STROKES[i % ZONE_STROKES.length],
      labelRu: CONTENT_TYPE_RU[z.content_type] ?? z.content_type,
      px: FRAME_PAD + z.x_cm * SCALE + half,
      py: FRAME_PAD + z.y_cm * SCALE + half,
      pw: z.assigned_w_cm * SCALE - ZONE_GAP,
      ph: z.assigned_d_cm * SCALE - ZONE_GAP,
    };
  });
}

// Pure SVG string — used in PDF and as dangerouslySetInnerHTML fallback
export function buildSchemeSvgString(zones: ZoneData[], drawer: DrawerSize): string {
  const { innerW, innerH, totalW, totalH } = buildSchemeViewBox(drawer);
  const zoneRenders = computeZoneRenders(zones);

  const frameRect = `<rect x="0" y="0" width="${totalW}" height="${totalH}"
    fill="${BRAND.frame}" rx="${FRAME_RADIUS}" ry="${FRAME_RADIUS}"/>`;

  const innerRect = `<rect x="${FRAME_PAD - 4}" y="${FRAME_PAD - 4}"
    width="${innerW + 8}" height="${innerH + 8}"
    fill="${BRAND.frameInner}" rx="${FRAME_RADIUS - 2}" ry="${FRAME_RADIUS - 2}"/>`;

  const bgRect = `<rect x="${FRAME_PAD}" y="${FRAME_PAD}"
    width="${innerW}" height="${innerH}"
    fill="${BRAND.drawerBg}" rx="4" ry="4"/>`;

  const zoneEls = zoneRenders.map((z) => {
    const cx = z.px + z.pw / 2;
    const cy = z.py + z.ph / 2;
    const blockLine = `Блок ${z.index}`;
    const nameLine = `— ${z.labelRu}`;
    // Adjust font sizes for small zones
    const blockFs = Math.max(7, Math.min(10, z.ph * 0.18));
    const nameFs = Math.max(8, Math.min(13, z.ph * 0.22));
    return `
    <rect x="${z.px}" y="${z.py}" width="${z.pw}" height="${z.ph}"
      fill="${z.fillColor}" stroke="${z.strokeColor}" stroke-width="1" rx="${ZONE_RADIUS}" ry="${ZONE_RADIUS}"/>
    <text x="${cx}" y="${cy - nameFs * 0.6}" text-anchor="middle"
      font-family="Arial, sans-serif" font-size="${blockFs}" fill="${BRAND.textLight}">${blockLine}</text>
    <text x="${cx}" y="${cy + nameFs * 0.8}" text-anchor="middle"
      font-family="Arial, sans-serif" font-size="${nameFs}" font-weight="600" fill="${BRAND.text}">${nameLine}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg">
  ${frameRect}
  ${innerRect}
  ${bgRect}
  ${zoneEls}
</svg>`;
}
