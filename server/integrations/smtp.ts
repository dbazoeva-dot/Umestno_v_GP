// SMTP-клиент через nodemailer.
//
// Заменяет Unisender для отправки писем после оплаты. Причины переезда:
//   - Unisender free режет attachment 1 МБ и требует list_id (метод
//     sendEmail у них маркетинговый, не транзакционный)
//   - У нас уже есть VK Workspace на домене umestno-home.ru →
//     родной SMTP через info@ работает без list_id, без брендинга
//     "powered by", лимит вложений 20 МБ, 200 писем/сутки на free
//
// Интерфейс sendEmail() сохранён 1:1 с unisender.ts, чтобы воркер
// mailer.ts не переписывать — просто меняем импорт.
//
// .env требует:
//   SMTP_HOST=smtp.mail.ru
//   SMTP_PORT=465
//   SMTP_USER=info@umestno-home.ru
//   SMTP_PASS=<пароль приложения из настроек mail.ru "Только отправка">
//
// Если SMTP_PASS не задан — возвращаем { ok: false, error: "no_smtp_pass" },
// строка в emails_outbox остаётся 'queued' (как раньше с no_api_key).

import nodemailer, { type Transporter } from "nodemailer";

export interface SendEmailParams {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  attachment?: {
    filename: string;
    contentBase64: string;
    contentType: string;
  };
}

export interface SendEmailResult {
  ok: boolean;
  /** Message-ID, возвращаемый SMTP-сервером (для логов и трассировки). */
  provider_id?: string;
  error?: string;
}

const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.mail.ru";
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "465", 10);
const SMTP_USER = process.env.SMTP_USER ?? "info@umestno-home.ru";
const SMTP_PASS = process.env.SMTP_PASS;
/** Имя отправителя в поле From. У mail.ru можно слать ТОЛЬКО от
 *  имени ящика SMTP_USER — это строго проверяется (RFC 5322 + SPF).
 *  Поэтому SMTP_FROM_NAME влияет только на display-name. */
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME ?? "Уместно";

// Lazy-инициализация транспорта. Создаём один раз при первой отправке,
// дальше переиспользуем — nodemailer держит пул соединений сам.
let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (transporter) return transporter;
  if (!SMTP_PASS) {
    throw new Error("SMTP_PASS is not set");
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // 465 → TLS-from-start; 587 → STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendEmail(p: SendEmailParams): Promise<SendEmailResult> {
  if (!SMTP_PASS) {
    console.log("[smtp] no SMTP_PASS — would send:", {
      to: p.to,
      subject: p.subject,
      has_attachment: !!p.attachment,
    });
    return { ok: false, error: "no_smtp_pass" };
  }

  try {
    const info = await getTransporter().sendMail({
      from: { name: SMTP_FROM_NAME, address: SMTP_USER },
      to: p.to,
      subject: p.subject,
      html: p.bodyHtml,
      text: p.bodyText,
      attachments: p.attachment
        ? [
            {
              filename: p.attachment.filename,
              content: Buffer.from(p.attachment.contentBase64, "base64"),
              contentType: p.attachment.contentType,
            },
          ]
        : undefined,
    });
    return { ok: true, provider_id: info.messageId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
