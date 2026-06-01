-- 0002_sku_affiliate_url.sql
-- Расщепляем product_url на публичную + партнёрскую: добавляем
-- две новые колонки в таблицу sku. На уровне API партнёрская
-- предпочитается публичной (см. server/api/result.ts), на уровне
-- каталога они существуют независимо (см. loadSkuToPostgres.py).
--
-- expected_affiliate_cpa — ожидаемая выручка с одного успешного
-- клика (формат свободный: «3%», «150 ₽», «вилка 80-120»). Для
-- бизнес-аналитики, на фронт не отдаём.
--
-- Применение (на VPS):
--   psql -U umestno_app -d umestno -h localhost -f db/migrations/0002_sku_affiliate_url.sql

BEGIN;

ALTER TABLE sku
  ADD COLUMN IF NOT EXISTS affiliate_url           text,
  ADD COLUMN IF NOT EXISTS expected_affiliate_cpa  text;

COMMIT;
