// Server-only: PDF generation via Puppeteer
import type { PlacedZone, SoftHeightWarning } from "@engine/types.js";
import { buildSchemeSvgString, BRAND } from "@/lib/schemeSvg";

export interface PdfData {
  variant: "A" | "B";
  drawerSize: { w_cm: number; d_cm: number; h_cm: number };
  assignedZones: PlacedZone[];
  warnings: string[];
  contentWarnings: SoftHeightWarning[];
  whatToStoreWhere: Array<{ content_type: string; zone_id: string; division_type: string; instruction: string }>;
}

function buildSvgVisualization(zones: PlacedZone[], drawerW: number, drawerD: number): string {
  const zoneData = zones.map((z) => ({
    zone_id: z.zone_id,
    content_type: z.content_type,
    x_cm: z.x_cm,
    y_cm: z.y_cm,
    assigned_w_cm: z.assigned_w_cm,
    assigned_d_cm: z.assigned_d_cm,
  }));
  return buildSchemeSvgString(zoneData, { w_cm: drawerW, d_cm: drawerD });
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
  body { font-family: Arial, sans-serif; font-size: 12px; color: ${BRAND.text}; padding: 32px; background: ${BRAND.cream}; }
  h1 { font-size: 22px; margin-bottom: 4px; color: ${BRAND.text}; }
  .subtitle { color: ${BRAND.textLight}; margin-bottom: 24px; font-size: 11px; }
  .section { margin-bottom: 24px; }
  h2 { font-size: 13px; border-bottom: 2px solid ${BRAND.accent}; padding-bottom: 4px; margin-bottom: 12px; color: ${BRAND.text}; }
  table { width: 100%; border-collapse: collapse; }
  th { background: ${BRAND.frameInner}; text-align: left; padding: 6px 8px; font-size: 10px; color: ${BRAND.textLight}; }
  td { padding: 6px 8px; border-bottom: 1px solid ${BRAND.frameInner}; vertical-align: top; }
  ul { margin: 0; padding-left: 20px; }
  li { margin-bottom: 4px; }
  .svg-wrap { text-align: center; margin-bottom: 8px; }
  .footer { color: ${BRAND.textLight}; font-size: 9px; margin-top: 32px; border-top: 1px solid ${BRAND.frameInner}; padding-top: 8px; }
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

<p class="footer">Сгенерировано сервисом Уместно</p>
</body>
</html>`;
}

export async function generatePdf(data: PdfData): Promise<Buffer> {
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
