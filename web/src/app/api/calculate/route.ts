import { NextRequest, NextResponse } from "next/server";
import { runUmestnoEngine } from "@/lib/engine.server";
import { query } from "@/lib/db";
import { loadSkuCatalogFromDb } from "@/lib/skuCatalog.server";
import type { UserInput } from "@/lib/engine.server";

function isValidUserInput(body: unknown): body is UserInput {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.drawer_width_cm === "number" &&
    typeof b.drawer_depth_cm === "number" &&
    typeof b.drawer_height_cm === "number" &&
    typeof b.storage_category === "string" &&
    typeof b.priority === "string"
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidUserInput(body)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { catalog, versionId } = await loadSkuCatalogFromDb();
  const engineResult = runUmestnoEngine(body, catalog.length > 0 ? { skuCatalog: catalog } : undefined);

  if (!engineResult.result) {
    return NextResponse.json(
      { error: "Engine validation failed", details: engineResult.debug },
      { status: 422 }
    );
  }

  const selectedSkuIds = (engineResult.result.products ?? [])
    .flatMap((m: { candidates: Array<{ sku_id: string }> }) => m.candidates.slice(0, 1).map(c => c.sku_id));

  const selectedSkusSnapshot = (engineResult.result.products ?? [])
    .flatMap((m: { candidates: Array<Record<string, unknown>> }) => m.candidates.slice(0, 1));

  const rows = await query<{ id: string }>(
    `INSERT INTO configurations (input, result_full, sku_catalog_version_id, selected_sku_ids, selected_skus_snapshot)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      JSON.stringify(body),
      JSON.stringify(engineResult),
      versionId ?? null,
      selectedSkuIds,
      JSON.stringify(selectedSkusSnapshot),
    ]
  );

  return NextResponse.json({ configuration_id: rows[0].id });
}
