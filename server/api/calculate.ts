// POST /api/calculate
//
// Принимает форму конфигуратора → гонит engine + matchSkus →
// в одной транзакции сохраняет configurations + orders +
// consents (oferta) + configuration_skus → возвращает token и
// (при fit_all в paywall-режиме) confirmation_token для виджета ЮКассы.
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
import {
  findValidPromoCode,
  calculateDiscountedAmount,
  applyPromoCode,
  type PromoCodeRow,
} from "../services/promoCodes.js";

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
  /** Email покупателя — для фискального чека ЮКассы (54-ФЗ). */
  email: string;
  /** Согласие на обработку ПДн (152-ФЗ). Без него email не принимаем. */
  consent_personal_data: true;
  /** Опциональный промокод. Если задан и валидный — применяется скидка
   *  (см. services/promoCodes.ts). Если задан и невалидный — заказ
   *  не создаётся, фронт показывает ошибку. */
  promo_code?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PRIVACY_VERSION = "privacy_v1";

interface CalculateResponse {
  token: string;
  fit_status: FitStatus | "no_scheme";
  /** true если фронт должен повести юзера на оплату (paywall + fit_all). */
  can_pay: boolean;
  /** URL для редиректа на checkout-страницу ЮКассы. null если оплата не нужна. */
  payment_url: string | null;
  /** Итоговая сумма к оплате в копейках, после применения промокода (если был). */
  final_amount_kop: number;
  /** Применённый промокод (для отображения подтверждения и аналитики). */
  promo_applied: { code: string; discount_type: string } | null;
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
  if (typeof b.email !== "string" || !EMAIL_RE.test(b.email.trim())) return false;
  return true;
}

