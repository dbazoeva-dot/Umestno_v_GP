-- 0004_promo_codes_and_orders_index.sql
-- Завершение целевой структуры БД из docs/data-model.md.
--
-- Что добавляется:
-- 1. promo_codes — таблица системы промокодов. Заведена заранее
--    (даже если код применения ещё не написан), чтобы:
--    - закрыть FK от orders.promo_code_id (сейчас он dangling)
--    - оператор мог добавлять/редактировать коды через DBeaver/SQL
--      ещё до того как фронтенд получит поле ввода промо
-- 2. orders.promo_code_id REFERENCES promo_codes(id) — FK constraint
--    добавляется поверх существующей колонки (создана в 0003).
-- 3. orders_created — индекс для запросов «последние заказы за период».
--    Не критично для текущего объёма, но добавляется для полноты.
--
-- Применение (на VPS, после 0003):
--   psql -U umestno_app -d umestno -h localhost -W -f db/migrations/0004_promo_codes_and_orders_index.sql

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. promo_codes — система промокодов
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE promo_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  discount_type   text NOT NULL CHECK (discount_type IN ('percent','fixed','free')),
  discount_value  int  NOT NULL,                  -- проценты 0-100, копейки, или 100 для 'free'
  max_uses        int,                            -- NULL = безлимит
  uses_count      int  NOT NULL DEFAULT 0,
  valid_from      timestamptz,
  valid_until     timestamptz,
  notes           text,                           -- внутренние пометки оператора
  is_active       bool NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX promo_codes_active        ON promo_codes (is_active) WHERE is_active;
CREATE INDEX promo_codes_valid_until   ON promo_codes (valid_until) WHERE valid_until IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 2. orders.promo_code_id — FK constraint поверх существующей колонки
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE orders
  ADD CONSTRAINT orders_promo_code_fk
    FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id);

CREATE INDEX orders_promo_code ON orders (promo_code_id) WHERE promo_code_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 3. orders_created — индекс по времени создания (для аналитики)
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX orders_created ON orders (created_at DESC);

COMMIT;
