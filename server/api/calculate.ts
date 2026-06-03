// POST /api/calculate
//
// Принимает форму конфигуратора → гонит engine + matchSkus →
// в одной транзакции сохраняет configurations + orders +
// consents (oferta) + configuration_skus → возвращает token и
// (при fit_all в paywall-режиме) payment_url для редиректа на YooKassa.
//
// Модель данных — docs/data-model.md, раздел «Жизненный цикл заказа».
// Контракт запроса — фронт из configure/index.html (calc.js).

import { randomBytes } from "crypto";
import type { Request, Response } from "express";
import type { Pool } from "pg";
import { runUmestnoEngine } from "../../engine/index.js";
import { defaultLibraries } from "../../engine/libraries/defaultLibraries.js";
import type { SkuCatalogRow, FitStatus } from "../../engine/types.js";
import type { Env } from "../config/env.js";
import { createPayment } from "../integrations/yookassa.js";

// Текущая версия оферты. Меняется при редактировании самой оферты —
// при изменении завести новый код ('oferta_v2', …), старые согласия
// остаются с прежней версией для аудита.
const OFERTA_VERSION = "oferta_v1";

// Какие fit_status считаются «успехом» — за них берём деньги.
type SuccessStatus = "fit_all" | "fit_all_after_adjustment";
function isSuccess(fs: FitStatus | "no_scheme"): fs is SuccessStatus {
  return fs === "fit_all" || fs === "fit_all_after_adjustment";
}

interface CalculateRequest {
  drawer_width_cm: number;
  drawer_depth_cm: number;
  drawer_height_cm: number;
  storage_category: "underwear" | "soft_clothes" | "accessories" | "mixed";
  items: Array<{ content_type: string; volume_level: "small" | "medium" | "large" }>;
  priority: "convenient" | "capacity" | "budget";
  color_preference?: string;
  session_id?: string;
  consent_oferta: true;
  /** Email покупателя — для фискального чека ЮКассы и доставки PDF. */
  email: string;
}

// Простая валидация email: «что-то@что-то.что-то», достаточная для отсева
// очевидно битых вводов. Жёсткая проверка не нужна — ЮКасса всё равно
// отвергнет невалидный, и юзер увидит ошибку.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface CalculateResponse {
  token: string;
  fit_status: FitStatus | "no_scheme";
  /** true если фронт должен повести юзера на оплату (paywall + fit_all). */
  can_pay: boolean;
  /** URL для редиректа на YooKassa. null если не нужно оплачивать
   *  (dev-режим, или fit_status не успешный). */
  payment_url: string | null;
}

function makeToken(): string {
  // 16 байт → 22 url-safe символа, достаточно для непредсказуемости
  return randomBytes(16).toString("base64url");
}

function validateRequest(body: unknown): body is CalculateRequest {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.drawer_width_cm !== "number" || b.drawer_width_cm <= 0) return false;
  if (typeof b.drawer_depth_cm !== "number" || b.drawer_depth_cm <= 0) return false;
  if (typeof b.drawer_height_cm !== "number" || b.drawer_height_cm <= 0) return false;
  if (typeof b.storage_category !== "string") return false;
  if (!Array.isArray(b.items) || b.items.length === 0) return false;
  if (typeof b.priority !== "string") return false;
  // ТЕСТ №5: email временно не валидируем — проверяем гипотезу что
  // ЮКасса соберёт его на checkout без customer в receipt.
  return true;
}

