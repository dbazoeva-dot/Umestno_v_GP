/**
 * Manual scenario runner — 7 test cases for the organizer config engine.
 * Uses ONLY defaultLibraries (no custom or synthetic library extensions).
 * Scenarios with content types absent from the runtime library report
 * UNSUPPORTED_TYPE and show what the engine returns (validation failure).
 */
import { runUmestnoEngine } from "../index.js";
import type { UserInput, PlacedZone, CalculatedZone } from "../types.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function hr(title: string) {
  const line = "─".repeat(70);
  console.log(`\n${line}\n${title}\n${line}`);
}

function printScenarioResult(
  n: number,
  title: string,
  drawerLabel: string,
  input: UserInput
) {
  hr(`СЦЕНАРИЙ ${n}: ${title}\nЯщик: ${drawerLabel}`);

  let output: ReturnType<typeof runUmestnoEngine>;
  try {
    output = runUmestnoEngine(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`ENGINE EXCEPTION: ${msg}`);
    console.log("→ Это означает, что тип вещи отсутствует в runtime-библиотеке (A или B).");
    return;
  }

  if (!output.result || !output.scheme_payload) {
    const validation = output.debug?.["validation_result"] as
      | { ok: boolean; errors: string[]; warnings: string[] }
      | undefined;
    console.log(`fit_status: VALIDATION_FAILED`);
    if (validation) {
      console.log(`errors:   ${validation.errors.join(" | ")}`);
      if (validation.warnings.length) console.log(`warnings: ${validation.warnings.join(" | ")}`);
    }
    return;
  }

  const sp = output.scheme_payload;
  const dbg = output.debug as Record<string, unknown>;

  console.log(`fit_status:         ${sp.fit_status}`);

  // Initial vs final fit
  const initFit = (dbg["fit_result"] as { fit_status?: string } | undefined)?.fit_status;
  if (initFit && initFit !== sp.fit_status) {
    console.log(`initial fit_status: ${initFit} → после корректировки: ${sp.fit_status}`);
  }

  // Counted items
  const counted = dbg["counted_items"] as Array<{ content_type: string; volume_level: string; count: number; count_unit: string }> | undefined;
  if (counted?.length) {
    console.log(`\nПодсчёт вещей:`);
    for (const it of counted) {
      console.log(`  ${it.content_type.padEnd(16)} ${it.volume_level.padEnd(8)} → ${it.count} ${it.count_unit}`);
    }
  }

  // Zone list
  const zones = sp.selected_calculated_zones as CalculatedZone[];
  console.log(`\nЗоны (ш × г × в):`);
  const drawerH = input.drawer_height_cm;
  for (const z of zones) {
    const hOk = z.zone_h_cm <= drawerH;
    const hFlag = hOk ? "✓" : `✗ OVERFLOW (+${(z.zone_h_cm - drawerH).toFixed(1)}cm)`;
    const splitNote = z.split_used ? ` [split lanes=${(z as { lanes_needed?: number }).lanes_needed}]` : "";
    const fallNote = z.original_failed_division ? ` [→ открытая секция (было ${z.original_failed_division})]` : "";
    const rotNote = z.can_rotate ? " [can_rotate]" : "";
    console.log(
      `  ${z.content_type.padEnd(16)} ${z.division_type.padEnd(8)} ` +
      `${z.option_id.padEnd(24)} ${z.zone_w_cm}×${z.zone_d_cm}×${z.zone_h_cm} cm` +
      `  cap=${z.capacity}/${z.count}  h${hFlag}${rotNote}${splitNote}${fallNote}`
    );
  }

  // Placed zones (2D layout)
  const placed = sp.assigned_zones as PlacedZone[];
  console.log(`\nРасположение в ящике (2D):`);
  if (!placed.length) {
    console.log("  (ни одна зона не размещена)");
  }
  for (const p of placed) {
    console.log(
      `  ${p.content_type.padEnd(16)} ${p.division_type.padEnd(8)} ` +
      `pos=(${p.x_cm},${p.y_cm})  ${p.assigned_w_cm}×${p.assigned_d_cm}×${p.assigned_h_cm}`
    );
  }

  // Unplaced
  const unplaced = ((dbg["fit_result"] as { unplaced_zones?: CalculatedZone[] } | undefined)?.unplaced_zones ?? []);
  if (unplaced.length) {
    console.log(`\nНе вошли (${unplaced.length}):`);
    for (const u of unplaced) {
      const reason = u.zone_h_cm > drawerH
        ? `высота ${u.zone_h_cm} > ${drawerH} (OVERFLOW)`
        : u.zone_w_cm > input.drawer_width_cm
          ? `ширина ${u.zone_w_cm} > ${input.drawer_width_cm}`
          : "не хватает места";
      console.log(`  ${u.content_type.padEnd(16)} ${u.division_type}  ${u.zone_w_cm}×${u.zone_d_cm}×${u.zone_h_cm}  → ${reason}`);
    }
  }

  // 2-row split
  const splitUsed = zones.some((z) => z.split_used);
  console.log(`\n2-рядная раскладка (split_used): ${splitUsed ? "ДА" : "нет"}`);

  // Adjustment
  const adjNote = sp.adjustment_note ?? null;
  const adjType = (dbg["adjustment_result"] as { adjustment_type?: string } | null)?.adjustment_type ?? null;
  const adjAttempts = (dbg["adjustment_attempts"] as unknown[] | undefined)?.length ?? 0;
  if (adjType) console.log(`Тип коррекции:       ${adjType}`);
  if (adjAttempts) console.log(`Итераций коррекции:  ${adjAttempts}`);
  if (adjNote) console.log(`Примечание:          ${adjNote}`);

  // Rules applied
  const rulesApplied = (sp.layout_plan as { rules_applied?: string[] }).rules_applied ?? [];
  console.log(`D-правила в layout_plan: ${rulesApplied.join(", ")}`);

  // Positional D-rule checks
  checkDRules(placed, input);

  // SKU
  const skus = (output.result as { sku_matches?: unknown[] } | null)?.sku_matches ?? [];
  console.log(`\nSKU: ${skus.length ? JSON.stringify(skus) : "(каталог пуст — не подобраны)"}`);
}

