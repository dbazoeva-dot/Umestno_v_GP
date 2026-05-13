// Server-only: loads the active SKU catalog from PostgreSQL
import { query, queryOne } from "@/lib/db";
import type { SkuCatalogRow } from "@engine/types.js";

interface DbSkuRow {
  sku_id: string;
  division_type: string;
  rigidity: string | null;
  width_cm: string;
  depth_cm: string;
  height_cm: string;
  capacity_units: number;
  color_group: string | null;
  availability_status: string;
  product_title: string;
  product_url: string | null;
  image_reference: string | null;
}

function toSkuCatalogRow(r: DbSkuRow): SkuCatalogRow {
  return {
    sku_id: r.sku_id,
    division_type: r.division_type as SkuCatalogRow["division_type"],
    rigidity: r.rigidity ?? "",
    width_cm: parseFloat(r.width_cm),
    depth_cm: parseFloat(r.depth_cm),
    height_cm: parseFloat(r.height_cm),
    capacity_units: r.capacity_units,
    color_group: r.color_group ?? undefined,
    availability_status: r.availability_status,
    product_title: r.product_title,
    product_url: r.product_url ?? undefined,
    image_reference: r.image_reference ?? undefined,
  };
}

export async function loadSkuCatalogFromDb(): Promise<{ catalog: SkuCatalogRow[]; versionId: number | null }> {
  const version = await queryOne<{ id: number }>(
    "SELECT id FROM sku_catalog_versions WHERE is_active = true ORDER BY imported_at DESC LIMIT 1"
  );

  if (!version) return { catalog: [], versionId: null };

  const rows = await query<DbSkuRow>(
    "SELECT sku_id, division_type, rigidity, width_cm, depth_cm, height_cm, capacity_units, color_group, availability_status, product_title, product_url, image_reference FROM sku_catalog WHERE version_id = $1",
    [version.id]
  );

  return { catalog: rows.map(toSkuCatalogRow), versionId: version.id };
}
