// POST /api/order/:token/accept-suggestion
//
// Юзер на /no-fit/ видит fit_partial-suggestion («не вошли носки, уменьшите
// до 16 пар, согласны?»). Кликает «Да» → фронт стучится сюда. Эндпойнт:
//   1. Находит оригинальный заказ по токену
//   2. Проверяет что есть suggestion в engine_output
//   3. Применяет: уменьшает volume_level конкретной категории
//   4. Запускает движок с новым input
//   5. Если получили fit_all — создаёт НОВЫЙ заказ (новый токен, та же
//      email/consent — мы их уже валидировали при первом сабмите)
//   6. Создаёт YooKassa-платёж
//   7. Возвращает { token, payment_url } для редиректа
//
// Если новый расчёт всё равно не fit_all (бывает редко — suggestion
// был посчитан раньше, но engine non-detrministic при пограничных
// размерах) — возвращаем fit_status и фронт показывает ошибку.

import { randomBytes } from "crypto";
import type { Request, Response } from "express";
import type { Pool } from "pg";
import { runUmestnoEngine } from "../../engine/index.js";
import { defaultLibraries } from "../../engine/libraries/defaultLibraries.js";
import type { SkuCatalogRow, FitStatus, VolumeLevel } from "../../engine/types.js";
import type { Env } from "../config/env.js";
import { createPayment } from "../integrations/yookassa.js";

const OFERTA_VERSION = "oferta_v1";
const PRIVACY_VERSION = "privacy_v1";

type SuccessStatus = "fit_all" | "fit_all_after_adjustment";
function isSuccess(fs: FitStatus | "no_scheme"): fs is SuccessStatus {
  return fs === "fit_all" || fs === "fit_all_after_adjustment";
}

interface StoredInput {
  drawer_width_cm: number;
  drawer_depth_cm: number;
  drawer_height_cm: number;
  storage_category: "underwear" | "soft_clothes" | "accessories" | "mixed";
  items: Array<{ content_type: string; volume_level: VolumeLevel }>;
  priority: "convenient" | "capacity" | "budget";
  color_preference?: string;
  session_id?: string;
}

interface Suggestion {
  category_id: string;
  original_level: VolumeLevel;
  suggested_level: VolumeLevel;
  suggested_count: number;
  count_unit: string;
}

function makeToken(): string {
  return randomBytes(16).toString("base64url");
}

