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
    // Unisender режет attachment размером >1 МБ (это размер тела
    // form-data, т.е. base64-кодированный). Чтобы письма с тяжёлыми
    // PDF не падали с "exceeded the maximum allowed value (1048576)",
    // если base64 превышает безопасный порог — снимаем вложение и
    // переключаемся на текст со ссылкой.
    let attachment: { filename: string; contentBase64: string; contentType: string } | undefined;
    try {
      const pdfPath = path.join(PDF_STORAGE_DIR, `${token}.pdf`);
      const buf = await fs.readFile(pdfPath);
      const base64 = buf.toString("base64");
      if (base64.length > 1_000_000) {
        console.log("[mailer] PDF too big for Unisender attachment, sending link only:", {
          token, pdf_bytes: buf.length, base64_bytes: base64.length,
        });
      } else {
        const shortId = row.payload?.order_id?.split("-")[0]?.toUpperCase() ?? "";
        attachment = {
          filename: shortId ? `Уместно. Схема хранения №${shortId}.pdf` : "Уместно. Схема хранения.pdf",
          contentBase64: base64,
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

    // Шапка для пересылки — видна только Дзере в info@. Удаляется перед
    // тем как переслать клиенту (Forward в mail.ru → редактируй → Send).
    const shortId = row.payload?.order_id?.split("-")[0]?.toUpperCase() ?? "—";
    const adminHeaderHtml =
      `<div style="background:#FBF3E4;border:1px solid #E5D9C0;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-family:sans-serif;font-size:13px;color:#6A5A2A">` +
        `<div style="font-weight:600;margin-bottom:4px">📨 ПЕРЕСЛАТЬ КЛИЕНТУ — удали этот блок перед отправкой</div>` +
        `<div>Адресат: <b>${row.to_email}</b></div>` +
        `<div>Заказ: <b>№ ${shortId}</b></div>` +
      `</div>`;
    const adminHeaderText =
      `── ПЕРЕСЛАТЬ КЛИЕНТУ (удали этот блок перед отправкой) ──\n` +
      `Адресат: ${row.to_email}\n` +
      `Заказ: № ${shortId}\n` +
      `─────────────────────────────────────────────────────\n\n`;

    return {
      subject: `→ ${row.to_email} · Уместно. Схема хранения готова`,
      bodyHtml:
        adminHeaderHtml +
        `<p>Здравствуйте!</p>` +
        `<p>${fileLine}</p>` +
        surveyBlockHtml +
        `<p>Спасибо, что выбрали нас.</p>` +
        `<p>Команда «Уместно»</p>`,
      bodyText:
        adminHeaderText +
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
    `SELECT id, to_email, template, payload
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
