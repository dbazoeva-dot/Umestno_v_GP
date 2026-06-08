-- 0005_bot_subscribers.sql
-- Подписчики Telegram-бота на старте (стадия «заглушка»).
--
-- Что копим:
-- 1. Кто пришёл в бот (tg_user_id, username, имя на момент /start) —
--    база интересующихся продуктом
-- 2. Кто нажал /подписаться — явно сказал «уведомите когда запустите
--    полноценный бот»
-- 3. Метки времени для воронки: первый контакт vs подписка
--
-- После релиза полноценного бота эта таблица станет историей
-- старта (можно делать кампанию «бот готов» по списку подписавшихся).
--
-- Применение на VPS:
--   psql -U umestno_app -d umestno -h localhost -W -f db/migrations/0005_bot_subscribers.sql

BEGIN;

CREATE TABLE bot_subscribers (
  -- TG user id — числовой, уникальный на пользователя в Telegram
  tg_user_id     bigint PRIMARY KEY,
  -- @username на момент первого контакта (может меняться, поэтому НЕ FK)
  tg_username    text,
  -- first_name из TG (для персонализации в будущих рассылках)
  tg_first_name  text,
  -- lang_code из TG (en/ru/etc.) — для будущей мультиязычности
  tg_lang        text,
  -- Когда впервые написал боту (/start)
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  -- Когда сказал «уведомите когда запустите» (NULL = пока не подписан)
  subscribed_at  timestamptz,
  -- Когда отписался (NULL = всё ещё подписан или никогда не подписывался)
  unsubscribed_at timestamptz,
  -- Откуда пришёл, если /start ?source=pinterest|site|qr — сохраняем
  source         text
);

-- Поиск активных подписчиков (для будущей рассылки «бот готов»)
CREATE INDEX bot_subscribers_active
  ON bot_subscribers (subscribed_at)
  WHERE subscribed_at IS NOT NULL AND unsubscribed_at IS NULL;

-- Аналитика «сколько /start в день»
CREATE INDEX bot_subscribers_first_seen ON bot_subscribers (first_seen_at DESC);

COMMIT;
