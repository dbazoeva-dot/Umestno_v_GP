import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { generatePdf } from "@/lib/pdf.server";
import type { PlacedZone, SoftHeightWarning } from "@engine/types.js";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const row = await queryOne<{
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
      };
    };
    input: { drawer_width_cm: number; drawer_depth_cm: number; drawer_height_cm: number };
  }>(
    `SELECT o.status, o.variant, c.result_full, c.input
     FROM orders o
     JOIN configurations c ON c.id = o.configuration_id
     WHERE o.result_token = $1`,
    [token]
  );

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "paid") return NextResponse.json({ error: "Payment required" }, { status: 402 });

  const { result } = row.result_full;

  const pdfBuffer = await generatePdf({
    variant: row.variant as "A" | "B",
    drawerSize: {
      w_cm: row.input.drawer_width_cm,
      d_cm: row.input.drawer_depth_cm,
      h_cm: row.input.drawer_height_cm,
    },
    assignedZones: result.scheme.assigned_zones,
    warnings: result.scheme.warnings,
    contentWarnings: result.scheme.content_warnings,
    whatToStoreWhere: result.what_to_store_where,
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="umestno-scheme-${token.slice(0, 8)}.pdf"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
