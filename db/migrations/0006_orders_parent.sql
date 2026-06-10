-- 0006_orders_parent.sql
-- Связь «переоплата после fit_partial-suggestion» с оригинальным заказом.
--
-- Сценарий: юзер сделал /api/calculate → fit_partial → попал на /no-fit/
-- с предложением «уменьшите носки до 16 пар, согласны?». Клик «Да» →
-- POST /api/order/:token/accept-suggestion создаёт НОВЫЙ заказ
-- (новый token, новая configurations-запись с уменьшенным input).
--
-- Чтобы Дзера в аналитике видела «вот эти заказы — продолжение
-- fit_partial», добавляем orders.parent_order_id с FK на orders.id.
-- Это даст:
-- - SQL-запросы «сколько fit_partial конвертилось в платёж после suggestion»
--   через JOIN на parent_order_id IS NOT NULL
-- - Триггер для будущей метрики «эффективность suggestion» (% accept)
--
-- Применение на VPS:
--   psql -U umestno_app -d umestno -h localhost -W \
--        -f db/migrations/0006_orders_parent.sql

BEGIN;

ALTER TABLE orders
  ADD COLUMN parent_order_id uuid REFERENCES orders(id);

-- Индекс для быстрого поиска «дети» данного заказа.
CREATE INDEX orders_parent ON orders (parent_order_id) WHERE parent_order_id IS NOT NULL;

COMMIT;
