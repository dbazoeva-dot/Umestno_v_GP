// Server-only: PDF generation via Puppeteer
import type { PlacedZone, SoftHeightWarning } from "@engine/types.js";

export interface PdfData {
  variant: "A" | "B";
  drawerSize: { w_cm: number; d_cm: number; h_cm: number };
  assignedZones: PlacedZone[];
  warnings: string[];
  contentWarnings: SoftHeightWarning[];
  whatToStoreWhere: Array<{ content_type: string; zone_id: string; division_type: string; instruction: string }>;
}

function buildSvgVisualization(zones: PlacedZone[], drawerW: number, drawerD: number): string {
  const scale = 4; // px per cm
  const padding = 16;
  const svgW = drawerW * scale + padding * 2;
  const svgH = drawerD * scale + padding * 2;

  const ZONE_COLORS: Record<string, string> = {
    underwear: "#dbeafe",
    soft_clothes: "#dcfce7",
    accessories: "#fef9c3",
    mixed: "#f3e8ff",
  };

  const zoneRects = zones.map((z) => {
    const x = padding + z.x_cm * scale;
    const y = padding + z.y_cm * scale;
    const w = z.assigned_w_cm * scale;
    const h = z.assigned_d_cm * scale;
    const fill = ZONE_COLORS[z.storage_category as string] ?? "#f1f5f9";
    const label = z.content_type.replace(/_/g, " ");
    return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#64748b" stroke-width="1" rx="2"/>
      <text x="${x + w / 2}" y="${y + h / 2 - 4}" text-anchor="middle" font-size="8" fill="#1e293b">${label}</text>
      <text x="${x + w / 2}" y="${y + h / 2 + 8}" text-anchor="middle" font-size="7" fill="#475569">${z.zone_id}</text>`;
  }).join("");

  return `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${svgW}" height="${svgH}" fill="#f8fafc"/>
    <rect x="${padding}" y="${padding}" width="${drawerW * scale}" height="${drawerD * scale}" fill="white" stroke="#334155" stroke-width="2"/>
    ${zoneRects}
  </svg>`;
}

function buildHtml(data: PdfData): string {
  const { variant, drawerSize, assignedZones, warnings, contentWarnings, whatToStoreWhere } = data;
  const showDimensions = variant === "A";
  const svg = buildSvgVisualization(assignedZones, drawerSize.w_cm, drawerSize.d_cm);

  const zoneRows = assignedZones.map((z) => {
    const instruction = whatToStoreWhere.find((w) => w.zone_id === z.zone_id)?.instruction ?? "";
    return `<tr>
      <td>${z.zone_id}</td>
      <td>${z.content_type.replace(/_/g, " ")}</td>
      <td>${z.division_type}</td>
      ${showDimensions ? `<td>${z.zone_w_cm} × ${z.zone_d_cm} × ${z.zone_h_cm} см</td>` : ""}
      <td>${instruction}</td>
    </tr>`;
  }).join("");

  const warningItems = [
    ...warnings.map((w) => `<li>${w}</li>`),
    ...contentWarnings.map((w) => `<li>${w.message}</li>`),
  ].join("");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 32px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #64748b; margin-bottom: 24px; }
  .section { margin-bottom: 24px; }
  h2 { font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 11px; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  ul { margin: 0; padding-left: 20px; }
  li { margin-bottom: 4px; }
  .svg-wrap { text-align: center; margin-bottom: 8px; }
</style>
</head>
<body>
<h1>Уместно</h1>
<p class="subtitle">Схема организации ящика — ${drawerSize.w_cm} × ${drawerSize.d_cm} × ${drawerSize.h_cm} см</p>

<div class="section">
  <h2>Схема расположения зон</h2>
  <div class="svg-wrap">${svg}</div>
</div>

<div class="section">
  <h2>Таблица зон</h2>
  <table>
    <thead><tr>
      <th>Зона</th>
      <th>Тип вещей</th>
      <th>Органайзер</th>
      ${showDimensions ? "<th>Размер (Ш × Г × В)</th>" : ""}
      <th>Как складывать</th>
    </tr></thead>
    <tbody>${zoneRows}</tbody>
  </table>
</div>

${warningItems ? `<div class="section">
  <h2>Важно учесть</h2>
  <ul>${warningItems}</ul>
</div>` : ""}

<p style="color:#94a3b8;font-size:10px;margin-top:32px;">Сгенерировано сервисом Уместно</p>
</body>
</html>`;
}

export async function generatePdf(data: PdfData): Promise<Buffer> {
  // Dynamic import keeps puppeteer out of the client bundle
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(data), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
