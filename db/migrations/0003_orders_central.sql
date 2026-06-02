-- 0003_orders_central.sql
-- Переход на модель: orders как центральная коммерческая сущность,
-- configurations как технический след движка.
--
-- Подробности и обоснование — в docs/data-model.md.
--
-- Что меняется:
-- 1. orders дополняется коммерческими полями (token переезжает из
--    configurations, ip/user_agent/session_id для 152-ФЗ,
--    base_price_kop/discount_kop/amount_kop для аналитики дохода,
--    fit_status дублируется для воронки без JOIN).
-- 2. configurations лишается коммерческих полей (token, session_id).
-- 3. consents теперь привязан к orders, а не к configurations.
-- 4. emails_outbox получает FK на orders.
-- 5. subscribers лишается configuration_id (по ADR в data-model.md —
--    «последний заказ» получаем подзапросом, без денормализации).
-- 6. affiliate_clicks: configuration_id переименован в order_id
--    (soft FK как был).
--
-- Применение (на VPS, после backup'а):
--   psql -U umestno_app -d umestno -h localhost -W -f db/migrations/0003_orders_central.sql

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 0. Очистка существующих тестовых данных
--
-- Согласовано: текущие configurations / consents / configuration_skus
-- — это тестовые расчёты Дзеры из dev-периода, готовы их потерять.
-- Сохраняются:
--   - sku и весь SKU-домен (каталог, реальные данные)
--   - subscribers / affiliate_clicks (пустые сейчас, но FK сохраняем)
-- ═══════════════════════════════════════════════════════════════════

DELETE FROM configuration_skus;
DELETE FROM consents;
DELETE FROM orders;
DELETE FROM configurations;

-- ═══════════════════════════════════════════════════════════════════
-- 1. orders — добавляем коммерческие поля
-- ═══════════════════════════════════════════════════════════════════

-- email раньше был NOT NULL — теперь NULL пока юзер не оставит почту
ALTER TABLE orders ALTER COLUMN email DROP NOT NULL;

ALTER TABLE orders
  ADD COLUMN token           text        NOT NULL,
  ADD COLUMN session_id      text,
  ADD COLUMN ip              inet,
  ADD COLUMN user_agent      text,
  ADD COLUMN fit_status      text        NOT NULL
    CHECK (fit_status IN ('fit_all','fit_all_after_adjustment','fit_partial','fit_none','no_scheme')),
  ADD COLUMN base_price_kop  int         NOT NULL,
  ADD COLUMN discount_kop    int         NOT NULL DEFAULT 0,
  ADD COLUMN promo_code_id   uuid,                   -- FK на promo_codes появится в 0004
  ADD COLUMN refunded_at     timestamptz,
  ADD COLUMN phone           text,
  ADD CONSTRAINT orders_token_unique UNIQUE (token);

-- Индексы под новые поля
CREATE INDEX IF NOT EXISTS orders_token       ON orders (token);
CREATE INDEX IF NOT EXISTS orders_fit         ON orders (fit_status);
CREATE INDEX IF NOT EXISTS orders_session     ON orders (session_id);

-- ═══════════════════════════════════════════════════════════════════
-- 2. configurations — лишаем коммерческих полей (token и session_id
--    переехали в orders)
-- ═══════════════════════════════════════════════════════════════════

-- индекс configurations_token уходит вместе с колонкой
ALTER TABLE configurations
  DROP COLUMN token,
  DROP COLUMN session_id;

-- ═══════════════════════════════════════════════════════════════════
-- 3. consents — переориентируем на orders
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE consents
  ADD COLUMN order_id uuid NOT NULL REFERENCES orders(id),
  DROP COLUMN configuration_id;

CREATE INDEX IF NOT EXISTS consents_order ON consents (order_id);

-- ═══════════════════════════════════════════════════════════════════
-- 4. emails_outbox — добавляем FK на order (nullable, потому что
--    маркетинговые письма могут не быть привязаны к заказу)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE emails_outbox
  ADD COLUMN order_id uuid REFERENCES orders(id);

CREATE INDEX IF NOT EXISTS emails_outbox_order ON emails_outbox (order_id) WHERE order_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 5. subscribers — снимаем денормализацию (ADR в data-model.md)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE subscribers DROP COLUMN configuration_id;

-- ═══════════════════════════════════════════════════════════════════
-- 6. affiliate_clicks — переименование soft FK
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE affiliate_clicks RENAME COLUMN configuration_id TO order_id;
-- order_id остаётся soft FK (без REFERENCES), как и configuration_id был

-- Старый индекс affiliate_clicks_config был на configuration_id —
-- переименовываем для соответствия колонке
ALTER INDEX affiliate_clicks_config RENAME TO affiliate_clicks_order;

COMMIT;
