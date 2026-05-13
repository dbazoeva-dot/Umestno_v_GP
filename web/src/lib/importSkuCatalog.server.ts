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
  availability_status: string;
  product_title: string;
  product_url?: string;
  image_reference?: string;
}

export interface ImportResult {
  version_id: number;
  row_count: number;
  errors: string[];
}

const REQUIRED_COLUMNS = ["sku_id", "division_type", "width_cm", "depth_cm", "height_cm", "capacity_units", "availability_status", "product_title"];
const ALLOWED_DIVISION_TYPES = ["cells", "slots", "open"];
const ALLOWED_STATUSES = ["available", "unavailable", "coming_soon"];

function validateRow(row: Record<string, unknown>, index: number): string[] {
  const errs: string[] = [];
  const n = index + 2; // 1-based + header row

  for (const col of REQUIRED_COLUMNS) {
    if (row[col] == null || row[col] === "") errs.push(`Row ${n}: missing ${col}`);
  }

  if (row.division_type && !ALLOWED_DIVISION_TYPES.includes(String(row.division_type))) {
    errs.push(`Row ${n}: invalid division_type "${row.division_type}"`);
  }

  if (row.availability_status && !ALLOWED_STATUSES.includes(String(row.availability_status))) {
    errs.push(`Row ${n}: invalid availability_status "${row.availability_status}"`);
  }

  for (const col of ["width_cm", "depth_cm", "height_cm"]) {
    const v = parseFloat(String(row[col] ?? ""));
    if (isNaN(v) || v <= 0) errs.push(`Row ${n}: ${col} must be a positive number`);
  }

  const cap = parseInt(String(row.capacity_units ?? ""), 10);
  if (isNaN(cap) || cap <= 0) errs.push(`Row ${n}: capacity_units must be a positive integer`);

  return errs;
}

export async function importSkuCatalog(
  xlsxBuffer: Buffer,
  options: { importedBy?: string; sourceFile?: string; notes?: string } = {}
): Promise<ImportResult> {
  // Dynamic import to keep xlsx out of client bundle
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

    validRows.push({
      sku_id: String(row.sku_id),
      division_type: String(row.division_type),
      rigidity: row.rigidity != null ? String(row.rigidity) : undefined,
      width_cm: parseFloat(String(row.width_cm)),
      depth_cm: parseFloat(String(row.depth_cm)),
      height_cm: parseFloat(String(row.height_cm)),
      capacity_units: parseInt(String(row.capacity_units), 10),
      color_group: row.color_group != null ? String(row.color_group) : undefined,
      availability_status: String(row.availability_status),
      product_title: String(row.product_title),
      product_url: row.product_url != null ? String(row.product_url) : undefined,
      image_reference: row.image_reference != null ? String(row.image_reference) : undefined,
    });
  }

  if (validRows.length === 0) {
    await query(
      `INSERT INTO sku_import_logs (source_file, status, error, details)
       VALUES ($1, 'failed', $2, $3)`,
      [options.sourceFile ?? null, "No valid rows found", JSON.stringify({ errors })]
    );
    return { version_id: -1, row_count: 0, errors };
  }

  // Create version record
  const versionRows = await query<{ id: number }>(
    `INSERT INTO sku_catalog_versions (imported_by, source_file, row_count, notes)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [options.importedBy ?? null, options.sourceFile ?? null, validRows.length, options.notes ?? null]
  );
  const versionId = versionRows[0].id;

  // Insert all rows
  for (const row of validRows) {
    await query(
      `INSERT INTO sku_catalog
         (version_id, sku_id, division_type, rigidity, width_cm, depth_cm, height_cm,
          capacity_units, color_group, availability_status, product_title, product_url, image_reference)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        versionId, row.sku_id, row.division_type, row.rigidity ?? null,
        row.width_cm, row.depth_cm, row.height_cm, row.capacity_units,
        row.color_group ?? null, row.availability_status,
        row.product_title, row.product_url ?? null, row.image_reference ?? null,
      ]
    );
  }

  // Deactivate all other versions, activate this one
  await query("UPDATE sku_catalog_versions SET is_active = false WHERE id != $1", [versionId]);
  await query("UPDATE sku_catalog_versions SET is_active = true WHERE id = $1", [versionId]);

  await query(
    `INSERT INTO sku_import_logs (source_file, status, version_id, row_count, details)
     VALUES ($1, 'success', $2, $3, $4)`,
    [options.sourceFile ?? null, versionId, validRows.length, JSON.stringify({ errors })]
  );

  return { version_id: versionId, row_count: validRows.length, errors };
}