function checkDRules(placed: PlacedZone[], input: UserInput) {
  if (!placed.length) return;
  const notes: string[] = [];

  const cellsZ = placed.filter((z) => z.division_type === "cells");
  const slotsZ = placed.filter((z) => z.division_type === "slots");
  const openZ  = placed.filter((z) => z.division_type === "open");
  const bras   = placed.find((z) => z.content_type === "bras");
  const socks  = placed.find((z) => z.content_type === "socks_regular");
  const panties = placed.find((z) => z.content_type === "panties");
  const boxers  = placed.find((z) => z.content_type === "boxers");

  // D05: cells zones are adjacent
  if (cellsZ.length >= 2) {
    const sorted = [...cellsZ].sort((a, b) => a.x_cm - b.x_cm);
    let adjacent = true;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i]!.x_cm - (sorted[i - 1]!.x_cm + sorted[i - 1]!.assigned_w_cm);
      if (gap > 0.5) { adjacent = false; break; }
    }
    notes.push(`D05 cells-рядом: ${adjacent ? "✓" : "✗"} (${cellsZ.map((z) => `${z.content_type}@x=${z.x_cm}`).join(", ")})`);
  }

  // D06: bras at drawer edge
  if (bras) {
    const atLeft = bras.x_cm === 0;
    const atRight = Math.abs(bras.x_cm + bras.assigned_w_cm - input.drawer_width_cm) < 1;
    notes.push(`D06 bras-с-краю: ${atLeft || atRight ? "✓" : "✗"} (x=${bras.x_cm}, w=${bras.assigned_w_cm}, ящик_ш=${input.drawer_width_cm})`);
  }

  // D02: socks not between bras and panties/boxers on x-axis
  if (socks && bras && (panties || boxers)) {
    const underwear = panties ?? boxers!;
    const left  = Math.min(bras.x_cm, underwear.x_cm);
    const right = Math.max(bras.x_cm + bras.assigned_w_cm, underwear.x_cm + underwear.assigned_w_cm);
    const socksMid = socks.x_cm + socks.assigned_w_cm / 2;
    const between = socksMid > left && socksMid < right && bras.y_cm === socks.y_cm;
    notes.push(`D02 socks-не-между: ${between ? "✗ (стоят между!)" : "✓"} (socks.x=${socks.x_cm}, bras.x=${bras.x_cm})`);
  }

  // D01: same-type-division groups adjacent (slots then cells)
  if (slotsZ.length && cellsZ.length) {
    const maxSlotX = Math.max(...slotsZ.map((z) => z.x_cm + z.assigned_w_cm));
    const minCellX = Math.min(...cellsZ.map((z) => z.x_cm));
    const gap = minCellX - maxSlotX;
    notes.push(`D01 slots→cells прилегание: ${Math.abs(gap) < 1 ? "✓" : "~"} (slots_max_x=${maxSlotX}, cells_min_x=${minCellX}, gap=${gap.toFixed(1)})`);
  }

  // D09: folded items grouped (cells + open contiguous on x)
  const folded = [...cellsZ, ...openZ].sort((a, b) => a.x_cm - b.x_cm);
  if (folded.length >= 2) {
    const xMin = folded[0]!.x_cm;
    const xMax = folded[folded.length - 1]!.x_cm + folded[folded.length - 1]!.assigned_w_cm;
    notes.push(`D09 folded-группой: диапазон x=[${xMin}..${xMax.toFixed(1)}] (${folded.length} зоны)`);
  }

  if (notes.length) {
    console.log(`\nПроверка D-правил:`);
    for (const n of notes) console.log(`  ${n}`);
  }
}

