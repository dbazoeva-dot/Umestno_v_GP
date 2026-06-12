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
import { Bot, GrammyError, HttpError, InlineKeyboard, InputFile } from "grammy";
import { promises as fs } from "fs";

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
// TG user id админа (Дзеры) — на /stat отвечаем только ей.
// Чтобы узнать свой id: напиши боту @userinfobot в Telegram.
const TG_ADMIN_USER_ID = process.env.TG_ADMIN_USER_ID
  ? BigInt(process.env.TG_ADMIN_USER_ID)
  : null;

const SITE_URL = process.env.SITE_BASE_URL ?? "https://umestno-home.ru";

// Текст приветствия — копирайт Дзеры. Не редактируем сами.
// Буллиты ▪️ — маленькие чёрные квадраты (emoji-вариант, на тёмной
// и светлой темах TG читаются стабильно). parse_mode HTML —
// <b>…</b> для выделения болдом.
const WELCOME_TEXT =
  "Привет!\n\n" +
  "Это «Уместно» — сервис, который создан, чтобы навести порядок " +
  "в ящике раз и навсегда.\n\n" +
  "Вы указываете размеры ящика и что хотите в нём хранить, и за 3 минуты получаете:\n" +
  "▪️ схему хранения под размеры ящика с зонированием по типам вещей;\n" +
  "▪️ размер каждой зоны;\n" +
  "▪️ рекомендации по складыванию и хранению по типам вещей;\n" +
  "▪️ рекомендации по органайзерам со ссылками на маркетплейсы.\n\n" +
  "149 ₽ за расчёт, без подписок. Не получится собрать схему — не платите.";

const WANTS_BOT_CALC_TEXT =
  "Скоро запустим расчёт прямо в Telegram. Вы в списке первых. " +
  "Как только будет готово, напишем сюда.";

// parse_mode HTML — болдим «рассчитаем индивидуально, под нужные размеры».
const EXAMPLE_CAPTION =
  "Так выглядит готовая схема. Под Ваш ящик мы " +
  "<b>рассчитаем индивидуально, под нужные размеры</b>, вещи и их количество.";

// Путь к картинке-примеру. Файл лежит в репо в assets/bot/. На проде
// репозиторий развёрнут в /var/www/umestno, поэтому абсолютный путь —
// как у PDF_STORAGE_DIR в mailer.ts/pdf.ts. Можно переопределить через
// BOT_EXAMPLE_IMAGE_PATH в .env (для dev/другого окружения). Если файла
// нет — callback «Пример результата» отправит текстовый fallback.
// См. assets/bot/README.md.
const EXAMPLE_IMAGE_PATH =
  process.env.BOT_EXAMPLE_IMAGE_PATH ??
  "/var/www/umestno/assets/bot/bot_example_vertical.jpg";

async function exampleImageExists(): Promise<boolean> {
  try {
    await fs.access(EXAMPLE_IMAGE_PATH);
    return true;
  } catch {
    return false;
  }
}

// UTM-параметры для URL-кнопки в /start. <source> подставляется из
// bot_subscribers.source (deeplink ?start=канал), пустой → 'organic'.
// Если в БД лежит «грязный» source (с пробелами/символами) — санитайзится
// до латиницы/цифр/подчёркивания перед попаданием в URL.
function buildSiteUrl(source: string | null): string {
  const safe = sanitizeSource(source) || "organic";
  const params = new URLSearchParams({
    utm_source: "telegram",
    utm_medium: "bot",
    utm_campaign: "bot_start",
    utm_term: safe,
  });
  return `${SITE_URL}/configure/?${params.toString()}`;
}

