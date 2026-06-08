// Telegram-бот @umestno_home_bot — стадия «заглушка».
//
// На этой стадии задача проста: собрать пользователей, которым
// бот интересен. Без полноценного калькулятора. После недели-двух
// смотрим на счётчик — если 100+ /start, делаем полноценную версию
// (вариант С из обсуждения: полная замена /configure/ конверсационным
// UX в чате, оплата через TG Payments + ЮКасса).
//
// Поведение заглушки:
//   /start        — приветствие + ссылка на сайт + предложение подписаться
//   /subscribe    — добавить себя в список «уведомить когда запустим»
//   /unsubscribe  — выйти из списка (юридически — важно для 152-ФЗ)
//   /stat         — admin-only, показывает счётчик /start и подписок
//   (любое сообщение) — мягкое напоминание про /start
//
// Архитектурно — long-polling воркер, стартует вместе с API
// (см. server/index.ts). При TG_BOT_TOKEN не задан — воркер
// крутится вхолостую (логирует один раз и выходит).

import type { Pool } from "pg";
import { Bot, GrammyError, HttpError } from "grammy";

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
// TG user id админа (Дзеры) — на /stat отвечаем только ей.
// Чтобы узнать свой id: напиши боту @userinfobot в Telegram.
const TG_ADMIN_USER_ID = process.env.TG_ADMIN_USER_ID
  ? BigInt(process.env.TG_ADMIN_USER_ID)
  : null;

const SITE_URL = process.env.SITE_BASE_URL ?? "https://umestno-home.ru";

// Текст приветствия — копирайт Дзеры. Не редактируем сами.
const WELCOME_TEXT =
  "Здравствуйте! Это «Уместно» — сервис, который подбирает схему хранения " +
  "под ваш ящик.\n\n" +
  "Пока бот в разработке, и расчёт доступен только на сайте:\n" +
  `👉 ${SITE_URL}/configure/\n\n` +
  "Когда полноценный помощник в боте будет готов, пришлю весточку — " +
  "если нажмёте /subscribe, добавлю вас в список.";

const SUBSCRIBED_TEXT =
  "Готово! Сообщу, как только бот сможет считать схему прямо здесь, в чате.\n\n" +
  "А пока расчёт по ссылке: " + SITE_URL + "/configure/";

const ALREADY_SUBSCRIBED_TEXT = "Вы уже в списке. Жду запуска вместе с вами 🌿";

const UNSUBSCRIBED_TEXT =
  "Убрала вас из списка. Если передумаете — /subscribe снова добавит.";

const FALLBACK_TEXT =
  "Пока я только заглушка — расчёт схемы делается на сайте: " +
  SITE_URL + "/configure/\n\n" +
  "Чтобы получить уведомление о запуске бота, нажмите /subscribe.";

