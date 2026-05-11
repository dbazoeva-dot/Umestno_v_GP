import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/yookassa.server";
import type { YooKassaWebhookEvent } from "@/lib/yookassa.server";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-ymid-webhook-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: YooKassaWebhookEvent;
  try {
    event = JSON.parse(rawBody) as YooKassaWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paymentId = event.object.id;

  const order = await queryOne<{ id: string; email: string; result_token: string; status: string }>(
    "SELECT id, email, result_token, status FROM orders WHERE yookassa_payment_id = $1",
    [paymentId]
  );

  if (!order) {
    // Not our order — ignore
    return NextResponse.json({ ok: true });
  }

  if (event.event === "payment.succeeded" && order.status !== "paid") {
    await query(
      "UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1",
      [order.id]
    );
    // TODO: send confirmation email with PDF link
    // TODO: push to CRM
  }

  if (event.event === "payment.canceled" && order.status === "pending") {
    await query(
      "UPDATE orders SET status = 'failed' WHERE id = $1",
      [order.id]
    );
  }

  return NextResponse.json({ ok: true });
}
