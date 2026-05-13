// Server-only: YooKassa API integration
// Docs: https://yookassa.ru/developers/api

const YOOKASSA_API = "https://api.yookassa.ru/v3";

function authHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new Error("YooKassa credentials are not set");
  return "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64");
}

export interface YooKassaPayment {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  confirmation: { confirmation_url: string };
  amount: { value: string; currency: string };
}

export async function createPayment({
  orderId,
  amountKopecks,
  email,
  returnUrl,
  idempotenceKey,
}: {
  orderId: string;
  amountKopecks: number;
  email: string;
  returnUrl: string;
  idempotenceKey: string;
}): Promise<YooKassaPayment> {
  const amount = (amountKopecks / 100).toFixed(2);

  const res = await fetch(`${YOOKASSA_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey,
    },
    body: JSON.stringify({
      amount: { value: amount, currency: "RUB" },
      confirmation: { type: "redirect", return_url: returnUrl },
      capture: true,
      description: `Заказ ${orderId} — Уместно`,
      receipt: {
        customer: { email },
        items: [
          {
            description: "Схема организации ящика",
            quantity: "1.00",
            amount: { value: amount, currency: "RUB" },
            vat_code: 1,
            payment_mode: "full_payment",
            payment_subject: "service",
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YooKassa error ${res.status}: ${err}`);
  }

  return res.json() as Promise<YooKassaPayment>;
}

export interface YooKassaWebhookEvent {
  type: "notification";
  event: "payment.succeeded" | "payment.canceled" | "payment.waiting_for_capture";
  object: YooKassaPayment;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.YOOKASSA_WEBHOOK_SECRET;
  if (!secret) return false;
  const crypto = require("crypto") as typeof import("crypto");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
