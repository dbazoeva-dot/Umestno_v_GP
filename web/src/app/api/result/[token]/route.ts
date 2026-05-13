import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { buildSchemeZones } from "@/lib/schemeZones";
import type { PlacedZone, SoftHeightWarning } from "@engine/types.js";

interface FreeRect { x_cm: number; y_cm: number; w_cm: number; d_cm: number; h_cm?: number }

interface OrderRow {
  status: string;
  variant: string;
  result_full: {
    result: {
      scheme: {
        assigned_zones: PlacedZone[];
        warnings: string[];
        content_warnings: SoftHeightWarning[];
      };
      what_to_store_where: Array<{ content_type: string; zone_id: string; division_type: string; instruction: string }>;
      products: unknown;
    };
    scheme_payload: { reserve_zones: FreeRect[]; layout_rule_evaluations: unknown[] };
  };
  selected_skus_snapshot: unknown;
  input: { drawer_width_cm: number; drawer_depth_cm: number; drawer_height_cm: number };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const row = await queryOne<OrderRow>(
    `SELECT o.status, o.variant, c.result_full, c.selected_skus_snapshot, c.input
     FROM orders o
     JOIN configurations c ON c.id = o.configuration_id
     WHERE o.result_token = $1`,
    [token]
  );

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "paid") return NextResponse.json({ error: "Payment required" }, { status: 402 });

  const { result, scheme_payload } = row.result_full;
  const showDimensions = row.variant === "A";
  const { drawer_width_cm: dw, drawer_depth_cm: dd, drawer_height_cm: dh } = row.input;

  const scheme_zones = buildSchemeZones(
    result.scheme.assigned_zones,
    scheme_payload.reserve_zones ?? [],
    dw, dd,
    showDimensions
  );

  return NextResponse.json({
    variant: row.variant,
    drawer: { w_cm: dw, d_cm: dd, h_cm: dh },
    scheme_zones,
    what_to_store_where: result.what_to_store_where,
    warnings: result.scheme.warnings,
    content_warnings: result.scheme.content_warnings,
    products: row.selected_skus_snapshot,
  });
}
