// SKU-match diagnostics — «воронка отсева».
//
// Чистая функция (без I/O): по одной зоне и каталогу прогоняет ТЕ ЖЕ ворота
// фильтра, что и боевой matchSkus (переиспользует baseFilterGates), и
// показывает, сколько SKU отсеялось на каждом этапе. Отвечает на два вопроса:
//   • «почему мало подбирается» — какой gate режет каталог (bottleneck);
//   • «почему не тот органайзер» — что реально пережило фильтр и какой
//     путь (primary / alternative_division) дал кандидата.
//
// Источник правды — engine/sku/matchSkus.ts. Здесь никакой собственной
// фильтрующей логики нет, только агрегация по воротам.

import type { PlacedZone, SkuCatalogRow } from "../types.js";
import {
  baseFilterGates,
  effectiveCellDims,
  laneGeometryFromZone,
  runFilterFunnel,
  type FunnelStage,
} from "./matchSkus.js";

export interface DivisionFunnel {
  division_type: string;
  funnel: FunnelStage[];
  survivors: number;
  /** sku_id выживших (первые 10) — чтобы глазами увидеть, ЧТО прошло. */
  survivor_sku_ids: string[];
}

export interface ZoneExplain {
  zone_id: string;
  content_type: string;
  division_type: string;
  units_needed: number;
  cap_per_lane: number;
  /** Геометрия одной полосы (lane), в которую обязан влезть кандидат. */
  lane_cm: { w: number; d: number; h: number };
  /** Эффективная ячейка = unit + item_gap. Точка отсчёта cell-фильтра. */
  effective_cell_cm: { w: number; d: number; h: number };
  catalog_total: number;
  /** Воронка по primary division_type зоны. */
  primary: DivisionFunnel;
  /** Воронка по alternative_division, если он задан у content_type. */
  alternative?: DivisionFunnel;
  /** Применим ли composed-from-slots fallback (primary=cells и 0 выживших). */
  composed_from_slots_applicable: boolean;
  /** Gate, отсеявший больше всего SKU на primary-пути (узкое место). */
  bottleneck_gate: string | null;
  bottleneck_dropped: number;
}

function buildFunnel(catalog: SkuCatalogRow[], zone: PlacedZone, divType: PlacedZone["division_type"]): DivisionFunnel {
  const geom = laneGeometryFromZone(zone);
  const gates = baseFilterGates(divType, geom, zone);
  const { stages, survivors } = runFilterFunnel(catalog, gates);
  return {
    division_type: divType,
    funnel: stages,
    survivors: survivors.length,
    survivor_sku_ids: survivors.slice(0, 10).map((s) => s.sku_id),
  };
}

export function explainZone(zone: PlacedZone, catalog: SkuCatalogRow[]): ZoneExplain {
  const geom = laneGeometryFromZone(zone);
  const eff = effectiveCellDims(zone);

  const primary = buildFunnel(catalog, zone, zone.division_type);

  // Узкое место — gate с максимальным dropped на primary-пути.
  let bottleneck_gate: string | null = null;
  let bottleneck_dropped = -1;
  for (const s of primary.funnel) {
    if (s.dropped > bottleneck_dropped) {
      bottleneck_dropped = s.dropped;
      bottleneck_gate = s.gate;
    }
  }

  const altDiv = zone.alternative_division;
  const alternative =
    altDiv && altDiv !== zone.division_type ? buildFunnel(catalog, zone, altDiv) : undefined;

  return {
    zone_id: zone.zone_id,
    content_type: zone.content_type,
    division_type: zone.division_type,
    units_needed: geom.units_needed,
    cap_per_lane: geom.cap_per_lane,
    lane_cm: { w: round(geom.lane_w), d: round(geom.lane_d), h: round(geom.lane_h) },
    effective_cell_cm: { w: round(eff.eff_w), d: round(eff.eff_d), h: round(zone.unit_h_cm) },
    catalog_total: catalog.length,
    primary,
    alternative,
    composed_from_slots_applicable: zone.division_type === "cells" && primary.survivors === 0,
    bottleneck_gate,
    bottleneck_dropped: Math.max(bottleneck_dropped, 0),
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

// Человекочитаемый рендер воронки для CLI.
export function formatZoneExplain(x: ZoneExplain): string {
  const lines: string[] = [];
  lines.push(
    `▸ ${x.content_type} (${x.zone_id}) — ${x.division_type}, ` +
      `нужно ${x.units_needed} шт, вместимость ≥ ${x.cap_per_lane}`,
  );
  lines.push(
    `  lane ${x.lane_cm.w}×${x.lane_cm.d}×${x.lane_cm.h} см · ` +
      `эфф. ячейка ${x.effective_cell_cm.w}×${x.effective_cell_cm.d}×${x.effective_cell_cm.h} см`,
  );
  lines.push(formatFunnel("primary", x.primary, x.catalog_total));
  if (x.alternative) {
    lines.push(formatFunnel("alternative", x.alternative, x.catalog_total));
  }
  if (x.composed_from_slots_applicable) {
    lines.push("  ↪ primary=cells и 0 выживших → будет попытка composed_from_slots");
  }
  if (x.primary.survivors === 0) {
    lines.push(
      `  ⚠ узкое место: gate «${x.bottleneck_gate}» отсёк ${x.bottleneck_dropped} SKU`,
    );
  }
  return lines.join("\n");
}

function formatFunnel(label: string, f: DivisionFunnel, total: number): string {
  const head = `  [${label}: ${f.division_type}] каталог ${total}`;
  const rows = f.funnel
    .map((s) => `      └ ${s.gate.padEnd(14)} выжило ${String(s.survived).padStart(4)}  (−${s.dropped})`)
    .join("\n");
  const tail =
    f.survivors > 0
      ? `      ✓ выжило ${f.survivors}: ${f.survivor_sku_ids.join(", ")}${f.survivors > 10 ? " …" : ""}`
      : "      ✗ 0 выживших";
  return `${head}\n${rows}\n${tail}`;
}