// ─── СЦЕНАРИЙ 1 — контрольный (3 типа деления) ───────────────────────────────
// few → small, many → large
// Трусы=panties, Майки=tshirts, Носки=socks_regular
// storage_category должен быть "mixed" т.к. tshirts ∈ soft_clothes
printScenarioResult(
  1,
  "Контрольный: 3 типа деления (panties medium cells + tshirts small slots + socks_regular large cells)",
  "80×45×15 см",
  {
    drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15,
    storage_category: "mixed",
    item_1_content_type: "panties",       item_1_volume_level: "medium",
    item_2_content_type: "tshirts",       item_2_volume_level: "small",
    item_3_content_type: "socks_regular", item_3_volume_level: "large",
    priority: "convenient",
  }
);

// ─── СЦЕНАРИЙ 2 — большой ящик, всё по максимуму ─────────────────────────────
printScenarioResult(
  2,
  "Большой ящик: socks_regular large + panties large + bras medium",
  "120×50×20 см",
  {
    drawer_width_cm: 120, drawer_depth_cm: 50, drawer_height_cm: 20,
    storage_category: "underwear",
    item_1_content_type: "socks_regular", item_1_volume_level: "large",
    item_2_content_type: "panties",       item_2_volume_level: "large",
    item_3_content_type: "bras",          item_3_volume_level: "medium",
    priority: "capacity",
  }
);

// ─── СЦЕНАРИЙ 3 — узкий глубокий ящик, проверка can_rotate ───────────────────
printScenarioResult(
  3,
  "Узкий глубокий ящик: socks_regular medium + tights small  [проверка can_rotate]",
  "45×80×12 см",
  {
    drawer_width_cm: 45, drawer_depth_cm: 80, drawer_height_cm: 12,
    storage_category: "underwear",
    item_1_content_type: "socks_regular", item_1_volume_level: "medium",
    item_2_content_type: "tights",        item_2_volume_level: "small",
    priority: "convenient",
  }
);

// ─── СЦЕНАРИЙ 4 — одежда + аксессуары (belts, scarves отсутствуют в runtime) ─
// Движок должен вернуть validation error — belts/scarves не в allowedByCategory
hr(
  "СЦЕНАРИЙ 4: Одежда + аксессуары 90×45×15\n" +
  "Ящик: 90×45×15 см\n" +
  "ПРИМЕЧАНИЕ: belts и scarves отсутствуют в runtime-библиотеке (не в allowedByCategory)."
);
{
  const out4 = runUmestnoEngine({
    drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15,
    storage_category: "mixed",
    items: [
      { content_type: "tshirts",  volume_level: "medium" },
      { content_type: "belts",    volume_level: "small" },
      { content_type: "scarves",  volume_level: "small" },
    ],
    priority: "convenient",
  });
  const v4 = out4.debug?.["validation_result"] as { ok: boolean; errors: string[] } | undefined;
  console.log(`fit_status: ${out4.result ? out4.scheme_payload?.fit_status : "VALIDATION_FAILED"}`);
  if (v4 && !v4.ok) console.log(`errors: ${v4.errors.join(" | ")}`);
  console.log(`→ БАГИ/ОГРАНИЧЕНИЯ: belts, scarves не зарегистрированы в runtime A+B.`);
  console.log(`  Сценарий не может быть выполнен без расширения defaultLibraries.`);
  console.log(`  Аудит подтверждает: обоих типов нет в missing_content_types отчёта.`);
}