export function acceptSuggestionHandler(
  pool: Pool,
  env: Env,
  getCatalog: () => SkuCatalogRow[],
) {
  return async (req: Request, res: Response) => {
    const { token } = req.params;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ ok: false, error: "invalid_token" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Найти оригинальный заказ + конфигурацию + промокод.
      // Промокод нужен чтобы перенести его на новый заказ — если юзер
      // применил DZERA100 (бесплатно) на исходном расчёте, при принятии
      // suggestion цена тоже должна остаться 0 ₽, а не вернуться к 149.
      const orderQ = await client.query<{
        id: string;
        status: string;
        fit_status: string;
        email: string | null;
        ip: string | null;
        user_agent: string | null;
        session_id: string | null;
        input_payload: StoredInput;
        engine_output: { suggestion?: Suggestion | null } | null;
        promo_code_id: string | null;
      }>(
        `SELECT o.id, o.status, o.fit_status, o.email, o.ip, o.user_agent,
                o.session_id, c.input_payload, c.engine_output, o.promo_code_id
           FROM orders o
           JOIN configurations c ON c.id = o.configuration_id
          WHERE o.token = $1
          FOR UPDATE`,
        [token],
      );
      if (orderQ.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ ok: false, error: "not_found" });
      }
      const order = orderQ.rows[0];

      // 2. Только fit_partial заказы могут принять suggestion.
      if (order.fit_status !== "fit_partial") {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "not_fit_partial" });
      }
      const suggestion = order.engine_output?.suggestion;
      if (!suggestion) {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "no_suggestion" });
      }
      if (!order.email) {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "no_email_on_order" });
      }

      // 3. Готовим модифицированный input — уменьшаем volume_level для
      // suggested категории. Match по двум формам имени (socks ↔
      // socks_regular) — нормализация движка может переименовать.
      const originalInput = order.input_payload;
      const modifiedItems = originalInput.items.map((it) => {
        const matches =
          it.content_type === suggestion.category_id ||
          it.content_type + "_regular" === suggestion.category_id;
        return matches ? { ...it, volume_level: suggestion.suggested_level } : it;
      });
      const modifiedInput: StoredInput = { ...originalInput, items: modifiedItems };

      // 4. Запускаем движок с новым input. Используем тот же каталог,
      // что был на момент оригинального расчёта (свежий getCatalog
      // достанет актуальный — это нормально, sku_catalog меняется редко).
      const libraries = { ...defaultLibraries, skuCatalog: getCatalog() };
      const result = runUmestnoEngine(
        modifiedInput as Parameters<typeof runUmestnoEngine>[0],
        libraries,
      ) as {
        result: unknown;
        scheme_payload: { fit_status: FitStatus; assigned_zones: Array<Record<string, unknown>> } | null;
        debug: { sku_matching_result?: Array<Record<string, unknown>> };
      };

      const fitStatus: FitStatus | "no_scheme" = result.scheme_payload?.fit_status ?? "no_scheme";
      if (!isSuccess(fitStatus)) {
        // suggestion был посчитан на основе движка — теоретически не
        // должен «провалиться» сейчас. Но если каталог изменился и
        // расчёт стал немного другим — возвращаем ошибку, юзер увидит
        // её на /no-fit/ как «увы, не получилось».
        await client.query("ROLLBACK");
        return res.status(400).json({
          ok: false,
          error: "reduction_no_longer_fits",
          fit_status: fitStatus,
        });
      }

      // 5. Создаём НОВЫЙ заказ (новый токен, новая configurations-запись).
      // Если на оригинальном заказе был применён промокод — переносим его
      // на новый заказ. Так юзер с DZERA100 (бесплатно) после принятия
      // suggestion остаётся на 0 ₽, а не возвращается к 149 ₽.
      const newToken = makeToken();
      const basePriceKop = env.PRICE_KOP;
      let amountKop = env.PAYMENT_REQUIRED ? basePriceKop : 0;
      let discountKop = env.PAYMENT_REQUIRED ? 0 : basePriceKop;
      let newStatus = env.PAYMENT_REQUIRED ? "created" : "sent_free";

      if (order.promo_code_id) {
        // Подтягиваем актуальное состояние промокода (он мог быть
        // отключён или превышен лимит за время между первой попыткой
        // и принятием suggestion — если так, просто игнорируем и
        // оставляем базовую цену; чтобы не блокировать оплату).
        const promoQ = await client.query<{
          discount_type: "percent" | "fixed" | "free";
          discount_value: number;
          is_active: boolean;
          max_uses: number | null;
          uses_count: number;
        }>(
          `SELECT discount_type, discount_value, is_active, max_uses, uses_count
             FROM promo_codes
            WHERE id = $1`,
          [order.promo_code_id],
        );
        const promo = promoQ.rows[0];
        const stillValid = promo && promo.is_active &&
          (promo.max_uses === null || promo.uses_count < promo.max_uses);
        if (stillValid) {
          let finalAmount: number;
          if (promo.discount_type === "free") {
            finalAmount = 0;
          } else if (promo.discount_type === "percent") {
            const off = Math.floor((basePriceKop * promo.discount_value) / 100);
            finalAmount = Math.max(0, basePriceKop - off);
          } else {
            finalAmount = Math.max(0, basePriceKop - promo.discount_value);
          }
          discountKop = basePriceKop - finalAmount;
          amountKop = finalAmount;
          if (amountKop === 0) newStatus = "sent_free";
          // Инкрементируем счётчик использования — это второе
          // применение того же промокода (потому что юзер уже один
          // раз его применил на оригинальном расчёте).
          await client.query(
            `UPDATE promo_codes
                SET uses_count = uses_count + 1
              WHERE id = $1
                AND is_active
                AND (max_uses IS NULL OR uses_count < max_uses)`,
            [order.promo_code_id],
          );
        }
      }

      const configResult = await client.query<{ id: string }>(
        `INSERT INTO configurations (input_payload, engine_output, fit_status)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [modifiedInput, result, fitStatus],
      );
      const newConfigId = configResult.rows[0].id;

      const newOrderResult = await client.query<{ id: string }>(
        `INSERT INTO orders (
           configuration_id, token, session_id, ip, user_agent,
           fit_status, base_price_kop, discount_kop, amount_kop, status, email,
           parent_order_id, promo_code_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          newConfigId, newToken, order.session_id, order.ip, order.user_agent,
          fitStatus, basePriceKop, discountKop, amountKop, newStatus, order.email,
          order.id, order.promo_code_id,
        ],
      );
      const newOrderId = newOrderResult.rows[0].id;

      // 6. Согласия — переиспользуем email/IP, версии актуальные.
      // По 152-ФЗ каждый расчёт — отдельная запись consent.
      await client.query(
        `INSERT INTO consents (order_id, email, consent_type, consent_version, ip, user_agent)
         VALUES ($1, $2, 'oferta', $3, $4, $5),
                ($1, $2, 'pd',     $6, $4, $5)`,
        [newOrderId, order.email, OFERTA_VERSION, order.ip, order.user_agent, PRIVACY_VERSION],
      );

      await client.query("COMMIT");

      // 7. Создаём YooKassa-платёж (вне транзакции — сетевой вызов).
      let paymentUrl: string | null = null;
      // canPay = надо ли создавать платёж в ЮКассе. Если промокод сделал
      // заказ бесплатным (amountKop=0) — оплата не нужна, статус уже
      // sent_free, юзера сразу ведём на /result/.
      const canPay = isSuccess(fitStatus) && env.PAYMENT_REQUIRED && amountKop > 0;
      if (canPay) {
        try {
          const payment = await createPayment({
            amount_kop: amountKop,
            return_url: `${env.SITE_BASE_URL}/result/?t=${encodeURIComponent(newToken)}`,
            description: "Формирование персональной схемы хранения для выдвижного ящика",
            metadata: { order_token: newToken, order_id: newOrderId },
            idempotence_key: newToken,
            customer_email: order.email,
          });
          paymentUrl = payment.confirmation?.confirmation_url ?? null;
          if (paymentUrl) {
            await pool.query(
              `INSERT INTO payments (order_id, yookassa_id, yookassa_status, amount_kop)
               VALUES ($1, $2, $3, $4)`,
              [newOrderId, payment.id, payment.status, amountKop],
            );
            await pool.query(
              `UPDATE orders SET status = 'pending' WHERE id = $1`,
              [newOrderId],
            );
          }
        } catch (e) {
          console.error("[accept-suggestion] yookassa createPayment failed", e);
        }
      }

      return res.json({
        ok: true,
        token: newToken,
        fit_status: fitStatus,
        can_pay: canPay,
        payment_url: paymentUrl,
        final_amount_kop: amountKop,
      });
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      console.error("[accept-suggestion] failed", e);
      return res.status(500).json({ ok: false, error: "internal_error" });
    } finally {
      client.release();
    }
  };
}
