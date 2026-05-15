import { writeFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import type { DrawerSize, LayoutRuleEvaluation, PlacedZone, SoftHeightWarning, UserInput } from "../types.js";

type Scenario = { id: string; title: string; input: UserInput };
type FreeRectangle = { x_cm: number; y_cm: number; w_cm: number; d_cm: number; h_cm: number };
type EngineOutput = ReturnType<typeof runUmestnoEngine>;

const OUTPUT_PATH = process.argv[2] ?? "/tmp/umestno-scenarios.html";
const RULE_IDS = ["ZONE_INTEGRITY", "D01", "D02", "D03", "D04", "D04b", "D05", "D06"];

const scenarios: Scenario[] = [
  scenario("R1", "Core regression: mixed 80×45×15", 80, 45, 15, "mixed", [
    ["panties", "medium"],
    ["tshirts", "small"],
    ["socks_regular", "large"]
  ]),
  scenario("R2", "Core regression: underwear 120×50×20", 120, 50, 20, "underwear", [
    ["socks_regular", "large"],
    ["panties", "large"],
    ["bras", "medium"]
  ]),
  scenario("R3", "Core regression: underwear 45×80×12", 45, 80, 12, "underwear", [
    ["socks_regular", "medium"],
    ["tights", "small"]
  ]),
  scenario("R4", "Core regression: mixed 90×45×15", 90, 45, 15, "mixed", [
    ["tshirts", "medium"],
    ["belts", "small"],
    ["scarves", "small"]
  ]),
  scenario("R5", "Core regression: underwear 80×40×10", 80, 40, 10, "underwear", [
    ["bras", "medium"],
    ["socks_regular", "medium"]
  ]),
  scenario("R6", "Core regression: mixed 60×40×12", 60, 40, 12, "mixed", [
    ["jeans", "large"],
    ["sweaters", "medium"],
    ["socks_regular", "large"]
  ]),
  scenario("R7", "Core regression: underwear 100×50×15", 100, 50, 15, "underwear", [
    ["panties", "large"],
    ["bras", "large"],
    ["socks_regular", "large"]
  ]),
  scenario("P1", "Placement quality: panties + socks + bras", 80, 45, 15, "underwear", [
    ["panties", "medium"],
    ["socks_regular", "small"],
    ["bras", "small"]
  ]),
  scenario("P2", "Placement quality: panties + bras", 80, 45, 15, "underwear", [
    ["panties", "medium"],
    ["bras", "small"]
  ]),
  scenario("P3", "Placement quality: compact underwear", 50, 40, 15, "underwear", [
    ["panties", "medium"],
    ["socks_regular", "small"],
    ["bras", "small"]
  ]),
  scenario("P4", "Placement quality: soft clothes 80×50×20", 80, 50, 20, "soft_clothes", [
    ["tshirts", "large"],
    ["leggings", "medium"],
    ["sweaters", "medium"]
  ]),
  scenario("P5", "Placement quality: accessories 60×40×10", 60, 40, 10, "accessories", [
    ["belts", "small"],
    ["scarves", "medium"],
    ["jewelry_small", "small"]
  ]),
  scenario("P6", "Placement quality: soft clothes 40×60×20", 40, 60, 20, "soft_clothes", [
    ["jeans", "medium"],
    ["tshirts", "medium"],
    ["longsleeves", "small"]
  ])
];

const renderedAt = new Date().toISOString();
const cards = scenarios.map((item) => renderScenarioCard(item, safeRun(item.input))).join("\n");
const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Umestno engine runtime scenarios</title>
  <style>
    :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f7fb; color: #1f2933; }
    header { padding: 24px 32px; background: #172033; color: #fff; }
    header h1 { margin: 0 0 8px; font-size: 28px; }
    header p { margin: 4px 0; color: #d6deee; }
    main { display: grid; gap: 24px; padding: 24px 32px 48px; }
    section.card { background: #fff; border: 1px solid #d8deea; border-radius: 16px; box-shadow: 0 8px 24px rgb(15 23 42 / 8%); padding: 20px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 16px; }
    .pill { border-radius: 999px; background: #edf2f7; padding: 4px 10px; font-size: 13px; }
    .pill.fit { background: #e6fffa; color: #285e61; font-weight: 700; }
    .pill.warn { background: #fff5db; color: #7a4d00; }
    .grid { display: grid; grid-template-columns: minmax(360px, max-content) minmax(360px, 1fr); gap: 20px; align-items: start; }
    svg { max-width: 100%; height: auto; background: #fafcff; border: 1px solid #ccd6e3; border-radius: 10px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { padding: 7px 8px; border-bottom: 1px solid #e6ebf2; vertical-align: top; text-align: left; }
    th { background: #f3f6fb; font-weight: 700; }
    ul { margin: 8px 0 0 18px; padding: 0; }
    .status-pass { color: #157347; font-weight: 700; }
    .status-violation { color: #b42318; font-weight: 800; }
    .status-opportunity { color: #9a6700; font-weight: 800; }
    .status-report, .status-not_applicable { color: #475467; font-weight: 700; }
    .small { color: #667085; font-size: 12px; }
    .error { color: #b42318; font-weight: 700; }
  </style>
</head>
<body>
  <header>
    <h1>Umestno engine runtime scenarios</h1>
    <p>Static dev/debug visualizer generated at ${escapeHtml(renderedAt)}.</p>
    <p>Orientation: top = дальняя стенка, bottom = ближний край / пользователь. SVG Y is flipped from engine coordinates with <code>display_y = drawer_depth - y - d</code>.</p>
  </header>
  <main>${cards}</main>
</body>
</html>`;

writeFileSync(OUTPUT_PATH, html, "utf8");
console.log(`Wrote ${OUTPUT_PATH}`);

function scenario(
  id: string,
  title: string,
  width: number,
  depth: number,
  height: number,
  storageCategory: UserInput["storage_category"],
  items: Array<[string, NonNullable<UserInput["items"]>[number]["volume_level"]]>
): Scenario {
  return {
    id,
    title,
    input: {
      drawer_width_cm: width,
      drawer_depth_cm: depth,
      drawer_height_cm: height,
      storage_category: storageCategory,
      priority: "convenient",
      items: items.map(([content_type, volume_level]) => ({ content_type, volume_level }))
    }
  };
}

function safeRun(input: UserInput): { ok: true; output: EngineOutput } | { ok: false; error: string } {
  try {
    return { ok: true, output: runUmestnoEngine(input) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function renderScenarioCard(scenarioItem: Scenario, run: ReturnType<typeof safeRun>) {
  const drawerSize: DrawerSize = {
    w_cm: scenarioItem.input.drawer_width_cm,
    d_cm: scenarioItem.input.drawer_depth_cm,
    h_cm: scenarioItem.input.drawer_height_cm
  };
  const itemsLabel = scenarioItem.input.items?.map((item) => `${item.content_type} ${item.volume_level ?? "medium"}`).join(", ") ?? "—";

  if (!run.ok) {
    return `<section class="card"><h2>${escapeHtml(scenarioItem.id)} — ${escapeHtml(scenarioItem.title)}</h2><p class="error">Engine exception: ${escapeHtml(run.error)}</p></section>`;
  }

  const { result, scheme_payload: schemePayload, debug } = run.output;
  const debugRecord = (debug ?? {}) as Record<string, unknown>;
  const fitResult = debugRecord.fit_result as { used_width_cm?: number; used_depth_cm?: number; used_height_cm?: number } | undefined;
  const adjustmentResult = debugRecord.adjustment_result as { adjustment_type?: string } | null | undefined;
  const assignedZones = schemePayload?.assigned_zones ?? [];
  const reserveZones = schemePayload?.reserve_zones ?? [];
  const contentWarnings = schemePayload?.content_warnings ?? [];
  const evaluations = schemePayload?.layout_rule_evaluations ?? [];

  return `<section class="card">
    <h2>${escapeHtml(scenarioItem.id)} — ${escapeHtml(scenarioItem.title)}</h2>
    <div class="meta">
      <span class="pill">drawer ${drawerSize.w_cm}×${drawerSize.d_cm}×${drawerSize.h_cm} cm</span>
      <span class="pill">${escapeHtml(scenarioItem.input.storage_category)}</span>
      <span class="pill">priority ${escapeHtml(scenarioItem.input.priority)}</span>
      <span class="pill fit">fit_status: ${escapeHtml(schemePayload?.fit_status ?? (result ? "unknown" : "validation_failed"))}</span>
      <span class="pill">used ${formatMaybe(fitResult?.used_width_cm)}×${formatMaybe(fitResult?.used_depth_cm)}×${formatMaybe(fitResult?.used_height_cm)} cm</span>
      <span class="pill">adjustment: ${escapeHtml(adjustmentResult?.adjustment_type ?? schemePayload?.adjustment_note ?? "none")}</span>
      ${contentWarnings.length ? `<span class="pill warn">warnings: ${contentWarnings.length}</span>` : ""}
    </div>
    <p><strong>Items:</strong> ${escapeHtml(itemsLabel)}</p>
    <div class="grid">
      <div>${schemePayload ? renderSvg(drawerSize, assignedZones, reserveZones, contentWarnings) : renderValidationFallback()}</div>
      <div>
        <h3>Assigned zones</h3>
        ${renderAssignedZonesTable(assignedZones)}
        <h3>Content warnings</h3>
        ${renderWarnings(contentWarnings)}
        <h3>Layout rule evaluations</h3>
        ${renderRuleEvaluations(evaluations)}
      </div>
    </div>
  </section>`;
}

function renderSvg(drawerSize: DrawerSize, zones: PlacedZone[], reserveZones: FreeRectangle[], warnings: SoftHeightWarning[]) {
  const scale = Math.min(8, Math.max(4, 560 / Math.max(drawerSize.w_cm, drawerSize.d_cm)));
  const pad = { left: 44, right: 24, top: 42, bottom: 54 };
  const innerW = drawerSize.w_cm * scale;
  const innerH = drawerSize.d_cm * scale;
  const width = innerW + pad.left + pad.right;
  const height = innerH + pad.top + pad.bottom;
  const warningZoneIds = new Set(warnings.map((warning) => warning.zone_id));

  return `<svg viewBox="0 0 ${round(width)} ${round(height)}" role="img" aria-label="Drawer diagram">
    <defs>
      <pattern id="pattern-cells" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#2b6cb0" stroke-width="1" opacity="0.45"/></pattern>
      <pattern id="pattern-slots" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M 0 0 L 0 8" fill="none" stroke="#7c3aed" stroke-width="2" opacity="0.35"/></pattern>
      <pattern id="pattern-open" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#2f855a" opacity="0.35"/></pattern>
      <pattern id="pattern-reserve" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M -2 8 L 8 -2 M 2 10 L 10 2" stroke="#98a2b3" stroke-width="1" opacity="0.55"/></pattern>
    </defs>
    <text x="${pad.left + innerW / 2}" y="18" text-anchor="middle" font-size="13" font-weight="700" fill="#344054">дальняя стенка</text>
    <text x="${pad.left + innerW / 2}" y="${height - 16}" text-anchor="middle" font-size="13" font-weight="700" fill="#344054">ближний край / пользователь</text>
    <rect x="${pad.left}" y="${pad.top}" width="${innerW}" height="${innerH}" fill="#fff" stroke="#111827" stroke-width="2"/>
    ${reserveZones.map((rect, index) => renderReserveRect(rect, index, drawerSize, scale, pad)).join("\n")}
    ${zones.map((zone, index) => renderZoneRect(zone, index, drawerSize, scale, pad, warningZoneIds.has(zone.zone_id))).join("\n")}
    <text x="${pad.left}" y="${pad.top + innerH + 22}" font-size="11" fill="#667085">width ${drawerSize.w_cm} cm</text>
    <text x="10" y="${pad.top + innerH / 2}" transform="rotate(-90 10 ${pad.top + innerH / 2})" font-size="11" fill="#667085">depth ${drawerSize.d_cm} cm</text>
  </svg>`;
}

function renderReserveRect(rect: FreeRectangle, index: number, drawerSize: DrawerSize, scale: number, pad: { left: number; top: number }) {
  const x = pad.left + rect.x_cm * scale;
  const y = pad.top + (drawerSize.d_cm - rect.y_cm - rect.d_cm) * scale;
  const w = rect.w_cm * scale;
  const h = rect.d_cm * scale;
  if (w <= 0 || h <= 0) return "";
  return `<g>
    <rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="url(#pattern-reserve)" stroke="#98a2b3" stroke-dasharray="5 3"/>
    ${w > 38 && h > 18 ? `<text x="${round(x + w / 2)}" y="${round(y + h / 2)}" text-anchor="middle" font-size="10" fill="#667085">reserve ${index + 1}</text>` : ""}
  </g>`;
}

function renderZoneRect(zone: PlacedZone, index: number, drawerSize: DrawerSize, scale: number, pad: { left: number; top: number }, hasWarning: boolean) {
  const x = pad.left + zone.x_cm * scale;
  const y = pad.top + (drawerSize.d_cm - zone.y_cm - zone.assigned_d_cm) * scale;
  const w = zone.assigned_w_cm * scale;
  const h = zone.assigned_d_cm * scale;
  const fill = { cells: "#bee3f8", slots: "#ddd6fe", open: "#c6f6d5", dividers: "#fed7aa" }[zone.division_type] ?? "#e2e8f0";
  const pattern = { cells: "url(#pattern-cells)", slots: "url(#pattern-slots)", open: "url(#pattern-open)", dividers: "#fed7aa" }[zone.division_type] ?? fill;
  const label = `${zone.content_type} (${zone.division_type})`;
  const dims = `${formatNumber(zone.assigned_w_cm)}×${formatNumber(zone.assigned_d_cm)}×${formatNumber(zone.assigned_h_cm)} cm`;
  const textX = x + w / 2;
  const textY = y + h / 2 - 4;
  return `<g>
    <rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="${fill}" stroke="#1f2937" stroke-width="1.4"/>
    <rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="${pattern}" opacity="0.85"/>
    <rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="none" stroke="${hasWarning ? "#d97706" : "#1f2937"}" stroke-width="${hasWarning ? 3 : 1.4}"/>
    ${hasWarning ? `<circle cx="${round(x + w - 12)}" cy="${round(y + 12)}" r="9" fill="#f59e0b"/><text x="${round(x + w - 12)}" y="${round(y + 16)}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">!</text>` : ""}
    <text x="${round(textX)}" y="${round(textY)}" text-anchor="middle" font-size="${w < 80 ? 10 : 12}" font-weight="700" fill="#101828">${escapeHtml(label)}</text>
    <text x="${round(textX)}" y="${round(textY + 15)}" text-anchor="middle" font-size="10" fill="#344054">${escapeHtml(dims)}</text>
    <text x="${round(x + 4)}" y="${round(y + 12)}" font-size="9" fill="#475467">#${index + 1}</text>
  </g>`;
}

function renderAssignedZonesTable(zones: PlacedZone[]) {
  if (!zones.length) return `<p class="small">No assigned zones.</p>`;
  return `<table><thead><tr><th>#</th><th>zone</th><th>type</th><th>x,y</th><th>w×d×h</th><th>capacity</th></tr></thead><tbody>${zones.map((zone, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(zone.zone_id)}<br><span class="small">${escapeHtml(zone.content_type)}</span></td><td>${escapeHtml(zone.division_type)}</td><td>${formatNumber(zone.x_cm)}, ${formatNumber(zone.y_cm)}</td><td>${formatNumber(zone.assigned_w_cm)}×${formatNumber(zone.assigned_d_cm)}×${formatNumber(zone.assigned_h_cm)}</td><td>${zone.capacity}/${zone.count}</td></tr>`).join("")}</tbody></table>`;
}

function renderWarnings(warnings: SoftHeightWarning[]) {
  if (!warnings.length) return `<p class="small">No content warnings.</p>`;
  return `<ul>${warnings.map((warning) => `<li><strong>${escapeHtml(warning.zone_id)}</strong>: ${escapeHtml(warning.warning_code)} — ${escapeHtml(warning.message)} <span class="small">needed ${formatNumber(warning.needed_h_cm)} cm, drawer ${formatNumber(warning.drawer_h_cm)} cm</span></li>`).join("")}</ul>`;
}

function renderRuleEvaluations(evaluations: LayoutRuleEvaluation[]) {
  const byId = new Map(evaluations.map((evaluation) => [evaluation.rule_id, evaluation]));
  return `<table><thead><tr><th>rule</th><th>status</th><th>message</th></tr></thead><tbody>${RULE_IDS.map((ruleId) => {
    const evaluation = byId.get(ruleId);
    const status = evaluation?.status ?? "not_reported";
    return `<tr><td>${escapeHtml(ruleId)}</td><td class="status-${escapeHtml(status)}">${escapeHtml(status)}</td><td>${escapeHtml(evaluation?.message ?? "Not returned by engine.")}${evaluation?.details ? `<details><summary>details</summary><pre>${escapeHtml(JSON.stringify(evaluation.details, null, 2))}</pre></details>` : ""}</td></tr>`;
  }).join("")}</tbody></table>`;
}

function renderValidationFallback() {
  return `<p class="error">No scheme_payload was returned; diagram unavailable.</p>`;
}

function formatMaybe(value: number | undefined) {
  return typeof value === "number" ? formatNumber(value) : "—";
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function round(value: number) {
  return Number(value.toFixed(3));
}

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
