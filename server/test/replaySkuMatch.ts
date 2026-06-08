// Реплей подбора SKU по токену заказа — «глазами движка».
//
// По t=<token> из адреса result-страницы достаёт сохранённый engine_output
// из configurations и печатает по каждой зоне:
//   • что реально решил matchSkus на момент расчёта (статус + топ-кандидат
//     со СНАПШОТОМ размеров — он лежит в debug.sku_matching_result);
//   • воронку отсева explainZone против ЖИВОГО каталога (loadCatalogFromDb) —
//     сколько SKU отсеивается сейчас и на каком gate;
//   • рассинхрон: размеры кандидата в снапшоте vs в текущей таблице sku
//     (configuration_skus хранит только sku_id, result-страница рисует живые
//     размеры — если каталог правили, пользователь видит не то, что матчилось).
//
// Запуск на VPS (где есть БД и node_modules):
//   PGPASSWORD=... node dist/server/test/replaySkuMatch.js FoI2HlH0Cnbb7S8pAzAKBQ

import { createPool } from "../db/pool.js";
import { loadCatalogFromDb } from "../catalog/loadCatalogFromDb.js";
import { explainZone, formatZoneExplain } from "../../engine/sku/explainSkuMatch.js";
import type { PlacedZone, SkuCatalogRow } from "../../engine/types.js";

interface StoredCandidate extends Partial<SkuCatalogRow> { sku_id?: string }
interface StoredMatch {
  zone_id?: string;
  content_type?: string;
  match_status?: string;
  match_kind?: string | null;
  units_needed?: number;
  packs_needed?: number;
  candidates?: StoredCandidate[];
}
interface EngineOutput {
  scheme_payload?: { fit_status?: string; assigned_zones?: PlacedZone[] } | null;
  debug?: { sku_matching_result?: StoredMatch[] };
}

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error("usage: node dist/server/test/replaySkuMatch.js <token>");
    process.exit(2);
  }

  const pool = createPool();
  try {
    const orderQ = await pool.query<{
      configuration_id: string;
      fit_status: string;
      status: string;
      input_payload: unknown;
      engine_output: EngineOutput | null;
    }>(
      `SELECT o.configuration_id, o.fit_status, o.status,
              c.input_payload, c.engine_output
         FROM orders o
         JOIN configurations c ON c.id = o.configuration_id
        WHERE o.token = $1`,
      [token],
    );
    if (orderQ.rowCount === 0) {
      console.error(`✗ заказ с token=${token} не найден`);
      process.exit(1);
    }
    const row = orderQ.rows[0];
    console.log(`token=${token}  fit_status=${row.fit_status}  order_status=${row.status}`);
    console.log(`input: ${JSON.stringify(row.input_payload)}\n`);

    const eo = row.engine_output;
    const zones = eo?.scheme_payload?.assigned_zones ?? [];
    const matches = eo?.debug?.sku_matching_result ?? [];
    if (zones.length === 0) {
      console.log("схема не построена — нет assigned_zones.");
      return;
    }

    // Живой каталог — чтобы воронка считалась по текущим данным.
    const liveCatalog = await loadCatalogFromDb(pool);
    const liveBySku = new Map(liveCatalog.map((s) => [s.sku_id, s]));
    console.log(`живой каталог: ${liveCatalog.length} активных SKU\n`);

    // Что реально лежит в configuration_skus (то, что показывает result.ts).
    const csQ = await pool.query<{ zone_id: string | null; sku_id: string; block_index: number; match_status: string }>(
      `SELECT zone_id, sku_id, block_index, match_status
         FROM configuration_skus WHERE configuration_id = $1 ORDER BY block_index`,
      [row.configuration_id],
    );
    const persistedByZone = new Map(csQ.rows.map((r) => [r.zone_id ?? "", r]));

    const byZone = new Map<string, StoredMatch>();
    for (const m of matches) byZone.set(String(m.zone_id), m);

    for (const zone of zones) {
      console.log("─".repeat(72));
      const m = byZone.get(zone.zone_id);
      const snap = m?.candidates?.[0];
      const persisted = persistedByZone.get(zone.zone_id);

      console.log(
        `● matchSkus (на момент расчёта): [${m?.match_status ?? "—"}] → ` +
          `${snap?.sku_id ?? "—"} ` +
          `(kind=${m?.match_kind ?? "—"}, units=${m?.units_needed ?? "?"}, packs=${m?.packs_needed ?? "?"})`,
      );

      if (snap?.sku_id) {
        const live = liveBySku.get(snap.sku_id);
        console.log(
          `  снапшот: ${dims(snap)}  cell ${cell(snap)}  cap=${snap.capacity_units ?? "?"}  div=${snap.division_type ?? "?"}`,
        );
        if (!live) {
          console.log("  ⚠ РАССИНХРОН: этого sku_id больше нет в активном каталоге (is_active=false?)");
        } else if (dims(live) !== dims(snap) || cell(live) !== cell(snap)) {
          console.log(`  ⚠ РАССИНХРОН: живой sku отличается → ${dims(live)}  cell ${cell(live)} — result-страница рисует ЭТИ цифры`);
        }
      }
      if (persisted && persisted.sku_id !== snap?.sku_id) {
        console.log(`  ⚠ configuration_skus.sku_id=${persisted.sku_id} ≠ снапшот ${snap?.sku_id} (расхождение записи и расчёта)`);
      }

      const ex = explainZone(zone, liveCatalog);
      console.log(formatZoneExplain(ex));
      const candCount = m?.candidates?.length ?? 0;
      // База пропустила, а matchSkus отдал 0 → отсев на set_quantity (правило #1).
      if (ex.primary.survivors > 0 && candCount === 0 && m?.match_status !== "composed_from_slots" && m?.match_status !== "alternative_division") {
        console.log(
          `  ⚠ база пропустила ${ex.primary.survivors}, но кандидатов 0 → ` +
            `отсев на set_quantity (правило #1: set_quantity > ${ex.units_needed} или не делит нацело)`,
        );
      }
      console.log();
    }
  } finally {
    await pool.end();
  }
}

function dims(s: Partial<SkuCatalogRow>): string {
  return `${s.width_cm}×${s.depth_cm}×${s.height_cm}`;
}
function cell(s: Partial<SkuCatalogRow>): string {
  return `${s.cell_width_cm ?? "—"}×${s.cell_depth_cm ?? "—"}`;
}

main().catch((e) => {
  console.error("✗ failed:", e);
  process.exit(1);
});
