import { NextRequest, NextResponse } from "next/server";
import { runUmestnoEngine } from "@/lib/engine.server";
import { query } from "@/lib/db";
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

  const engineResult = runUmestnoEngine(body);

  if (!engineResult.result) {
    return NextResponse.json(
      { error: "Engine validation failed", details: engineResult.debug },
      { status: 422 }
    );
  }

  const rows = await query<{ id: string }>(
    `INSERT INTO configurations (input, result_full) VALUES ($1, $2) RETURNING id`,
    [JSON.stringify(body), JSON.stringify(engineResult)]
  );

  const configurationId = rows[0].id;

  return NextResponse.json({ configuration_id: configurationId });
}
