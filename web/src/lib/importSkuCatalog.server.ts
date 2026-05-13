// Server-only: imports a SKU catalog from an XLSX buffer into PostgreSQL
import { query } from "@/lib/db";

export interface SkuImportRow {
  sku_id: string;
  division_type: string;
  rigidity?: string;
  width_cm: number;
  depth_cm: number;
  height_cm: number;
  capacity_units: number;
  color_group?: string;
  color_normalized?: string;
  material_group?: string;
  availability_status: string;
  product_title: string;
  seller_or_brand?: string;
  source_platform?: string;
  product_url?: string;
  affiliate_url?: string;
  affiliate_status?: string;
  price_rub?: number;
  image_url?: string;
  image_reference?: string;
  extra_data: Record<string, unknown>;
}

export interface ImportResult {
  version_id: number;
  row_count: number;
  errors: string[];
}

// Columns that become dedicated DB fields — everything else goes to extra_data
const DEDICATED_COLUMNS = new Set([
  "sku_id", "division_type", "rigidity", "width_cm", "depth_cm", "height_cm",
  "capacity_units", "color_group", "color_normalized", "material_group",
  "availability_status", "product_title", "seller_or_brand", "source_platform",
  "product_url", "affiliate_url", "affiliate_status", "price", "image_url", "image_reference",
]);

const REQUIRED_COLUMNS = ["sku_id", "division_type", "width_cm", "depth_cm", "height_cm", "capacity_units", "product_title"];
const ALLOWED_DIVISION_TYPES = ["cells", "slots", "open"];

// MVP: treat "unknown" as available so all test catalog rows are matched
function normalizeAvailabilityStatus(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase();
  if (s === "unavailable") return "unavailable";
  if (s === "coming_soon") return "coming_soon";
  return "available";
}

function validateRow(row: Record<string, unknown>, index: number): string[] {
  const errs: string[] = [];
  const n = index + 2;

  for (const col of REQUIRED_COLUMNS) {
    if (row[col] == null || row[col] === "") errs.push(`Row ${n}: missing ${col}`);
  }

  if (row.division_type && !ALLOWED_DIVISION_TYPES.includes(String(row.division_type))) {
    errs.push(`Row ${n}: invalid division_type "${row.division_type}"`);
  }

  for (const col of ["width_cm", "depth_cm", "height_cm"]) {
    const v = parseFloat(String(row[col] ?? ""));
    if (isNaN(v) || v <= 0) errs.push(`Row ${n}: ${col} must be a positive number`);
  }

  const cap = parseInt(String(row.capacity_units ?? ""), 10);
  if (isNaN(cap) || cap <= 0) errs.push(`Row ${n}: capacity_units must be a positive integer`);

  return errs;
}

function parseRow(raw: Record<string, unknown>): SkuImportRow {
  const extra_data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!DEDICATED_COLUMNS.has(k) && v != null && v !== "") {
      extra_data[k] = v;
    }
  }

  const price = raw.price != null && raw.price !== "" ? parseFloat(String(raw.price)) : undefined;

  return {
    sku_id: String(raw.sku_id),
    division_type: String(raw.division_type),
    rigidity: raw.rigidity != null ? String(raw.rigidity) : undefined,
    width_cm: parseFloat(String(raw.width_cm)),
    depth_cm: parseFloat(String(raw.depth_cm)),
    height_cm: parseFloat(String(raw.height_cm)),
    capacity_units: parseInt(String(raw.capacity_units), 10),
    color_group: raw.color_group != null ? String(raw.color_group) : undefined,
    color_normalized: raw.color_normalized != null ? String(raw.color_normalized) : undefined,
    material_group: raw.material_group != null ? String(raw.material_group) : undefined,
    availability_status: normalizeAvailabilityStatus(raw.availability_status),
    product_title: String(raw.product_title),
    seller_or_brand: raw.seller_or_brand != null ? String(raw.seller_or_brand) : undefined,
    source_platform: raw.source_platform != null ? String(raw.source_platform) : undefined,
    product_url: raw.product_url != null ? String(raw.product_url) : undefined,
    affiliate_url: raw.affiliate_url_if_available != null ? String(raw.affiliate_url_if_available) : undefined,
    affiliate_status: raw.affiliate_status != null ? String(raw.affiliate_status) : undefined,
    price_rub: price != null && !isNaN(price) ? price : undefined,
    image_url: raw.image_url != null ? String(raw.image_url) : undefined,
    image_reference: raw.image_reference != null ? String(raw.image_reference) : undefined,
    extra_data,
  };
}

export async function importSkuCatalog(
  xlsxBuffer: Buffer,
  options: { importedBy?: string; sourceFile?: string; notes?: string } = {}
): Promise<ImportResult> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(xlsxBuffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const errors: string[] = [];
  const validRows: SkuImportRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowErrors = validateRow(row, i);
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }
    validRows.push(parseRow(row));
  }

  if (validRows.length === 0) {
    await query(
      `INSERT INTO sku_import_logs (source_file, status, error, details) VALUES ($1, 'failed', $2, $3)`,
      [options.sourceFile ?? null, "No valid rows found", JSON.stringify({ errors })]
    );
    return { version_id: -1, row_count: 0, errors };
  }

  const versionRows = await query<{ id: number }>(
    `INSERT INTO sku_catalog_versions (imported_by, source_file, row_count, notes) VALUES ($1, $2, $3, $4) RETURNING id`,
    [options.importedBy ?? null, options.sourceFile ?? null, validRows.length, options.notes ?? null]
  );
  const versionId = versionRows[0].id;

  for (const row of validRows) {
    await query(
      `INSERT INTO sku_catalog
         (version_id, sku_id, division_type, rigidity, width_cm, depth_cm, height_cm,
          capacity_units, color_group, color_normalized, material_group, availability_status,
          product_title, seller_or_brand, source_platform, product_url, affiliate_url,
          affiliate_status, price_rub, image_url, image_reference, extra_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        versionId, row.sku_id, row.division_type, row.rigidity ?? null,
        row.width_cm, row.depth_cm, row.height_cm, row.capacity_units,
        row.color_group ?? null, row.color_normalized ?? null, row.material_group ?? null,
        row.availability_status, row.product_title, row.seller_or_brand ?? null,
        row.source_platform ?? null, row.product_url ?? null, row.affiliate_url ?? null,
        row.affiliate_status ?? null, row.price_rub ?? null, row.image_url ?? null,
        row.image_reference ?? null, JSON.stringify(row.extra_data),
      ]
    );
  }

  await query("UPDATE sku_catalog_versions SET is_active = false WHERE id != $1", [versionId]);
  await query("UPDATE sku_catalog_versions SET is_active = true WHERE id = $1", [versionId]);

  await query(
    `INSERT INTO sku_import_logs (source_file, status, version_id, row_count, details) VALUES ($1, 'success', $2, $3, $4)`,
    [options.sourceFile ?? null, versionId, validRows.length, JSON.stringify({ warnings: errors })]
  );

  return { version_id: versionId, row_count: validRows.length, errors };
}
