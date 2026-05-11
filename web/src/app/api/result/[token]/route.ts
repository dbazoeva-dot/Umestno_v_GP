import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import type { PlacedZone, SoftHeightWarning } from "@engine/types.js";

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
      what_to_store_where: Array<{
        content_type: string;
        zone_id: string;
        division_type: string;
        instruction: string;
      }>;
      products: unknown;
    };
    scheme_payload: {
      layout_rule_evaluations: unknown[];
    };
  };
  input: {
    drawer_width_cm: number;
    drawer_depth_cm: number;
    drawer_height_cm: number;
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const row = await queryOne<OrderRow>(
    `SELECT o.status, o.variant, c.result_full, c.input
     FROM orders o
     JOIN configurations c ON c.id = o.configuration_id
     WHERE o.result_token = $1`,
    [token]
  );

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status !== "paid") {
    return NextResponse.json({ error: "Payment required" }, { status: 402 });
  }

  const { result } = row.result_full;
  const showDimensions = row.variant === "A";

  const zones = result.scheme.assigned_zones.map((z) => ({
    zone_id: z.zone_id,
    content_type: z.content_type,
    division_type: z.division_type,
    storage_method: z.storage_method,
    capacity: z.capacity,
    x_cm: z.x_cm,
    y_cm: z.y_cm,
    assigned_w_cm: z.assigned_w_cm,
    assigned_d_cm: z.assigned_d_cm,
    assigned_h_cm: z.assigned_h_cm,
    ...(showDimensions && {
      zone_w_cm: z.zone_w_cm,
      zone_d_cm: z.zone_d_cm,
      zone_h_cm: z.zone_h_cm,
    }),
    soft_height_warning: z.soft_height_warning,
  }));

  return NextResponse.json({
    variant: row.variant,
    drawer: {
      w_cm: row.input.drawer_width_cm,
      d_cm: row.input.drawer_depth_cm,
      h_cm: row.input.drawer_height_cm,
    },
    zones,
    what_to_store_where: result.what_to_store_where,
    warnings: result.scheme.warnings,
    content_warnings: result.scheme.content_warnings,
    products: result.products,
    layout_rule_evaluations: row.result_full.scheme_payload.layout_rule_evaluations,
  });
}
