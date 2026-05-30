// Загружает активные SKU из Postgres и маппит на SkuCatalogRow,
// который ждёт engine.matchSkus.
//
// Engine остаётся pure — он не знает про БД. Все I/O — здесь.
//
// Цикл жизни: API-сервер вызывает loadCatalogFromDb() один раз при
// старте, кеширует результат в памяти. Парсер каталога (после прода)
// будет переинициализировать кеш по сигналу.

import type { Pool } from "pg";
import type { SkuCatalogRow } from "../../engine/types.js";

const CATALOG_QUERY = `
  SELECT
    sku_id,
    division_type,
    rigidity,
    width_cm,
    depth_cm,
    height_cm,
    capacity_units,
    set_quantity,
    cols,
    rows,
    cell_width_cm,
    cell_depth_cm,
    can_rotate,
    color_group,
    availability_status,
    product_title,
    product_url,
    price_kop
  FROM sku
  WHERE is_active = true
`;

export async function loadCatalogFromDb(pool: Pool): Promise<SkuCatalogRow[]> {
  const result = await pool.query(CATALOG_QUERY);
  return result.rows.map(toCatalogRow);
}

function toCatalogRow(row: Record<string, unknown>): SkuCatalogRow {
  return {
    sku_id:              String(row.sku_id),
    division_type:       row.division_type as SkuCatalogRow["division_type"],
    rigidity:            String(row.rigidity),
    width_cm:            num(row.width_cm),
    depth_cm:            num(row.depth_cm),
    height_cm:           num(row.height_cm),
    capacity_units:      int(row.capacity_units),
    set_quantity:        int(row.set_quantity) ?? 1,
    cols:                int(row.cols),
    rows:                int(row.rows),
    cell_width_cm:       num(row.cell_width_cm),
    cell_depth_cm:       num(row.cell_depth_cm),
    can_rotate:          row.can_rotate === true ? "yes" : "no",
    color_group:         str(row.color_group),
    availability_status: str(row.availability_status) ?? "unknown",
    product_title:       String(row.product_title),
    product_url:         str(row.product_url),
    price:               row.price_kop != null ? Number(row.price_kop) / 100 : undefined,
  } as SkuCatalogRow;
}

// numeric → number; numeric из pg приходит строкой
function num(v: unknown): number {
  if (v === null || v === undefined) return undefined as unknown as number;
  return typeof v === "string" ? parseFloat(v) : Number(v);
}
function int(v: unknown): number {
  if (v === null || v === undefined) return undefined as unknown as number;
  return typeof v === "string" ? parseInt(v, 10) : Number(v);
}
function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  return String(v);
}
