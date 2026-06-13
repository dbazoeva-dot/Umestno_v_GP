-- 0009_bot_retention.sql
-- Поля под удержание и запуск чат-калькулятора для @umestno_home_bot.
--
-- Контекст (см. docs/bot-ux.md):
--  - reminder_sent_at    — одно мягкое напоминание «неготовым» (ветка 3),
--                          ровно один раз. Сам отправщик пока НЕ реализован
--                          (рекомендуется включать после привязки бот↔сайт,
--                          §8 ТЗ, чтобы не написать уже купившему).
--  - launch_announced_at — разовый анонс по листу ожидания (wants_bot_calc)
--                          в момент запуска расчёта в чате (§7 ТЗ).
--  - converted_at        — отметка «этот контакт купил на сайте». Ставится из
--                          вебхука оплаты, но только если включён опц. блок §8
--                          (orders.tg_user_id). Без §8 остаётся NULL.
--
-- Колонки добавляются заранее (дёшево, не ломают текущий бот), чтобы выборки
-- рассылок и suppression-логика были готовы к включению без новой миграции.
--
-- Применение на VPS:
--   psql -U umestno_app -d umestno -h localhost -W \
--        -f db/migrations/0009_bot_retention.sql

BEGIN;

-- IF NOT EXISTS — идемпотентность при частичном применении между окружениями
-- (как в 0008).
ALTER TABLE bot_subscribers
  ADD COLUMN IF NOT EXISTS reminder_sent_at    timestamptz,
  ADD COLUMN IF NOT EXISTS launch_announced_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at        timestamptz;

-- Кому слать напоминание (ровно один раз): не отписан, не в листе ожидания
-- (он получит анонс запуска, не напоминание), не купил, ещё не напоминали.
-- Частичный индекс — отчёт/выборка идут по короткому «хвосту», не по всей
-- таблице.
CREATE INDEX IF NOT EXISTS bot_subscribers_reminder_pending
  ON bot_subscribers (first_seen_at)
  WHERE reminder_sent_at IS NULL
    AND unsubscribed_at IS NULL
    AND wants_bot_calc = false
    AND converted_at IS NULL;

-- Кому слать анонс запуска (ровно один раз): в листе ожидания, не отписан,
-- ещё не анонсировали.
CREATE INDEX IF NOT EXISTS bot_subscribers_launch_pending
  ON bot_subscribers (wants_bot_calc_at)
  WHERE wants_bot_calc
    AND unsubscribed_at IS NULL
    AND launch_announced_at IS NULL;

-- Права для приложения (паттерн из 0005/0007/0008 — чтобы на новом окружении
-- не наступить на permission denied).
GRANT SELECT, INSERT, UPDATE, DELETE ON bot_subscribers TO umestno_app;

COMMIT;
