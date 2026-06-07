// Логика валидации промокодов и расчёта итоговой суммы.
//
// Используется и в /api/promo/check (превью на /configure/ без побочных
// эффектов), и в /api/calculate (применение кода с инкрементом счётчика
// в той же транзакции что и INSERT заказа — это атомарность).
//
// Источник правды — таблица promo_codes (см. db/migrations/0004).
// Поддерживаются три типа скидки:
//   - 'free'    → итоговая сумма всегда 0, заказ сразу 'sent_free'
//   - 'percent' → discount_value (0–100), скидка от базовой цены
//   - 'fixed'   → discount_value в копейках, фиксированная сумма скидки
//
// Любая невалидность (код не найден / не активен / просрочен / превышен
// лимит) возвращается как { valid: false, reason: '...' } — без throw,
// чтобы вызывающий код мог честно отдать пользователю причину отказа.

import type { Pool, PoolClient } from "pg";

export interface PromoCodeRow {
  id: string;
  code: string;
  discount_type: "percent" | "fixed" | "free";
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  valid_from: Date | null;
  valid_until: Date | null;
  is_active: boolean;
}

export type PromoInvalidReason =
  | "not_found"
  | "inactive"
  | "not_yet_valid"
  | "expired"
  | "exhausted";

export type PromoValidationResult =
  | { valid: true; promo: PromoCodeRow }
  | { valid: false; reason: PromoInvalidReason };

/** Ищет промокод по строковому значению (регистр игнорируется) и
 *  проверяет все условия валидности. Без побочных эффектов — счётчик
 *  использований НЕ инкрементируется. Для атомарного применения в
 *  транзакции есть отдельная функция applyPromoCode().
 *
 *  Принимает либо Pool, либо PoolClient — в /api/calculate передаём
 *  client из открытой транзакции, чтобы валидация и инкремент жили
 *  в одной транзакции и не было гонок. */
export async function findValidPromoCode(
  db: Pool | PoolClient,
  code: string,
): Promise<PromoValidationResult> {
  const normalized = code.trim();
  if (!normalized) return { valid: false, reason: "not_found" };

  const q = await db.query<PromoCodeRow>(
    `SELECT id, code, discount_type, discount_value, max_uses, uses_count,
            valid_from, valid_until, is_active
       FROM promo_codes
      WHERE upper(code) = upper($1)
      LIMIT 1`,
    [normalized],
  );
  if (q.rowCount === 0) return { valid: false, reason: "not_found" };

  const promo = q.rows[0];
  if (!promo.is_active) return { valid: false, reason: "inactive" };

  const now = new Date();
  if (promo.valid_from && promo.valid_from > now) {
    return { valid: false, reason: "not_yet_valid" };
  }
  if (promo.valid_until && promo.valid_until < now) {
    return { valid: false, reason: "expired" };
  }
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    return { valid: false, reason: "exhausted" };
  }

  return { valid: true, promo };
}

/** Рассчитывает итоговую сумму после применения скидки. Не модифицирует
 *  БД — это чистая функция расчёта.
 *
 *  Минимум 0 копеек (отрицательной суммы быть не может — если fixed-скидка
 *  больше базовой цены, ограничиваем нулём). */
export function calculateDiscountedAmount(basePriceKop: number, promo: PromoCodeRow): number {
  if (promo.discount_type === "free") return 0;
  if (promo.discount_type === "percent") {
    const discountKop = Math.floor((basePriceKop * promo.discount_value) / 100);
    return Math.max(0, basePriceKop - discountKop);
  }
  // 'fixed' — discount_value в копейках
  return Math.max(0, basePriceKop - promo.discount_value);
}

/** Атомарно инкрементирует счётчик использований. Использует условие
 *  uses_count < max_uses (или max_uses IS NULL) внутри UPDATE,
 *  чтобы при гонке двух одновременных применений последнего слота
 *  один из них честно получил «exhausted» вместо превышения лимита.
 *
 *  Возвращает true если инкремент прошёл, false если лимит уже выбран
 *  (например, между findValidPromoCode и applyPromoCode успели применить
 *  тот же код параллельно). Вызывать ТОЛЬКО внутри транзакции. */
export async function applyPromoCode(client: PoolClient, promoId: string): Promise<boolean> {
  const r = await client.query(
    `UPDATE promo_codes
        SET uses_count = uses_count + 1
      WHERE id = $1
        AND is_active
        AND (max_uses IS NULL OR uses_count < max_uses)`,
    [promoId],
  );
  return (r.rowCount ?? 0) > 0;
}
