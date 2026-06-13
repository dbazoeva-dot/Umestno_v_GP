// Telegram-бот @umestno_home_bot — стадия «заглушка».
//
// На этой стадии задача проста: собрать пользователей, которым
// бот интересен. Без полноценного калькулятора. После недели-двух
// смотрим на счётчик — если 100+ /start, делаем полноценную версию
// (вариант С из обсуждения: полная замена /configure/ конверсационным
// UX в чате, оплата через TG Payments + ЮКасса).
//
// Поведение (UX по docs/bot-ux.md):
//   /start        — приветствие + 3 кнопки: сайт (ветка 1), пример (2a),
//                   «посчитать в чате» (ветка 2 — замер спроса)
//   /help         — список частых вопросов (FAQ)
//   /stop         — опт-аут от напоминаний (152-ФЗ; алиас /unsubscribe)
//   /stat         — admin-only, воронка по источникам
//   (любое сообщение) — фолбэк с кнопками меню + входом в FAQ
//
// Три ветки готовности обслуживаются без тупиков; FAQ — развязка, которая
// всегда возвращает к действию. Поля под удержание (reminder_sent_at,
// launch_announced_at, converted_at) добавлены миграцией 0009 — сами
// рассылки и диалоговый калькулятор пока НЕ реализованы (см. ТЗ §6–§8, §12).
//
// Архитектурно — long-polling воркер, стартует вместе с API
// (см. server/index.ts). При TG_BOT_TOKEN не задан — воркер
// крутится вхолостую (логирует один раз и выходит).

import type { Pool } from "pg";
import { Bot, Context, GrammyError, HttpError, InlineKeyboard, InputFile } from "grammy";
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
  "Записала Вас в список первых 🌿 Как только расчёт заработает прямо " +
  "здесь, в чате — сразу напишу сюда.\n\n" +
  "А если ждать не хочется — схему можно собрать на сайте уже сейчас, " +
  "это те же 3 минуты.";

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

const UNSUBSCRIBED_TEXT =
  "Готово, больше напоминать не буду. Если передумаете — напишите /start, " +
  "я снова рядом.";

const FALLBACK_TEXT =
  "Я пока умею немного 🙂 Чтобы собрать схему под Ваш ящик — выберите, " +
  "как удобнее:";

// ── FAQ — частые вопросы ────────────────────────────────────
// Меню inline-кнопок (надёжнее распознавания свободного текста на русском
// с опечатками). Входы: кнопка «Частые вопросы» под примером и в фолбэке,
// команда /help. Петля без тупика: действия есть и на самом списке вопросов,
// и в каждом ответе (действие по теме + «← К вопросам»). См. docs/bot-ux.md §5.

const FAQ_LIST_TEXT = "Частые вопросы. Выберите, что интересно:";

const FAQ_ANSWERS: Record<string, string> = {
  price:
    "149 ₽ за один расчёт. Без подписок и скрытых доплат. Если под Ваши " +
    "размеры собрать надёжную схему не удастся — оплаты не будет.",
  engine:
    "Программа — по размерам именно Вашего ящика и списку вещей. Это не " +
    "готовый шаблон: зоны и их размеры рассчитываются под Ваш случай.",
  result:
    "Схему с зонами под Ваши вещи, размер каждой зоны, памятку «как " +
    "сложить» по типам вещей и подборку органайзеров со ссылками на " +
    "маркетплейсы. Готово за пару минут.",
  measure:
    "Нужны три внутренних размера — длина, ширина и глубина, по внутренним " +
    "стенкам (без их толщины). Подробно, с картинками — вот здесь:\n" +
    SITE_URL + "/blog/kak-zamerit-yashchik/",
  fit:
    "Если по Вашим размерам надёжную схему собрать не получится — мы прямо " +
    "скажем и денег не возьмём. Часто помогает чуть уменьшить объём одной " +
    "категории — это подскажем прямо на месте.",
  chat:
    "Пока расчёт живёт на сайте — это те же 3 минуты. Версию прямо в чате " +
    "готовим. Хотите — запишу Вас в список первых и напишу, как только " +
    "заработает.",
};