// Допустимые символы — латиница/цифры/подчёркивание. Имена каналов
// (tg_homechannel1, pinterest) подходят. Кириллица и спецсимволы
// чистятся, чтобы UTM не сломался при копировании ссылки и Метрика
// корректно атрибутировала.
function sanitizeSource(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 64);
}

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

  // На российском хостинге (Timeweb) прямой доступ к api.telegram.org
  // заблокирован на сетевом уровне. Поэтому ходим через Cloudflare Worker-
  // прокси (TG_API_ROOT в .env, например
  // https://umestno-tg-proxy.d-bazoeva.workers.dev). Воркер вне РФ
  // прозрачно проксирует всё на api.telegram.org. Если TG_API_ROOT не
  // задан — grammy ходит напрямую (для окружений где TG доступен).
  const apiRoot = process.env.TG_API_ROOT;
  const bot = apiRoot
    ? new Bot(TG_BOT_TOKEN, { client: { apiRoot } })
    : new Bot(TG_BOT_TOKEN);
  if (apiRoot) {
    console.log(`[telegram] using API proxy: ${apiRoot}`);
  }

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
    viewed_example: number;
    viewed_example_pct: number;
    wants_bot_calc: number;
    wants_bot_calc_pct: number;
    by_source: Array<{ source: string; total: number; viewed: number; wants: number }>;
  }> {
    const r = await pool.query<{
      total_contacts: string;
      active_subscribers: string;
      contacts_24h: string;
      contacts_7d: string;
      viewed_example: string;
      wants_bot_calc: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_contacts,
         COUNT(*) FILTER (WHERE subscribed_at IS NOT NULL AND unsubscribed_at IS NULL)::text AS active_subscribers,
         COUNT(*) FILTER (WHERE first_seen_at >= now() - interval '24 hours')::text AS contacts_24h,
         COUNT(*) FILTER (WHERE first_seen_at >= now() - interval '7 days')::text AS contacts_7d,
         COUNT(*) FILTER (WHERE viewed_example)::text AS viewed_example,
         COUNT(*) FILTER (WHERE wants_bot_calc)::text AS wants_bot_calc
       FROM bot_subscribers`,
    );
    const row = r.rows[0];
    const total = parseInt(row.total_contacts, 10);
    const viewed = parseInt(row.viewed_example, 10);
    const wants = parseInt(row.wants_bot_calc, 10);

    // Воронка по источникам — топ-10 за всё время. Для каждого source
    // считаем сколько /start, сколько viewed_example, сколько wants_bot_calc.
    // По этим цифрам понятно где главный барьер: если viewed высокий
    // а wants/url-переходы низкие — формулировка не убеждает.
    const bySourceQ = await pool.query<{
      source: string | null;
      total: string;
      viewed: string;
      wants: string;
    }>(
      `SELECT
         COALESCE(source, 'organic') AS source,
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE viewed_example)::text AS viewed,
         COUNT(*) FILTER (WHERE wants_bot_calc)::text AS wants
       FROM bot_subscribers
       GROUP BY COALESCE(source, 'organic')
       ORDER BY COUNT(*) DESC
       LIMIT 10`,
    );

    return {
      total_contacts: total,
      active_subscribers: parseInt(row.active_subscribers, 10),
      contacts_24h: parseInt(row.contacts_24h, 10),
      contacts_7d: parseInt(row.contacts_7d, 10),
      viewed_example: viewed,
      viewed_example_pct: total > 0 ? Math.round((viewed / total) * 100) : 0,
      wants_bot_calc: wants,
      wants_bot_calc_pct: total > 0 ? Math.round((wants / total) * 100) : 0,
      by_source: bySourceQ.rows.map((r) => ({
        source: r.source ?? "organic",
        total: parseInt(r.total, 10),
        viewed: parseInt(r.viewed, 10),
        wants: parseInt(r.wants, 10),
      })),
    };
  }

  // ── Команды ───────────────────────────────────────────────

  bot.command("start", async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    // /start payload — если пользователь пришёл по deeplink'у
    // t.me/umestno_home_bot?start=tg_homechannel1, TG передаёт 'tg_homechannel1'
    // в ctx.match. Это source для бот-аналитики (откуда пришёл).
    const startPayload = ctx.match?.toString().trim() || undefined;
    await rememberContact(
      BigInt(user.id),
      user.username,
      user.first_name,
      user.language_code,
      startPayload,
    );

    // Source для UTM-кнопки берём ИЗ ЗАПИСИ подписчика (не из текущего
    // вызова) — потому что повторный /start может прийти без deeplink'а,
    // а исходный source должен сохраниться. rememberContact с COALESCE
    // оставляет первый source при повторных контактах.
    const subQ = await pool.query<{ source: string | null }>(
      `SELECT source FROM bot_subscribers WHERE tg_user_id = $1`,
      [user.id.toString()],
    );
    const subscriberSource = subQ.rows[0]?.source ?? null;

    const keyboard = new InlineKeyboard()
      .url("Рассчитать схему →", buildSiteUrl(subscriberSource))
      .row()
      .text("Пример результата", "viewed_example")
      .row()
      .text("Хочу считать прямо здесь, в чате", "wants_bot_calc");

    await ctx.reply(WELCOME_TEXT, { reply_markup: keyboard, parse_mode: "HTML" });
  });

  // Callback кнопки «Пример результата» — показывает картинку с
  // подписью «так выглядит готовая схема». Под картинкой дублируем
  // URL-кнопку «Рассчитать схему» с тем же UTM-source, чтобы юзер
  // не возвращался в меню после просмотра. Логируем нажатие в БД
  // для воронки внутри бота.
  bot.callbackQuery("viewed_example", async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    await rememberContact(
      BigInt(user.id),
      user.username,
      user.first_name,
      user.language_code,
      undefined,
    );
    // Идемпотентно ставим viewed_example=true + timestamp.
    await pool.query(
      `UPDATE bot_subscribers
          SET viewed_example = true,
              viewed_example_at = COALESCE(viewed_example_at, now())
        WHERE tg_user_id = $1`,
      [user.id.toString()],
    );

    // Source для дублирующей URL-кнопки — тот же, что был при /start.
    const subQ = await pool.query<{ source: string | null }>(
      `SELECT source FROM bot_subscribers WHERE tg_user_id = $1`,
      [user.id.toString()],
    );
    const subscriberSource = subQ.rows[0]?.source ?? null;
    // Под картинкой-примером — две кнопки (чтобы не было тупика):
    // URL на /configure/ (тот же UTM что в меню) + callback «хочу в чате»
    // (тот же что в меню). Так после просмотра примера у юзера снова
    // есть оба пути действия.
    const exampleKeyboard = new InlineKeyboard()
      .url("Рассчитать схему под мои размеры →", buildSiteUrl(subscriberSource))
      .row()
      .text("Хочу считать прямо здесь, в чате", "wants_bot_calc");

    await ctx.answerCallbackQuery();

    // Если файл картинки в репо — отправляем фото с подписью.
    // Если нет — текстовый fallback с тем же текстом и кнопками.
    if (await exampleImageExists()) {
      await ctx.replyWithPhoto(new InputFile(EXAMPLE_IMAGE_PATH), {
        caption: EXAMPLE_CAPTION,
        reply_markup: exampleKeyboard,
        parse_mode: "HTML",
      });
    } else {
      console.warn("[telegram] bot example image missing:", EXAMPLE_IMAGE_PATH);
      await ctx.reply(EXAMPLE_CAPTION + "\n\nПосмотреть на сайте: " + SITE_URL + "/result/", {
        reply_markup: exampleKeyboard,
        parse_mode: "HTML",
      });
    }
  });

  // Callback кнопки «Хочу считать прямо здесь, в чате» — ставит флаг
  // wants_bot_calc в БД. Эта метрика — доля от общего числа /start —
  // основной сигнал для решения по варианту С (диалоговый калькулятор
  // в TG с TG Payments).
  bot.callbackQuery("wants_bot_calc", async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    // На всякий случай регистрируем — вдруг callback прилетел от юзера,
    // которого ещё нет в БД (теоретически возможно при долгой задержке
    // обработки или повторной отправке).
    await rememberContact(
      BigInt(user.id),
      user.username,
      user.first_name,
      user.language_code,
      undefined,
    );
    // Ставим флаг + timestamp. ON CONFLICT не нужен — INSERT уже сделан
    // rememberContact'ом, тут только UPDATE существующей строки.
    await pool.query(
      `UPDATE bot_subscribers
          SET wants_bot_calc = true,
              wants_bot_calc_at = COALESCE(wants_bot_calc_at, now())
        WHERE tg_user_id = $1`,
      [user.id.toString()],
    );

    // Confirm нажатие, чтобы у пользователя пропал индикатор «загрузка».
    await ctx.answerCallbackQuery();
    await ctx.reply(WANTS_BOT_CALC_TEXT);
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
    const sourceLines = s.by_source.length === 0
      ? "  (нет данных)"
      : s.by_source
          .map((r) => `  ${r.source}: ${r.total} /start, ${r.viewed} пример, ${r.wants} хотят TG`)
          .join("\n");
    await ctx.reply(
      `📊 Статистика бота @umestno_home_bot\n\n` +
        `Всего контактов: ${s.total_contacts}\n` +
        `Активные подписчики (/subscribe): ${s.active_subscribers}\n` +
        `Смотрели пример: ${s.viewed_example} (${s.viewed_example_pct}%)\n` +
        `Хотят считать в TG: ${s.wants_bot_calc} (${s.wants_bot_calc_pct}%)\n\n` +
        `За 24 часа: ${s.contacts_24h}\n` +
        `За 7 дней: ${s.contacts_7d}\n\n` +
        `По источникам (топ-10):\n${sourceLines}`,
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
