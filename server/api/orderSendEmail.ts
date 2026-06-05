// POST /api/order/:token/send-email
//
// Юзер на /result/ вводит email и согласие на ПДн → нажимает
// «Отправить» → форма стучится сюда. Эндпойнт:
//   1) находит заказ по токену
//   2) убеждается что заказ оплачен (status='paid')
//   3) валидирует email + согласие
//   4) фиксирует ещё одно согласие на ПДн (для аудита)
//   5) кладёт строку в emails_outbox со template='result'
//   6) Воркер (server/workers/mailer.ts) подхватит и отправит
//
// На MVP воркер шлёт письмо на FORWARD_TO_EMAIL (info@), Дзера
// форвардит клиенту вручную. Этот эндпойнт об этом ничего не знает —
// он просто кладёт строку с to_email=<emai юзера>, остальная логика
// в воркере.

import type { Request, Response } from "express";
import type { Pool } from "pg";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PRIVACY_VERSION = "privacy_v1";

interface SendEmailRequest {
  email: string;
  consent_personal_data: true;
}

export function orderSendEmailHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const { token } = req.params;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ ok: false, error: "invalid_token" });
    }

    const body = req.body as Partial<SendEmailRequest>;
    if (typeof body?.email !== "string" || !EMAIL_RE.test(body.email.trim())) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }
    if (body.consent_personal_data !== true) {
      return res.status(400).json({ ok: false, error: "consent_pd_required" });
    }
    const email = body.email.trim().toLowerCase();

    const ip = req.ip ?? null;
    const userAgent = req.get("user-agent") ?? null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const orderQ = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM orders WHERE token = $1 FOR UPDATE`,
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

      // Согласие на обработку ПДн от ИМЕННО этого получателя email.
      // Это может быть не тот же email что был при заказе (юзер мог
      // указать чужой адрес — мужу, маме и т.п.), поэтому фиксируем
      // отдельно.
      await client.query(
        `INSERT INTO consents (order_id, email, consent_type, consent_version, ip, user_agent)
         VALUES ($1, $2, 'pd', $3, $4, $5)`,
        [order.id, email, PRIVACY_VERSION, ip, userAgent],
      );

      // Строка в outbox — воркер заберёт следующим тиком (≤30 сек).
      await client.query(
        `INSERT INTO emails_outbox (to_email, template, payload, order_id)
         VALUES ($1, 'result', $2, $3)`,
        [
          email,
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