const FAQ_QUESTIONS: Array<{ id: string; label: string }> = [
  { id: "price", label: "Сколько стоит?" },
  { id: "engine", label: "Это программа или человек?" },
  { id: "result", label: "Что я получу?" },
  { id: "measure", label: "Как замерить ящик?" },
  { id: "fit", label: "А вдруг не подойдёт?" },
  { id: "chat", label: "Можно посчитать в чате?" },
];

// Регэксп callback'а ответа FAQ — только известные id (чтобы не ловить чужое).
const FAQ_ANSWER_RE = /^faq:(price|engine|result|measure|fit|chat)$/;

// ── Клавиатуры (переиспользуются между экранами) ────────────

// Стартовое меню (3 кнопки) — /start.
function buildMainKeyboard(source: string | null): InlineKeyboard {
  return new InlineKeyboard()
    .url("Рассчитать схему под мои размеры →", buildSiteUrl(source))
    .row()
    .text("Посмотреть пример результата", "viewed_example")
    .row()
    .text("Посчитать прямо здесь, в чате", "wants_bot_calc");
}

// Фолбэк на свободный текст — те же действия + вход в FAQ.
function buildFallbackKeyboard(source: string | null): InlineKeyboard {
  return new InlineKeyboard()
    .text("Частые вопросы", "faq:open")
    .row()
    .url("Рассчитать схему под мои размеры →", buildSiteUrl(source))
    .row()
    .text("Посмотреть пример результата", "viewed_example")
    .row()
    .text("Посчитать прямо здесь, в чате", "wants_bot_calc");
}

// Под фото-примером — Рассчитать + в чате + FAQ (FAQ третьей, чтобы не
// двигать позиции конверсии и демо-сигнала).
function buildExampleKeyboard(source: string | null): InlineKeyboard {
  return new InlineKeyboard()
    .url("Рассчитать схему под мои размеры →", buildSiteUrl(source))
    .row()
    .text("Посчитать прямо здесь, в чате", "wants_bot_calc")
    .row()
    .text("Частые вопросы", "faq:open");
}

// Под подтверждением «хочу в чате» — выход на сайт (без тупика).
function buildWantsKeyboard(source: string | null): InlineKeyboard {
  return new InlineKeyboard().url("Рассчитать на сайте →", buildSiteUrl(source));
}

// Список вопросов FAQ: 6 вопросов + действия на самом списке (из списка
// всегда один тап до действия — петля не запирается на вопросах).
function buildFaqListKeyboard(source: string | null): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const q of FAQ_QUESTIONS) {
    kb.text(q.label, `faq:${q.id}`).row();
  }
  kb.url("Рассчитать схему →", buildSiteUrl(source)).row();
  kb.text("Посчитать прямо здесь, в чате", "wants_bot_calc");
  return kb;
}

// Под ответом FAQ — действие + «← К вопросам». Для вопроса про чат —
// дополнительно кнопка демо-сигнала (FAQ тоже питает wants_bot_calc).
function buildFaqAnswerKeyboard(id: string, source: string | null): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (id === "chat") {
    kb.text("Посчитать прямо здесь, в чате", "wants_bot_calc").row();
    kb.url("Рассчитать на сайте →", buildSiteUrl(source)).row();
  } else {
    kb.url("Рассчитать схему →", buildSiteUrl(source)).row();
  }
  kb.text("← К вопросам", "faq:open");
  return kb;
}

// Watchdog state — экспортируется для /api/healthz?bot=1.
// botLastEventAt — timestamp последнего обработанного update от Telegram
// (включая heartbeat watchdog'а, который раз в минуту делает getMe).
// Если разрыв между now() и botLastEventAt > 3 минуты — бот «висит».
let botLastEventAt: Date | null = null;
let botStartedAt: Date | null = null;

export function getBotHealth(): {
  started_at: string | null;
  last_event_at: string | null;
  seconds_since_event: number | null;
  healthy: boolean;
} {
  const now = Date.now();
  const lastMs = botLastEventAt?.getTime() ?? null;
  const secondsSinceEvent = lastMs !== null ? Math.floor((now - lastMs) / 1000) : null;
  // Бот считается здоровым если:
  //  - вообще не стартовал (TG_BOT_TOKEN не задан) → undefined, healthy=true
  //    (значит на этом окружении бот не нужен, не нужно тревожить)
  //  - стартовал и последнее событие было не позже 3 минут назад
  // Watchdog тикает раз в 60 сек → запас 3 минуты покрывает 2 пропущенных тика.
  const healthy = botStartedAt === null
    ? true
    : secondsSinceEvent !== null && secondsSinceEvent <= 180;
  return {
    started_at: botStartedAt?.toISOString() ?? null,
    last_event_at: botLastEventAt?.toISOString() ?? null,
    seconds_since_event: secondsSinceEvent,
    healthy,
  };
}

