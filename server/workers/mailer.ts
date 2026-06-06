// Email-воркер.
//
// Раз в EMAIL_WORKER_INTERVAL_MS опрашивает emails_outbox, берёт первые
// EMAIL_BATCH_SIZE писем со статусом 'queued', пытается отправить через
// Unisender. Успех → status='sent', sent_at=now(), provider_id=...
// Ошибка → status='failed', error=сообщение. Без ретраев на MVP (failed
// можно переотправить вручную, поставив status обратно в 'queued').
//
// Воркер запускается из server/index.ts после прогрева каталога.
// Если SMTP_PASS не задан в .env, sendEmail вернёт «no_smtp_pass»
// и строка остаётся 'queued' — воркер крутится вхолостую, копит письма,
// после подключения пароля приложения всё разъедется само.

import type { Pool } from "pg";
import { promises as fs } from "fs";
import path from "path";
// SMTP через info@umestno-home.ru (VK Workspace). Раньше был Unisender,
// съехали из-за list_id, 1 МБ лимита и брендинга в письме —
// см. server/integrations/smtp.ts.
import { sendEmail } from "../integrations/smtp.js";

const EMAIL_WORKER_INTERVAL_MS = 30_000;
const EMAIL_BATCH_SIZE = 10;
const PDF_STORAGE_DIR = "/var/www/umestno/storage/pdfs";

// MVP-режим: вместо отправки клиенту шлём готовое письмо себе
// на info@, потом пересылаем клиенту вручную. Причина — Unisender
// на free-тарифе принимает отправку только на подтверждённые email,
// а добавлять каждого клиента в подтверждённые невозможно. Когда
// подключим платный тариф — выпиливаем эту ветку, шлём напрямую
// на row.to_email.
const FORWARD_TO_EMAIL = process.env.FORWARD_TO_EMAIL ?? "info@umestno-home.ru";

interface OutboxRow {
  id: string;
  to_email: string;
  template: string;
  payload: { order_token?: string; order_id?: string };
  /** FK на orders.id, хранится отдельной колонкой (не только в payload).
   *  Используется для номера заказа в письме — надёжнее чем payload. */
  order_id: string | null;
}

/** Шаблоны писем. На MVP — один шаблон 'result' для оплаченного заказа.
 *  Когда добавим 'no-fit-followup' и т.д. — расширим. */
async function buildEmail(row: OutboxRow): Promise<{
  subject: string;
  bodyHtml: string;
  bodyText: string;
  attachment?: { filename: string; contentBase64: string; contentType: string };
} | null> {
  if (row.template === "result") {
    const token = row.payload?.order_token;
    if (!token) {
      throw new Error("template=result requires order_token in payload");
    }
    // Подтягиваем PDF из кэша, если уже отрендерен; если нет — пока
    // отправляем без вложения (юзер скачает по ссылке). Когда подключим
    // принудительный рендер из воркера — добавим тут вызов rendePdf.
    //
    // SMTP через mail.ru держит вложения до 20 МБ, поэтому даже
    // тяжёлые PDF (со множеством зон / иллюстраций SKU) уходят
    // вложением. Лимит ставим с запасом — 18 МБ raw → ~24 МБ
    // base64-чёрного-ящика nodemailer'а; mail.ru мерит исходный
    // размер, так что raw-проверка точнее.
    const shortId = (row.order_id ?? row.payload?.order_id)?.split("-")[0]?.toUpperCase() ?? "";
    let attachment: { filename: string; contentBase64: string; contentType: string } | undefined;
    try {
      const pdfPath = path.join(PDF_STORAGE_DIR, `${token}.pdf`);
      const buf = await fs.readFile(pdfPath);
      if (buf.length > 18 * 1024 * 1024) {
        console.log("[mailer] PDF too big for SMTP attachment, sending link only:", {
          token, pdf_bytes: buf.length,
        });
      } else {
        attachment = {
          filename: shortId ? `Уместно. Схема хранения №${shortId}.pdf` : "Уместно. Схема хранения.pdf",
          contentBase64: buf.toString("base64"),
          contentType: "application/pdf",
        };
      }
    } catch (e) {
      // PDF ещё не закэширован — отправим без вложения, со ссылкой.
      console.log("[mailer] no cached PDF for token, sending link only:", token);
    }

    const link = `https://umestno-home.ru/result/?t=${encodeURIComponent(token)}`;
    const surveyUrl = process.env.SURVEY_URL ?? "";

    // Текст письма — копирайт Дзеры. Не переписываем сами; меняем только
    // через её редакцию.
    const fileLine = attachment
      ? "Во вложении ваш PDF со схемой хранения для ящика: что где хранить, какие зоны получились и как сложить вещи, чтобы хранением было удобно пользоваться."
      : `Ваша схема хранения готова и доступна по ссылке: <a href="${link}">${link}</a>. Что где хранить, какие зоны получились и как сложить вещи, чтобы хранением было удобно пользоваться.`;
    const fileLineText = attachment
      ? "Во вложении ваш PDF со схемой хранения для ящика: что где хранить, какие зоны получились и как сложить вещи, чтобы хранением было удобно пользоваться."
      : `Ваша схема хранения готова и доступна по ссылке: ${link}\nЧто где хранить, какие зоны получились и как сложить вещи, чтобы хранением было удобно пользоваться.`;

    const surveyBlockHtml = surveyUrl
      ? `<p>Мы развиваем «Уместно» как сервис для удобного и эстетичного хранения, поэтому будем благодарны, если после просмотра вы пройдёте короткий опрос.</p>` +
        `<p>Он займёт 2–3 минуты и поможет нам понять, что можно сделать ещё понятнее и полезнее. Для нас это очень ценно.</p>` +
        `<p><a href="${surveyUrl}">${surveyUrl}</a></p>`
      : "";
    const surveyBlockText = surveyUrl
      ? `\nМы развиваем «Уместно» как сервис для удобного и эстетичного хранения, поэтому будем благодарны, если после просмотра вы пройдёте короткий опрос.\n\nОн займёт 2–3 минуты и поможет нам понять, что можно сделать ещё понятнее и полезнее. Для нас это очень ценно.\n\n${surveyUrl}\n`
      : "";

    // Subject и body — сразу клиентского вида (тема и тело такие же,
    // как увидит покупатель). Чтобы Дзера видела куда форвардить —
    // одна короткая серая строка в самом верху письма; в mail.ru
    // удаляется одним нажатием Backspace перед Forward.
    const subjectCustomer = shortId
      ? `Уместно. Схема хранения готова №${shortId}`
      : `Уместно. Схема хранения готова`;
    const forwardHintHtml =
      `<p style="margin:0 0 16px;font-family:sans-serif;font-size:12px;color:#999">` +
        `→ Переслать на: <b>${row.to_email}</b>` +
        (shortId ? ` · № ${shortId}` : "") +
        ` <span style="color:#bbb">(удали эту строку перед отправкой)</span>` +
      `</p>`;
    const forwardHintText =
      `→ Переслать на: ${row.to_email}${shortId ? ` · № ${shortId}` : ""} (удали эту строку перед отправкой)\n\n`;

    return {
      subject: subjectCustomer,
      bodyHtml:
        forwardHintHtml +
        `<p>Здравствуйте!</p>` +
        `<p>${fileLine}</p>` +
        surveyBlockHtml +
        `<p>Спасибо, что выбрали нас.</p>` +
        `<p>Команда «Уместно»</p>`,
      bodyText:
        forwardHintText +
        `Здравствуйте!\n\n` +
        `${fileLineText}\n` +
        surveyBlockText +
        `\nСпасибо, что выбрали нас.\n\nКоманда «Уместно»`,
      attachment,
    };
  }
  // unknown template — пропускаем (отмечаем failed)
  return null;
}

