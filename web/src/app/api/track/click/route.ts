import { type NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getOrCreateSessionId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const skuId = searchParams.get("sku_id");
  const redirectUrl = searchParams.get("url");

  if (!skuId || !redirectUrl) {
    return NextResponse.json({ error: "sku_id and url are required" }, { status: 400 });
  }

  // Validate redirect target is a real URL (no open redirect to arbitrary schemes)
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(redirectUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const sessionId = getOrCreateSessionId(req);
  const configurationId = searchParams.get("config_id") || null;
  const sourcePlatform = searchParams.get("platform") || null;
  const userAgent = req.headers.get("user-agent") || null;

  // Fire-and-forget — don't block the redirect on DB write
  query(
    `INSERT INTO sku_clicks (sku_id, configuration_id, source_platform, affiliate_url, session_id, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [skuId, configurationId, sourcePlatform, parsedUrl.toString(), sessionId, userAgent]
  ).catch(() => {
    // Non-critical — click still goes through even if logging fails
  });

  const response = NextResponse.redirect(parsedUrl.toString(), { status: 302 });

  // Set session cookie if it didn't exist yet
  if (!req.cookies.get("sid")) {
    response.cookies.set("sid", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }

  return response;
}
