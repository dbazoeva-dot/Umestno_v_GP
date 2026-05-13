import { NextRequest, NextResponse } from "next/server";
import { importSkuCatalog } from "@/lib/importSkuCatalog.server";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const fileName = file instanceof File ? file.name : "upload.xlsx";
  if (!fileName.endsWith(".xlsx")) {
    return NextResponse.json({ error: "Only .xlsx files are supported" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const notes = formData.get("notes");

  const result = await importSkuCatalog(buffer, {
    importedBy: req.headers.get("x-admin-user") ?? "admin",
    sourceFile: fileName,
    notes: typeof notes === "string" ? notes : undefined,
  });

  if (result.version_id === -1) {
    return NextResponse.json(
      { error: "Import failed — no valid rows", errors: result.errors },
      { status: 422 }
    );
  }

  return NextResponse.json({
    ok: true,
    version_id: result.version_id,
    row_count: result.row_count,
    warnings: result.errors.length > 0 ? result.errors : undefined,
  });
}
