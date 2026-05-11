import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { createPayment } from "@/lib/yookassa.server";
import { v4 as uuidv4 } from "uuid";

interface CreateOrderBody {
  configuration_id: string;
  email: string;
  variant?: "A" | "B";
}

function isValidBody(body: unknown): body is CreateOrderBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return typeof b.configuration_id === "string" && typeof b.email === "string" && b.email.includes("@");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "configuration_id and valid email are required" }, { status: 400 });
  }

  const config = await queryOne<{ id: string }>(
    "SELECT id FROM configurations WHERE id = $1",
    [body.configuration_id]
  );
  if (!config) {
    return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
  }

  const amountKopecks = parseInt(process.env.PRICE_KOPECKS ?? "29900", 10);
  const variant = body.variant ?? "A";
  const idempotenceKey = uuidv4();

  const orderRows = await query<{ id: string; result_token: string }>(
    `INSERT INTO orders (configuration_id, email, amount_kopecks, variant)
     VALUES ($1, $2, $3, $4)
     RETURNING id, result_token`,
    [body.configuration_id, body.email, amountKopecks, variant]
  );
  const order = orderRows[0];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const returnUrl = `${appUrl}/result/${order.result_token}`;

  const payment = await createPayment({
    orderId: order.id,
    amountKopecks,
    email: body.email,
    returnUrl,
    idempotenceKey,
  });

  await query(
    "UPDATE orders SET yookassa_payment_id = $1 WHERE id = $2",
    [payment.id, order.id]
  );

  return NextResponse.json({
    order_id: order.id,
    payment_url: payment.confirmation.confirmation_url,
  });
}
