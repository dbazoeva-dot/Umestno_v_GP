// Локальный прогон «воронки отсева» SKU на сценариях — без БД.
//
// Гоняет полный движок и для КАЖДОЙ зоны печатает:
//   • реальный итог matchSkus (статус + топ-кандидат);
//   • воронку отсева explainZone — сколько SKU отсеялось на каждом gate.
// Отвечает на «почему мало подбирается»: видно, какой именно фильтр режет
// каталог.
//
// Запуск (на реальном каталоге из xlsx):
//   python3 engine/scripts/extractSkuCatalog.py E_SKU_catalog_v0106.xlsx > /tmp/catalog.json
//   npm run build
//   CATALOG=/tmp/catalog.json node dist/engine/test/diagSkuFunnel.js
//
// Без CATALOG берётся defaultLibraries.skuCatalog (может быть пустым).

import { readFileSync } from "node:fs";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import { explainZone, formatZoneExplain } from "../sku/explainSkuMatch.js";
import type { PlacedZone, SkuCatalogRow } from "../types.js";

const catalogPath = process.env.CATALOG;
const skuCatalog: SkuCatalogRow[] = catalogPath
  ? (JSON.parse(readFileSync(catalogPath, "utf8")) as SkuCatalogRow[])
  : defaultLibraries.skuCatalog;

const libraries = { ...defaultLibraries, skuCatalog };
console.log(`каталог: ${skuCatalog.length} SKU${catalogPath ? ` (${catalogPath})` : " (defaultLibraries)"}\n`);

interface Scenario { name: string; input: Parameters<typeof runUmestnoEngine>[0] }

// Сценарии «трусы/носки» близко к скрину. Правьте/добавляйте под нужный баг
// (важно, чтобы схема строилась — иначе печатать воронку не по чему).
const scenarios: Scenario[] = [
  {
    name: "трусы (panties) — 50×40×10, medium",
    input: {
      drawer_width_cm: 50, drawer_depth_cm: 40, drawer_height_cm: 10,
      storage_category: "underwear",
      items: [{ content_type: "panties", volume_level: "medium" }],
      priority: "convenient",
    },
  },
  {
    name: "трусы (boxers) — 50×40×12, medium",
    input: {
      drawer_width_cm: 50, drawer_depth_cm: 40, drawer_height_cm: 12,
      storage_category: "underwear",
      items: [{ content_type: "boxers", volume_level: "medium" }],
      priority: "convenient",
    },
  },
  {
    name: "трусы+носки — 80×45×12, large",
    input: {
      drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 12,
      storage_category: "underwear",
      items: [
        { content_type: "panties", volume_level: "large" },
        { content_type: "socks_regular", volume_level: "large" },
      ],
      priority: "convenient",
    },
  },
];

for (const sc of scenarios) {
  console.log("═".repeat(72));
  console.log(`СЦЕНАРИЙ: ${sc.name}`);
  console.log("═".repeat(72));

  const out = runUmestnoEngine(sc.input, libraries) as {
    scheme_payload: { assigned_zones: PlacedZone[] } | null;
    debug: { sku_matching_result?: Array<Record<string, unknown>> };
    no_fit_message?: string;
  };

  if (!out.scheme_payload) {
    console.log(`  схема не построена: ${out.no_fit_message ?? "no_scheme"}\n`);
    continue;
  }

  const matches = out.debug.sku_matching_result ?? [];
  const byZone = new Map<string, Record<string, unknown>>();
  for (const m of matches) byZone.set(String(m.zone_id), m);

  for (const zone of out.scheme_payload.assigned_zones) {
    const m = byZone.get(zone.zone_id);
    const status = (m?.match_status as string) ?? "—";
    const cand = (m?.candidates as Array<{ sku_id?: string }> | undefined)?.[0];
    const candCount = (m?.candidates as unknown[] | undefined)?.length ?? 0;
    console.log(
      `\n● реальный итог matchSkus: [${status}] → ` +
        `${cand?.sku_id ?? "—"} (кандидатов: ${candCount})`,
    );
    const ex = explainZone(zone, skuCatalog);
    console.log(formatZoneExplain(ex));
    // База пропустила, а кандидатов 0 → отсев на ПОСТ-фильтре set_quantity
    // (правило #1): набор больше N или не делит N нацело. Воронка считает
    // только базовые ворота, поэтому показываем разрыв явно.
    if (ex.primary.survivors > 0 && candCount === 0 && status !== "composed_from_slots" && status !== "alternative_division") {
      console.log(
        `  ⚠ база пропустила ${ex.primary.survivors}, но кандидатов 0 → ` +
          `отсев на set_quantity (правило #1: set_quantity > ${ex.units_needed} или не делит нацело)`,
      );
    }
  }
  console.log();
}
