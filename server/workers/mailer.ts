// Email-воркер.
//
// Раз в EMAIL_WORKER_INTERVAL_MS опрашивает emails_outbox, берёт первые
// EMAIL_BATCH_SIZE писем со статусом 'queued', пытается отправить через
// Unisender. Успех → status='sent', sent_at=now(), provider_id=...
// Ошибка → status='failed', error=сообщение. Без ретраев на MVP (failed
// можно переотправить вручную, поставив status обратно в 'queued').
//
// Воркер запускается из server/index.ts после прогрева каталога.
// Если UNISENDER_API_KEY не задан в .env, sendEmail вернёт «no_api_key»
// и строка остаётся 'queued' — воркер крутится вхолостую, копит письма,
// после подключения ключа всё разъедется само.

import type { Pool } from "pg";
import { promises as fs } from "fs";
import path from "path";
import { sendEmail } from "../integrations/unisender.js";

const EMAIL_WORKER_INTERVAL_MS = 30_000;
const EMAIL_BATCH_SIZE = 10;
const PDF_STORAGE_DIR = "/var/www/umestno/storage/pdfs";

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
    let attachment: { filename: string; contentBase64: string; contentType: string } | undefined;
    try {
      const pdfPath = path.join(PDF_STORAGE_DIR, `${token}.pdf`);
      const buf = await fs.readFile(pdfPath);
      const shortId = row.payload?.order_id?.split("-")[0]?.toUpperCase() ?? "";
      attachment = {
        filename: shortId ? `Уместно. Схема хранения №${shortId}.pdf` : "Уместно. Схема хранения.pdf",
        contentBase64: buf.toString("base64"),
        contentType: "application/pdf",
      };
    } catch (e) {
      // PDF ещё не закэширован — отправим без вложения, со ссылкой.
      console.log("[mailer] no cached PDF for token, sending link only:", token);
    }

    const link = `https://umestno-home.ru/result/?t=${encodeURIComponent(token)}`;
    return {
      subject: "Ваша схема хранения готова",
      bodyHtml:
        `<p>Здравствуйте!</p>` +
        `<p>Ваш персональный расчёт схемы хранения готов. ` +
        (attachment ? `Файл во вложении к этому письму.` : `Открыть схему: <a href="${link}">${link}</a>`) +
        `</p>` +
        `<p>Если что-то не так — напишите нам на <a href="mailto:info@umestno-home.ru">info@umestno-home.ru</a>.</p>` +
        `<p>С уважением,<br/>Уместно</p>`,
      bodyText:
        `Здравствуйте!\n\n` +
        `Ваш персональный расчёт схемы хранения готов. ` +
        (attachment ? `Файл во вложении.` : `Открыть: ${link}`) + `\n\n` +
        `Если что-то не так — напишите info@umestno-home.ru.\n\n` +
        `С уважением, Уместно`,
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

      const result = await sendEmail({
        to: row.to_email,
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
      } else if (result.error === "no_api_key") {
        // Холостой режим — не меняем статус, строка остаётся queued
        // до момента когда появится UNISENDER_API_KEY.
        // Логируется отправляется внутри sendEmail() — здесь без шума.
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
