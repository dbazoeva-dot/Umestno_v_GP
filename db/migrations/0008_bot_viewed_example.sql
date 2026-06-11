-- 0008_bot_viewed_example.sql
-- Флаг «посмотрел пример результата» для воронки внутри бота.
--
-- Контекст: на /start теперь 3 inline-кнопки. Вторая («Пример результата»)
-- показывает картинку с готовой схемой. Те, кто нажал — это сигнал
-- любопытства/недоверия; полезно для конверсионного анализа:
--   /start → viewed_example → переход на сайт / wants_bot_calc
-- Воронка по source покажет где главный барьер.
--
-- Применение на VPS:
--   psql -U umestno_app -d umestno -h localhost -W \
--        -f db/migrations/0008_bot_viewed_example.sql

BEGIN;

ALTER TABLE bot_subscribers
  ADD COLUMN viewed_example      bool        NOT NULL DEFAULT false,
  ADD COLUMN viewed_example_at   timestamptz;

-- Индекс по нажавшим — для отчётов «кто смотрел пример» в разбивке по source.
CREATE INDEX bot_subscribers_viewed_example
  ON bot_subscribers (viewed_example_at DESC)
  WHERE viewed_example;

GRANT SELECT, INSERT, UPDATE, DELETE ON bot_subscribers TO umestno_app;

COMMIT;