function markBotEvent(): void {
  botLastEventAt = new Date();
}

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

  // Лог-маркер на каждый входящий update + watchdog heartbeat.
  // Видно в journalctl что бот получает сообщения, и /api/healthz?bot=1
  // считает время с последнего события. Логи короткие, не засирают журнал.
  bot.use(async (ctx, next) => {
    markBotEvent();
    const kind =
      ctx.message?.text ? `msg:${ctx.message.text.slice(0, 32)}` :
      ctx.callbackQuery?.data ? `cb:${ctx.callbackQuery.data}` :
      ctx.update.message ? "msg:other" : "other";
    console.log(`[telegram] update ${ctx.update.update_id} from ${ctx.from?.id ?? "?"} (${kind})`);
    await next();
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

  /** Source подписчика (из исходного deeplink) для UTM-кнопок. Берём из
   *  записи, а не из текущего апдейта — повторный заход может прийти без
   *  deeplink'а, а исходный source должен сохраниться. */
  async function getSource(userId: bigint): Promise<string | null> {
    const r = await pool.query<{ source: string | null }>(
      `SELECT source FROM bot_subscribers WHERE tg_user_id = $1`,
      [userId.toString()],
    );
    return r.rows[0]?.source ?? null;
  }

  /** Показывает FAQ внутри текущего сообщения: если это фото-пример — правим
   *  подпись (editMessageCaption), иначе текст (editMessageText). Фото
   *  остаётся сверху, исходные кнопки не теряются — петля «пример → FAQ →
   *  действие» замыкается в одном сообщении. Если редактирование не удалось
   *  (старое сообщение и т.п.) — отправляем новым, чтобы не было тупика. */
  async function renderFaq(
    ctx: Context,
    text: string,
    keyboard: InlineKeyboard,
  ): Promise<void> {
    const msg = ctx.callbackQuery?.message;
    const isPhoto = !!(msg && "photo" in msg && msg.photo);
    try {
      if (isPhoto) {
        await ctx.editMessageCaption({
          caption: text,
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      } else {
        await ctx.editMessageText(text, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      }
    } catch (e) {
      console.warn("[telegram] faq edit failed, sending new message:", e);
      await ctx.reply(text, { reply_markup: keyboard, parse_mode: "HTML" });
    }
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
    unsubscribed: number;
    reminders_sent: number;
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
      unsubscribed: string;
      reminders_sent: string;
      contacts_24h: string;
      contacts_7d: string;
      viewed_example: string;
      wants_bot_calc: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_contacts,
         COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::text AS unsubscribed,
         COUNT(*) FILTER (WHERE reminder_sent_at IS NOT NULL)::text AS reminders_sent,
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
      unsubscribed: parseInt(row.unsubscribed, 10),
      reminders_sent: parseInt(row.reminders_sent, 10),
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
    const subscriberSource = await getSource(BigInt(user.id));

    await ctx.reply(WELCOME_TEXT, {
      reply_markup: buildMainKeyboard(subscriberSource),
      parse_mode: "HTML",
    });
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
    const subscriberSource = await getSource(BigInt(user.id));
    // Под картинкой-примером — три кнопки (чтобы не было тупика):
    // URL на /configure/, callback «в чате» (демо-сигнал) и вход в FAQ
    // (снять сомнение на пике интереса). См. docs/bot-ux.md §4.2.
    const exampleKeyboard = buildExampleKeyboard(subscriberSource);

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
    const source = await getSource(BigInt(user.id));
    // Выход на сайт (без тупика): горячие из листа ожидания конвертятся сразу.
    await ctx.reply(WANTS_BOT_CALC_TEXT, { reply_markup: buildWantsKeyboard(source) });
  });

  // ── FAQ ─────────────────────────────────────────────────────
  // Список вопросов. Входы: кнопка «Частые вопросы» (под примером/фолбэком)
  // и команда /help. На самом списке есть действия — из него всегда один
  // тап до «Рассчитать»/«в чате», петля не запирается. См. docs/bot-ux.md §5.
  bot.callbackQuery("faq:open", async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    const source = await getSource(BigInt(user.id));
    await ctx.answerCallbackQuery();
    await renderFaq(ctx, FAQ_LIST_TEXT, buildFaqListKeyboard(source));
  });

  // Ответ на конкретный вопрос. Каждый ответ: действие по теме + «← К вопросам».
  bot.callbackQuery(FAQ_ANSWER_RE, async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    const match = ctx.match as RegExpMatchArray;
    const id = match[1];
    const text = FAQ_ANSWERS[id];
    const source = await getSource(BigInt(user.id));
    await ctx.answerCallbackQuery();
    await renderFaq(ctx, text, buildFaqAnswerKeyboard(id, source));
  });

  // /help — открывает список FAQ новым сообщением.
  bot.command("help", async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    await rememberContact(
      BigInt(user.id),
      user.username,
      user.first_name,
      user.language_code,
      undefined,
    );
    const source = await getSource(BigInt(user.id));
    await ctx.reply(FAQ_LIST_TEXT, { reply_markup: buildFaqListKeyboard(source) });
  });

  // /stop — опт-аут от напоминаний (152-ФЗ + этикет). Строку не удаляем:
  // нужна как suppression-ключ («не писать»). Алиас /unsubscribe — для
  // совместимости. Та же логика дёргается кнопкой «Больше не напоминать».
  bot.command(["stop", "unsubscribe", "отписаться"], async (ctx) => {
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
        `Отписались (/stop): ${s.unsubscribed}\n` +
        `Напоминаний отправлено: ${s.reminders_sent}\n` +
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
    const source = await getSource(BigInt(user.id));
    await ctx.reply(FALLBACK_TEXT, { reply_markup: buildFallbackKeyboard(source) });
  });

  // ── Watchdog ────────────────────────────────────────────────
  // Раз в 60 сек делаем getMe через client'а grammy. На успех — обновляем
  // botLastEventAt (heartbeat для healthz). На фейл — счётчик; 3 подряд
  // → process.exit(1), systemd рестартует (у нас Restart=on-failure).
  // Так лечатся «тихие» зависания: процесс жив, но getUpdates висит
  // и события не приходят (видели вживую в проде, 19h аптайма → 0 событий).
  const WATCHDOG_INTERVAL_MS = 60_000;
  const WATCHDOG_TIMEOUT_MS = 8_000;
  const WATCHDOG_MAX_FAILURES = 3;
  let watchdogFailures = 0;
  const watchdog = setInterval(async () => {
    try {
      // bot.api.getMe() уже идёт через настроенный apiRoot и собственный
      // timeout grammy. Дополнительный гард — Promise.race с таймером.
      await Promise.race([
        bot.api.getMe(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("watchdog_timeout")), WATCHDOG_TIMEOUT_MS),
        ),
      ]);
      watchdogFailures = 0;
      markBotEvent(); // heartbeat — здоровый бот «бьётся» раз в минуту
    } catch (e) {
      watchdogFailures += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[telegram] watchdog fail ${watchdogFailures}/${WATCHDOG_MAX_FAILURES}: ${msg}`);
      if (watchdogFailures >= WATCHDOG_MAX_FAILURES) {
        console.error("[telegram] watchdog: too many failures, exiting for systemd restart");
        clearInterval(watchdog);
        process.exit(1);
      }
    }
  }, WATCHDOG_INTERVAL_MS);

  // ── Старт long-polling ──────────────────────────────────────
  // bot.start() возвращает promise, который резолвится при остановке.
  // Не await'им — пусть крутится фоном, ошибки логируются через bot.catch.
  console.log("[telegram] starting long-polling…");
  bot.start({
    onStart: (info) => {
      botStartedAt = new Date();
      markBotEvent(); // первая «бипка» в момент успешного старта polling'а
      console.log(`[telegram] bot @${info.username} started, id=${info.id}`);
    },
  });
}
