// POST /api/promo/check
//
// Превью промокода для /configure/. Юзер вводит код, фронт стучится
// сюда, мы говорим — валидный, тип скидки, и итоговая сумма после
// применения. Никаких побочных эффектов — uses_count НЕ инкрементится.
// Реально применяется код в /api/calculate при сабмите заказа.
//
// Body: { code: "DZERA100" }
// Ответ (всегда 200, если запрос корректный):
//   { ok: true, valid: true, code: "DZERA100", discount_type: "free",
//     discount_value: 100, base_price_kop: 14900, final_amount_kop: 0 }
//   { ok: true, valid: false, reason: "not_found" | "inactive" |
//     "not_yet_valid" | "expired" | "exhausted" }
//
// 400 — только если в body нет строкового code.

import type { Request, Response } from "express";
import type { Pool } from "pg";
import type { Env } from "../config/env.js";
import { findValidPromoCode, calculateDiscountedAmount } from "../services/promoCodes.js";

interface CheckRequest {
  code?: unknown;
}

export function promoCheckHandler(pool: Pool, env: Env) {
  return async (req: Request, res: Response) => {
    const body = req.body as CheckRequest;
    if (typeof body?.code !== "string" || body.code.trim().length === 0) {
      return res.status(400).json({ ok: false, error: "invalid_code" });
    }

    try {
      const result = await findValidPromoCode(pool, body.code);
      if (!result.valid) {
        return res.json({ ok: true, valid: false, reason: result.reason });
      }
      const finalAmountKop = calculateDiscountedAmount(env.PRICE_KOP, result.promo);
      return res.json({
        ok: true,
        valid: true,
        code: result.promo.code,
        discount_type: result.promo.discount_type,
        discount_value: result.promo.discount_value,
        base_price_kop: env.PRICE_KOP,
        final_amount_kop: finalAmountKop,
      });
    } catch (e) {
      console.error("[promo/check] failed", e);
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  };
}
