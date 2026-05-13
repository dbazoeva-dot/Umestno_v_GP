import { type NextRequest } from "next/server";
import { randomUUID } from "crypto";

export function getOrCreateSessionId(req: NextRequest): string {
  return req.cookies.get("sid")?.value ?? randomUUID();
}