export function calculateHandler(pool: Pool, env: Env, getCatalog: () => SkuCatalogRow[]) {
  return async (req: Request, res: Response) => {
    if (!validateRequest(req.body)) {
      return res.status(400).json({ ok: false, error: "invalid_request" });
    }
    const body = req.body as CalculateRequest;
    if (body.consent_oferta !== true) {
      return res.status(400).json({ ok: false, error: "consent_required" });
    }
    // ТЕСТ №5: email временно опционален.
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;

    // Передаём актуальный каталог в engine через libraries (не мутируя
    // глобальный defaultLibraries — это важно для конкурентных запросов).
    const libraries = { ...defaultLibraries, skuCatalog: getCatalog() };

    const result = runUmestnoEngine(
      {
        drawer_width_cm: body.drawer_width_cm,
        drawer_depth_cm: body.drawer_depth_cm,
        drawer_height_cm: body.drawer_height_cm,
        storage_category: body.storage_category,
        items: body.items,
        priority: body.priority,
        color_preference: body.color_preference,
      } as Parameters<typeof runUmestnoEngine>[0],
      libraries,
    ) as {
      result: unknown;
      scheme_payload: { fit_status: FitStatus; assigned_zones: Array<Record<string, unknown>> } | null;
      debug: { sku_matching_result?: Array<Record<string, unknown>> };
    };

    const token = makeToken();
    const fitStatus: FitStatus | "no_scheme" = result.scheme_payload?.fit_status ?? "no_scheme";

    // Решаем коммерческое поведение: status / amount_kop / discount_kop.
    // См. таблицу сценариев в docs/data-model.md.
    const basePriceKop = env.PRICE_KOP;
    let status: string;
    let discountKop: number;
    let amountKop: number;

    if (isSuccess(fitStatus)) {
      if (env.PAYMENT_REQUIRED) {
        // Paywall: ждём оплату через YooKassa.
        status = "created";
        discountKop = 0;
        amountKop = basePriceKop;
      } else {
        // Dev-режим разработчика: status='sent_free' сразу, юзер видит результат.
        status = "sent_free";
        discountKop = basePriceKop;
        amountKop = 0;
      }
    } else {
      // fit_partial / fit_none / no_scheme — оплату не предлагаем,
      // status остаётся 'created' навсегда. amount_kop=base_price_kop
      // фиксируем для аналитики упущенного дохода (см. data-model.md).
      status = "created";
      discountKop = 0;
      amountKop = basePriceKop;
    }

    // ip — реальный клиентский (с учётом trust proxy='loopback' в index.ts),
    // user_agent — из заголовка; оба для аудита согласий и 152-ФЗ.
    const ip = req.ip ?? null;
    const userAgent = req.get("user-agent") ?? null;

    const client = await pool.connect();
    let orderId: string;
    try {
      await client.query("BEGIN");

      // 1. Технический след движка
      const configResult = await client.query<{ id: string }>(
        `INSERT INTO configurations (input_payload, engine_output, fit_status)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [body, result, fitStatus],
      );
      const configId = configResult.rows[0].id;

      // 2. Коммерческая сущность — заказ
      const orderResult = await client.query<{ id: string }>(
        `INSERT INTO orders (
           configuration_id, token, session_id, ip, user_agent,
           fit_status, base_price_kop, discount_kop, amount_kop, status, email
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          configId, token, body.session_id ?? null, ip, userAgent,
          fitStatus, basePriceKop, discountKop, amountKop, status, email,
        ],
      );
      orderId = orderResult.rows[0].id;

      // 3. Согласие с офертой — журнал 152-ФЗ
      await client.query(
        `INSERT INTO consents (order_id, consent_type, consent_version, ip, user_agent)
         VALUES ($1, 'oferta', $2, $3, $4)`,
        [orderId, OFERTA_VERSION, ip, userAgent],
      );

      // 4. Подобранные SKU по зонам (если схема построена)
      if (result.scheme_payload && result.debug.sku_matching_result) {
        const matches = result.debug.sku_matching_result;
        for (let i = 0; i < matches.length; i++) {
          const m = matches[i] as {
            zone_id?: string;
            content_type?: string;
            match_status?: string;
            match_kind?: string | null;
            units_needed?: number;
            packs_needed?: number;
            candidates?: Array<{ sku_id?: string; set_quantity?: number }>;
          };
          const top = m.candidates?.[0];
          const matchStatus = m.match_status ?? "no_match";
          if (matchStatus === "no_match" || !top?.sku_id) continue;

          await client.query(
            `INSERT INTO configuration_skus
               (configuration_id, sku_id, zone_id, content_type, block_index,
                units_needed, packs_needed, set_quantity_snap, match_status, match_kind)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              configId,
              top.sku_id,
              m.zone_id ?? null,
              m.content_type ?? null,
              i,
              m.units_needed ?? 1,
              m.packs_needed ?? 1,
              top.set_quantity ?? 1,
              matchStatus,
              m.match_kind ?? null,
            ],
          );
        }
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    // can_pay = надо отвести юзера на оплату YooKassa.
    // Для fit_all + paywall режима создаём платёж сразу — фронт
    // редиректит юзера на payment_url. Дальше юзер вернётся на
    // /result/?t=TOKEN, где сработает поллинг до status='paid'.
    const canPay = isSuccess(fitStatus) && env.PAYMENT_REQUIRED;
    let paymentUrl: string | null = null;

    if (canPay) {
      try {
        const payment = await createPayment({
          amount_kop: amountKop,
          return_url: `${env.SITE_BASE_URL}/result/?t=${encodeURIComponent(token)}`,
          description: "Формирование персональной схемы хранения для выдвижного ящика",
          metadata: { order_token: token, order_id: orderId },
          // token — наш идемпотентный ID; за одну попытку сабмита формы
          // создаётся ровно один YooKassa-платёж. Если фронт случайно
          // повторит запрос с тем же телом — YooKassa вернёт тот же
          // платёж, дубля не будет.
          idempotence_key: token,
          // ТЕСТ №5: customer_email не передаём — receipt.customer убран.
          customer_email: email ?? undefined,
        });
        paymentUrl = payment.confirmation?.confirmation_url ?? null;
        // Запоминаем yookassa_id чтобы потом сматчить webhook и
        // активной проверкой через getPayment(). Статус 'pending' уже
        // выставлен внутри транзакции выше.
        if (paymentUrl) {
          await pool.query(
            `UPDATE orders SET status = 'pending' WHERE id = $1`,
            [orderId],
          );
        }
      } catch (e) {
        console.error("[yookassa] createPayment failed", e);
        // Откатывать заказ не будем — он валиден, просто платёж не
        // создался. Юзер увидит {can_pay: true, payment_url: null} и
        // фронт покажет ошибку «Не удалось перейти к оплате».
        // Состояние можно дочинить позже вручную.
      }
    }

    const response: CalculateResponse = {
      token,
      fit_status: fitStatus,
      can_pay: canPay,
      payment_url: paymentUrl,
    };
    res.json(response);
  };
}