async function processOnce(pool: Pool) {
  const q = await pool.query<OutboxRow>(
    `SELECT id, to_email, template, payload, order_id
       FROM emails_outbox
      WHERE status = 'queued'
      ORDER BY queued_at
      LIMIT $1`,
    [EMAIL_BATCH_SIZE],
  );

  for (const row of q.rows) {
    try {
      const built = await buildEmail(row);
      if (!built) {
        await pool.query(
          `UPDATE emails_outbox SET status = 'failed', error = $2 WHERE id = $1`,
          [row.id, `unknown template: ${row.template}`],
        );
        continue;
      }

      // MVP-режим: шлём НЕ на email клиента, а на info@ (FORWARD_TO_EMAIL).
      // Дзера видит готовое письмо, чистит шапку-инструкцию и пересылает
      // клиенту вручную через Forward в mail.ru. Email клиента уже зашит
      // в built.subject и built.bodyHtml/bodyText (admin header), чтоб
      // не потерялся при пересылке.
      const result = await sendEmail({
        to: FORWARD_TO_EMAIL,
        subject: built.subject,
        bodyHtml: built.bodyHtml,
        bodyText: built.bodyText,
        attachment: built.attachment,
      });

      if (result.ok) {
        await pool.query(
          `UPDATE emails_outbox
             SET status = 'sent', sent_at = now(), provider_id = $2, error = NULL
           WHERE id = $1`,
          [row.id, result.provider_id ?? null],
        );
        console.log("[mailer] sent:", { id: row.id, to: row.to_email, provider_id: result.provider_id });
      } else if (result.error === "no_smtp_pass") {
        // Холостой режим — не меняем статус, строка остаётся queued
        // до момента когда появится SMTP_PASS.
        // Лог отправляется внутри sendEmail() — здесь без шума.
      } else {
        await pool.query(
          `UPDATE emails_outbox SET status = 'failed', error = $2 WHERE id = $1`,
          [row.id, String(result.error)],
        );
        console.warn("[mailer] failed:", { id: row.id, to: row.to_email, error: result.error });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await pool.query(
        `UPDATE emails_outbox SET status = 'failed', error = $2 WHERE id = $1`,
        [row.id, msg],
      );
      console.error("[mailer] processing failed:", { id: row.id, error: msg });
    }
  }
}

export function startMailerWorker(pool: Pool): void {
  console.log(`[mailer] worker started (interval ${EMAIL_WORKER_INTERVAL_MS / 1000}s)`);
  // Первый тик — сразу, потом по интервалу. Используем setInterval, не
  // setTimeout рекурсивно: если processOnce затянулся дольше интервала,
  // мы пропустим тик (не запустим второй параллельно).
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processOnce(pool);
    } catch (e) {
      console.error("[mailer] unexpected error:", e);
    } finally {
      running = false;
    }
  };
  setInterval(tick, EMAIL_WORKER_INTERVAL_MS);
  // Запускаем сразу — без ожидания первого интервала.
  void tick();
}