export function calculateHandler(pool: Pool, env: Env, getCatalog: () => SkuCatalogRow[]) {
  return async (req: Request, res: Response) => {
    if (!validateRequest(req.body)) {
      return res.status(400).json({ ok: false, error: "invalid_request" });
    }
    const body = req.body as CalculateRequest;
    if (body.consent_oferta !== true) {
      return res.status(400).json({ ok: false, error: "consent_oferta_required" });
    }
    if (body.consent_personal_data !== true) {
      return res.status(400).json({ ok: false, error: "consent_pd_required" });
    }
    const email = body.email.trim().toLowerCase();

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

    // Промокод применяется только к успешным схемам (fit_all / fit_all_after_adjustment),
    // когда мы вообще берём деньги. На fit_partial / no_scheme заказ
    // и так бесплатный/без оплаты — скидка бессмысленна.
    let appliedPromo: PromoCodeRow | null = null;
    const promoCodeRaw = typeof body.promo_code === "string" ? body.promo_code.trim() : "";

    const client = await pool.connect();
    let orderId: string;
    try {
      await client.query("BEGIN");

      if (promoCodeRaw && isSuccess(fitStatus)) {
        // Валидация и применение в одной транзакции с INSERT order —
        // защита от гонки «два юзера применяют последний слот max_uses».
        const v = await findValidPromoCode(client, promoCodeRaw);
        if (!v.valid) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            ok: false, error: "invalid_promo_code", reason: v.reason,
          });
        }
        // Атомарный инкремент. Если между проверкой и UPDATE'ом кто-то
        // успел выбрать последний слот, applyPromoCode вернёт false.
        const ok = await applyPromoCode(client, v.promo.id);
        if (!ok) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            ok: false, error: "invalid_promo_code", reason: "exhausted",
          });
        }
        appliedPromo = v.promo;
        const finalAmount = calculateDiscountedAmount(basePriceKop, v.promo);
        discountKop = basePriceKop - finalAmount;
        amountKop = finalAmount;
        // Если итоговая сумма 0 — пропускаем YooKassa, ставим заказ
        // сразу в sent_free (тот же flow что dev-режим без paywall).
        if (amountKop === 0) {
          status = "sent_free";
        }
      }

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
           fit_status, base_price_kop, discount_kop, amount_kop, status, email,
           promo_code_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          configId, token, body.session_id ?? null, ip, userAgent,
          fitStatus, basePriceKop, discountKop, amountKop, status, email,
          appliedPromo?.id ?? null,
        ],
      );
      orderId = orderResult.rows[0].id;

      // 3. Согласия — журнал 152-ФЗ. Оферта + обработка ПДн фиксируются
      // отдельными записями с разными версиями, чтобы при будущем
      // обновлении любого документа можно было разделить согласия по времени.
      await client.query(
        `INSERT INTO consents (order_id, email, consent_type, consent_version, ip, user_agent)
         VALUES ($1, $2, 'oferta', $3, $4, $5),
                ($1, $2, 'pd',     $6, $4, $5)`,
        [orderId, email, OFERTA_VERSION, ip, userAgent, PRIVACY_VERSION],
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
            no_match_log?: {
              zone_id?: string;
              content_type?: string;
              division_type?: string;
              zone_w_cm?: number;
              zone_d_cm?: number;
              zone_h_cm?: number;
              unit_w_cm?: number;
              unit_d_cm?: number;
              unit_h_cm?: number;
              units_needed?: number;
              preferred_rigidity?: string;
            };
          };
          const top = m.candidates?.[0];
          const matchStatus = m.match_status ?? "no_match";

          // Если матч не нашёлся — пишем в sku_no_match_log, чтобы потом
          // приоритизировать расширение каталога (см. таблицу в 0001 +
          // engine/sku/SPEC.md). Без этой записи мы теряем сигнал «куда
          // докачать SKU», а юзер видит пустые «Подходящие органайзеры».
          if (matchStatus === "no_match" || !top?.sku_id) {
            const nm = m.no_match_log;
            if (nm) {
              await client.query(
                `INSERT INTO sku_no_match_log
                   (configuration_id, zone_id, content_type, division_type,
                    zone_w_cm, zone_d_cm, zone_h_cm,
                    unit_w_cm, unit_d_cm, unit_h_cm,
                    units_needed, preferred_rigidity)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                  configId,
                  nm.zone_id ?? null,
                  nm.content_type ?? null,
                  nm.division_type ?? null,
                  nm.zone_w_cm ?? null,
                  nm.zone_d_cm ?? null,
                  nm.zone_h_cm ?? null,
                  nm.unit_w_cm ?? null,
                  nm.unit_d_cm ?? null,
                  nm.unit_h_cm ?? null,
                  nm.units_needed ?? null,
                  nm.preferred_rigidity ?? null,
                ],
              );
            }
            continue;
          }

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
    // Создаём платёж сразу, возвращаем payment_url для редиректа.
    // Юзер платит на checkout ЮКассы, возвращается на /result/?t=TOKEN,
    // где поллинг ждёт webhook payment.succeeded → status='paid'.
    //
    // Если промокод сделал заказ бесплатным (amount_kop=0), оплату
    // пропускаем — заказ уже в sent_free, фронт сразу ведёт на /result/.
    const canPay = isSuccess(fitStatus) && env.PAYMENT_REQUIRED && amountKop > 0;
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
          customer_email: email,
        });
        paymentUrl = payment.confirmation?.confirmation_url ?? null;
        // Запоминаем yookassa_id в таблице payments — она хранит историю
        // платежных попыток (на случай ретраев и возвратов). orders.status
        // переводим в 'pending' — ждём webhook'а от ЮКассы.
        if (paymentUrl) {
          await pool.query(
            `INSERT INTO payments (order_id, yookassa_id, yookassa_status, amount_kop)
             VALUES ($1, $2, $3, $4)`,
            [orderId, payment.id, payment.status, amountKop],
          );
          await pool.query(
            `UPDATE orders SET status = 'pending' WHERE id = $1`,
            [orderId],
          );
        }
      } catch (e) {
        console.error("[yookassa] createPayment failed", e);
        // Откатывать заказ не будем — он валиден, просто платёж не создался.
        // Юзер увидит {can_pay: true, payment_url: null} и фронт покажет
        // ошибку «Не удалось перейти к оплате». Состояние дочиним вручную.
      }
    }

    const response: CalculateResponse = {
      token,
      fit_status: fitStatus,
      can_pay: canPay,
      payment_url: paymentUrl,
      final_amount_kop: amountKop,
      promo_applied: appliedPromo
        ? { code: appliedPromo.code, discount_type: appliedPromo.discount_type }
        : null,
    };
    res.json(response);
  };
}
