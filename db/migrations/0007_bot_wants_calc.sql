-- 0007_bot_wants_calc.sql
-- Флаг «хочу считать прямо в боте» для замера спроса на диалоговый калькулятор.
--
-- Контекст: на /start бот показывает 2 inline-кнопки. URL-кнопка ведёт на
-- сайт (трекаем через UTM). Callback-кнопка «Хочу считать прямо здесь, в чате»
-- — нажатие = явный сигнал «хочу полноценный TG-калькулятор». Доля нажатий
-- этой кнопки от общего числа /start — это и есть метрика спроса для решения
-- «делать ли вариант С (диалоговый калькулятор в TG)».
--
-- Применение на VPS:
--   psql -U umestno_app -d umestno -h localhost -W \
--        -f db/migrations/0007_bot_wants_calc.sql

BEGIN;

ALTER TABLE bot_subscribers
  ADD COLUMN wants_bot_calc      bool        NOT NULL DEFAULT false,
  ADD COLUMN wants_bot_calc_at   timestamptz;

-- Индекс по wants_bot_calc только для тех кто нажал — отчёт «кто хочет диалог»
-- работает по короткому списку, не сканирует всю таблицу.
CREATE INDEX bot_subscribers_wants_calc
  ON bot_subscribers (wants_bot_calc_at DESC)
  WHERE wants_bot_calc;

-- Права для приложения (на новые колонки GRANT'ы наследуются, но на всякий
-- случай явный GRANT — чтобы при разворачивании на новом окружении не
-- наступить на permission denied как с bot_subscribers в 0005.
GRANT SELECT, INSERT, UPDATE, DELETE ON bot_subscribers TO umestno_app;

COMMIT;
