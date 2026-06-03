// POST /api/yookassa/webhook
//
// Принимает уведомления от ЮКассы (https://yookassa.ru/developers/using-api/webhooks).
// Главное событие — payment.succeeded: оплата прошла, надо отметить заказ
// как paid и записать платёж в таблицу payments.
//
// Безопасность: ЮКасса предлагает HMAC-подписи, но для MVP мы делаем
// проще — после получения вебхука НЕ доверяем ему слепо, а активно
// дёргаем GET /payments/{id} у самой ЮКассы и сверяем что платёж
// действительно succeeded. Это защита от подделок: даже если кто-то
// пошлёт фейковый webhook, ЮКасса нас поправит.
//
// ЮКасса ожидает в ответ 200 OK всегда (иначе будет ретраить до недели).
// Поэтому даже на ошибке логируем и возвращаем 200.

import type { Request, Response } from "express";
import type { Pool } from "pg";
import { getPayment } from "../integrations/yookassa.js";

interface WebhookEvent {
  type?: string;
  event?: string;
  object?: {
    id?: string;
    status?: string;
    paid?: boolean;
    amount?: { value?: string; currency?: string };
    metadata?: Record<string, string>;
  };
}

export function yookassaWebhookHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    // Возвращаем 200 как можно раньше — обработку делаем после ответа.
    // ЮКасса считает webhook доставленным как только получит 2xx.
    res.status(200).json({ ok: true });

    try {
      const payload = req.body as WebhookEvent;
      const eventType = payload.event ?? payload.type ?? "";
      const obj = payload.object ?? {};

      if (eventType !== "payment.succeeded") {
        console.log("[yookassa-webhook] ignored event:", eventType);
        return;
      }

      const yookassaId = obj.id;
      const orderToken = obj.metadata?.order_token;
      if (!yookassaId || !orderToken) {
        console.warn("[yookassa-webhook] missing id or order_token:", obj);
        return;
      }

      // Активно проверяем у ЮКассы что платёж реально succeeded
      // (защита от подделанных вебхуков).
      const verified = await getPayment(yookassaId);
      if (verified.status !== "succeeded" || !verified.paid) {
        console.warn("[yookassa-webhook] payment not verified as succeeded:", {
          yookassa_id: yookassaId,
          claimed_status: obj.status,
          verified_status: verified.status,
          verified_paid: verified.paid,
        });
        return;
      }

      // Находим наш заказ по токену из metadata и UPDATE'им.
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const orderQ = await client.query<{ id: string; status: string; amount_kop: number }>(
          `SELECT id, status, amount_kop FROM orders WHERE token = $1 FOR UPDATE`,
          [orderToken],
        );
        if (orderQ.rowCount === 0) {
          await client.query("ROLLBACK");
          console.warn("[yookassa-webhook] order not found for token:", orderToken);
          return;
        }
        const order = orderQ.rows[0];

        // Идемпотентность: если уже paid — ничего не делаем.
        if (order.status === "paid") {
          await client.query("ROLLBACK");
          console.log("[yookassa-webhook] order already paid:", order.id);
          return;
        }

        // Запись в payments. ON CONFLICT (yookassa_id) — идемпотентность
        // при повторных вебхуках от ЮКассы.
        await client.query(
          `INSERT INTO payments (order_id, yookassa_id, yookassa_status, amount_kop, raw_webhook)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (yookassa_id) DO UPDATE
             SET yookassa_status = EXCLUDED.yookassa_status,
                 raw_webhook = EXCLUDED.raw_webhook`,
          [
            order.id,
            yookassaId,
            verified.status,
            order.amount_kop,
            JSON.stringify(payload),
          ],
        );

        // UPDATE заказа на paid.
        await client.query(
          `UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1`,
          [order.id],
        );

        await client.query("COMMIT");
        console.log("[yookassa-webhook] order paid:", { order_id: order.id, yookassa_id: yookassaId });
      } catch (dbErr) {
        await client.query("ROLLBACK");
        throw dbErr;
      } finally {
        client.release();
      }
    } catch (e) {
      // Любая ошибка — логируем, но ответ уже 200 отправлен.
      console.error("[yookassa-webhook] processing failed:", e);
    }
  };
}