// ─── СЦЕНАРИЙ 5 — низкий ящик, проверка height fallback для бюстгальтеров ────
printScenarioResult(
  5,
  "Низкий ящик: bras medium (unit_h=12 → zone_h=13 > 10) + socks_regular medium",
  "80×40×10 см",
  {
    drawer_width_cm: 80, drawer_depth_cm: 40, drawer_height_cm: 10,
    storage_category: "underwear",
    item_1_content_type: "bras",          item_1_volume_level: "medium",
    item_2_content_type: "socks_regular", item_2_volume_level: "medium",
    priority: "convenient",
  }
);

// ─── СЦЕНАРИЙ 6 — стресс-тест (sweaters отсутствует в runtime) ───────────────
hr(
  "СЦЕНАРИЙ 6: Стресс-тест 60×40×12\n" +
  "Ящик: 60×40×12 см\n" +
  "ПРИМЕЧАНИЕ: sweaters отсутствует в runtime-библиотеке."
);
{
  const out6 = runUmestnoEngine({
    drawer_width_cm: 60, drawer_depth_cm: 40, drawer_height_cm: 12,
    storage_category: "mixed",
    items: [
      { content_type: "jeans",         volume_level: "large" },
      { content_type: "sweaters",      volume_level: "medium" },
      { content_type: "socks_regular", volume_level: "large" },
    ],
    priority: "capacity",
  });
  const v6 = out6.debug?.["validation_result"] as { ok: boolean; errors: string[] } | undefined;
  console.log(`fit_status: ${out6.result ? out6.scheme_payload?.fit_status : "VALIDATION_FAILED"}`);
  if (v6 && !v6.ok) console.log(`errors: ${v6.errors.join(" | ")}`);

  // Run partial scenario: jeans large + socks_regular large (without sweaters)
  console.log(`\nЧастичный тест без sweaters (jeans large + socks_regular large):`);
  printScenarioResult(
    6,
    "Стресс-тест (частично): jeans large slots + socks_regular large cells",
    "60×40×12 см",
    {
      drawer_width_cm: 60, drawer_depth_cm: 40, drawer_height_cm: 12,
      storage_category: "mixed",
      item_1_content_type: "jeans",         item_1_volume_level: "large",
      item_2_content_type: "socks_regular", item_2_volume_level: "large",
      priority: "capacity",
    }
  );
}

// ─── СЦЕНАРИЙ 7 — всё underwear ───────────────────────────────────────────────
printScenarioResult(
  7,
  "Весь underwear: panties large + bras large + socks_regular large",
  "100×50×15 см",
  {
    drawer_width_cm: 100, drawer_depth_cm: 50, drawer_height_cm: 15,
    storage_category: "underwear",
    item_1_content_type: "panties",       item_1_volume_level: "large",
    item_2_content_type: "bras",          item_2_volume_level: "large",
    item_3_content_type: "socks_regular", item_3_volume_level: "large",
    priority: "convenient",
  }
);

// ─── Итоговая таблица ─────────────────────────────────────────────────────────
console.log("\n\n" + "═".repeat(70));
console.log("ИТОГ");
console.log("═".repeat(70));
console.log("Сц  Статус              Примечание");
console.log("──  ──────────────────  ─────────────────────────────────────────");
const summary = [
  ["1", "ожидаем fit_all/partial", "tshirts+panties+socks_regular (mixed)"],
  ["2", "ожидаем fit_all",         "большой ящик, 3 underwear"],
  ["3", "ожидаем fit_all",         "узкий ящик, can_rotate не реализован"],
  ["4", "VALIDATION_FAILED",       "belts/scarves отсутствуют в A+B"],
  ["5", "ожидаем fit_partial",     "bras не влезает по высоте, fallback blocked"],
  ["6", "VALIDATION_FAILED",       "sweaters отсутствует в A+B"],
  ["6*","ожидаем fit_partial",     "частичный тест: jeans+socks_regular"],
  ["7", "ожидаем fit_all",         "100×50 ящик, все underwear"],
];
for (const [n, s, note] of summary) {
  console.log(`${n.padEnd(4)}${s.padEnd(20)}  ${note}`);
}
