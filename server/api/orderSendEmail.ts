// POST /api/order/:token/send-email
//
// На /result/ юзер жмёт «Отправить на почту» → шлёт пустой POST сюда.
// Email и согласие на ПДн уже зафиксированы на шаге калькулятора
// (orders.email + consents с oferta/pd), повторно ничего не спрашиваем.
//
// Что делает эндпойнт:
//   1) находит заказ по токену
//   2) убеждается что заказ оплачен (status='paid' или 'sent_free')
//   3) берёт email из orders.email
//   4) кладёт строку в emails_outbox со template='result'
//   5) Воркер (server/workers/mailer.ts) подхватит и отправит
//
// На MVP воркер шлёт письмо на FORWARD_TO_EMAIL (info@), Дзера
// форвардит клиенту вручную.

import type { Request, Response } from "express";
import type { Pool } from "pg";

export function orderSendEmailHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const { token } = req.params;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ ok: false, error: "invalid_token" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const orderQ = await client.query<{ id: string; status: string; email: string | null }>(
        `SELECT id, status, email FROM orders WHERE token = $1 FOR UPDATE`,
        [token],
      );
      if (orderQ.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ ok: false, error: "not_found" });
      }
      const order = orderQ.rows[0];
      if (order.status !== "paid" && order.status !== "sent_free") {
        await client.query("ROLLBACK");
        return res.status(402).json({ ok: false, error: "payment_required" });
      }
      if (!order.email) {
        // Теоретически невозможно — калькулятор не пускает без email.
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "no_email_on_order" });
      }

      await client.query(
        `INSERT INTO emails_outbox (to_email, template, payload, order_id)
         VALUES ($1, 'result', $2, $3)`,
        [
          order.email,
          JSON.stringify({ order_token: token, order_id: order.id }),
          order.id,
        ],
      );

      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("[order/send-email] failed", e);
      res.status(500).json({ ok: false, error: "internal_error" });
    } finally {
      client.release();
    }
  };
}