export function startTelegramWorker(pool: Pool): void {
  if (!TG_BOT_TOKEN) {
    console.log("[telegram] TG_BOT_TOKEN не задан — воркер не стартует");
    return;
  }

  const bot = new Bot(TG_BOT_TOKEN);

  // Логируем все ошибки в один поток, не падаем — long-polling
  // должен переживать сетевые сбои и rate-limit'ы Telegram.
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[telegram] error update ${ctx.update.update_id}:`, err.error);
    if (err.error instanceof GrammyError) {
      console.error("[telegram] grammy error description:", err.error.description);
    } else if (err.error instanceof HttpError) {
      console.error("[telegram] http error:", err.error);
    }
  });

  /** Регистрирует первый контакт (/start) либо обновляет username/имя
   *  при повторных заходах. ON CONFLICT — идемпотентно, не плодим записей. */
  async function rememberContact(
    userId: bigint,
    username: string | undefined,
    firstName: string | undefined,
    langCode: string | undefined,
    source: string | undefined,
  ): Promise<void> {
    await pool.query(
      `INSERT INTO bot_subscribers (tg_user_id, tg_username, tg_first_name, tg_lang, source)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tg_user_id) DO UPDATE
         SET tg_username = EXCLUDED.tg_username,
             tg_first_name = EXCLUDED.tg_first_name,
             tg_lang = COALESCE(bot_subscribers.tg_lang, EXCLUDED.tg_lang),
             source = COALESCE(bot_subscribers.source, EXCLUDED.source)`,
      [
        userId.toString(),
        username ?? null,
        firstName ?? null,
        langCode ?? null,
        source ?? null,
      ],
    );
  }

  async function markSubscribed(userId: bigint): Promise<"new" | "already"> {
    const r = await pool.query<{ subscribed_at: Date | null }>(
      `UPDATE bot_subscribers
          SET subscribed_at = COALESCE(subscribed_at, now()),
              unsubscribed_at = NULL
        WHERE tg_user_id = $1
        RETURNING subscribed_at`,
      [userId.toString()],
    );
    if (r.rowCount === 0) return "new"; // не должно случаться (rememberContact перед этим)
    // subscribed_at был NULL до COALESCE? Проверим был ли он изменён.
    // Простейший способ: если строки нет — точно новая. Если есть и
    // subscribed_at = свежая (в пределах секунды) — была NULL.
    return "new";
  }

  async function markUnsubscribed(userId: bigint): Promise<void> {
    await pool.query(
      `UPDATE bot_subscribers
          SET unsubscribed_at = now()
        WHERE tg_user_id = $1`,
      [userId.toString()],
    );
  }

  async function getStats(): Promise<{
    total_contacts: number;
    active_subscribers: number;
    contacts_24h: number;
    contacts_7d: number;
  }> {
    const r = await pool.query<{
      total_contacts: string;
      active_subscribers: string;
      contacts_24h: string;
      contacts_7d: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_contacts,
         COUNT(*) FILTER (WHERE subscribed_at IS NOT NULL AND unsubscribed_at IS NULL)::text AS active_subscribers,
         COUNT(*) FILTER (WHERE first_seen_at >= now() - interval '24 hours')::text AS contacts_24h,
         COUNT(*) FILTER (WHERE first_seen_at >= now() - interval '7 days')::text AS contacts_7d
       FROM bot_subscribers`,
    );
    const row = r.rows[0];
    return {
      total_contacts: parseInt(row.total_contacts, 10),
      active_subscribers: parseInt(row.active_subscribers, 10),
      contacts_24h: parseInt(row.contacts_24h, 10),
      contacts_7d: parseInt(row.contacts_7d, 10),
    };
  }

  // ── Команды ───────────────────────────────────────────────

  bot.command("start", async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    // /start ?source=xxx — если пользователь пришёл по UTM-подобной ссылке
    // вида t.me/umestno_home_bot?start=pinterest, TG передаёт это в payload.
    const source = ctx.match?.toString().trim() || undefined;
    await rememberContact(
      BigInt(user.id),
      user.username,
      user.first_name,
      user.language_code,
      source,
    );
    await ctx.reply(WELCOME_TEXT);
  });

  bot.command(["subscribe", "подписаться"], async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    // На случай если юзер впервые написал именно /subscribe (а не /start).
    await rememberContact(
      BigInt(user.id),
      user.username,
      user.first_name,
      user.language_code,
      undefined,
    );

    // Проверяем, был ли уже подписан до этого UPDATE'а.
    const before = await pool.query<{ was_subscribed: boolean }>(
      `SELECT (subscribed_at IS NOT NULL AND unsubscribed_at IS NULL) AS was_subscribed
         FROM bot_subscribers WHERE tg_user_id = $1`,
      [user.id.toString()],
    );
    const wasSubscribed = before.rows[0]?.was_subscribed ?? false;

    await markSubscribed(BigInt(user.id));
    await ctx.reply(wasSubscribed ? ALREADY_SUBSCRIBED_TEXT : SUBSCRIBED_TEXT);
  });

  bot.command(["unsubscribe", "отписаться"], async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    await markUnsubscribed(BigInt(user.id));
    await ctx.reply(UNSUBSCRIBED_TEXT);
  });

  bot.command(["stat", "stats", "статистика"], async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    if (TG_ADMIN_USER_ID === null || BigInt(user.id) !== TG_ADMIN_USER_ID) {
      // Не админ — притворяемся что команды нет.
      return;
    }
    const s = await getStats();
    await ctx.reply(
      `📊 Статистика бота @umestno_home_bot\n\n` +
        `Всего контактов: ${s.total_contacts}\n` +
        `Активные подписчики: ${s.active_subscribers}\n` +
        `За 24 часа: ${s.contacts_24h}\n` +
        `За 7 дней: ${s.contacts_7d}`,
    );
  });

  // ── Catch-all для произвольных сообщений ────────────────────
  // (если юзер пишет «Привет» вместо команды — отвечаем заглушкой)

  bot.on("message:text", async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    await rememberContact(
      BigInt(user.id),
      user.username,
      user.first_name,
      user.language_code,
      undefined,
    );
    await ctx.reply(FALLBACK_TEXT);
  });

  // ── Старт long-polling ──────────────────────────────────────
  // bot.start() возвращает promise, который резолвится при остановке.
  // Не await'им — пусть крутится фоном, ошибки логируются через bot.catch.
  console.log("[telegram] starting long-polling…");
  bot.start({
    onStart: (info) => {
      console.log(`[telegram] bot @${info.username} started, id=${info.id}`);
    },
  });
}
