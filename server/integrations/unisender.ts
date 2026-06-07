// Unisender API client.
//
// Документация: https://www.unisender.com/ru/support/api/common/
// Метод для транзакционных писем: sendEmail
// (https://www.unisender.com/ru/support/api/messages/sendemail/).
//
// MVP-режим: пока в .env нет UNISENDER_API_KEY — функция возвращает
// `{ ok: false, error: "no_api_key" }` и не пытается ничего отправить.
// Это позволяет email-воркеру штатно работать в холостом режиме до
// подключения ключа (письма копятся в emails_outbox со статусом 'queued').
//
// После подключения ключа подменим заглушку на реальный вызов.

export interface SendEmailParams {
  /** Кому отправить (email покупателя). */
  to: string;
  /** Тема письма. */
  subject: string;
  /** HTML-тело письма. */
  bodyHtml: string;
  /** Текстовая версия (для клиентов без HTML — лучше показать что-то осмысленное). */
  bodyText?: string;
  /** Опциональное вложение — обычно наш PDF со схемой. */
  attachment?: {
    filename: string;
    contentBase64: string;
    contentType: string;
  };
}

export interface SendEmailResult {
  ok: boolean;
  /** ID сообщения у Unisender (если успех). */
  provider_id?: string;
  /** Код ошибки если не получилось. */
  error?: string;
}

const UNISENDER_API_BASE = "https://api.unisender.com/ru/api";

/** Отправитель «От кого». Когда подключим DKIM и пройдёт верификация —
 *  это будет наш info@umestno-home.ru. До этого момента — можно
 *  использовать любой подтверждённый email из кабинета Unisender. */
const SENDER_EMAIL = process.env.UNISENDER_SENDER_EMAIL ?? "info@umestno-home.ru";
const SENDER_NAME = process.env.UNISENDER_SENDER_NAME ?? "Уместно";
/** ID списка контактов в Unisender. Метод sendEmail (классический
 *  Unisender, не UniGo) обязательно требует list_id — получатель
 *  автоматически добавляется в этот список. На free-тарифе письма
 *  уходят только на email'ы, которые УЖЕ подтверждены в этом списке. */
const LIST_ID = process.env.UNISENDER_LIST_ID;

export async function sendEmail(p: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.UNISENDER_API_KEY;
  if (!apiKey) {
    // Холостой режим — лог + outbox-строка остаётся 'queued'.
    console.log("[unisender] no UNISENDER_API_KEY — would send:", {
      to: p.to,
      subject: p.subject,
      has_attachment: !!p.attachment,
    });
    return { ok: false, error: "no_api_key" };
  }

  // Реальная отправка через Unisender REST API. Метод sendEmail принимает
  // form-data POST. Поля: api_key, email, sender_name, sender_email,
  // subject, body (только HTML — отдельной текстовой версии метод не
  // поддерживает, в отличие от Расширенного API UniGo). attachment передаётся
  // как base64 в поле attachments[имя_файла].
  if (!LIST_ID) {
    console.warn("[unisender] UNISENDER_LIST_ID не задан — sendEmail обязательно требует list_id");
    return { ok: false, error: "no_list_id" };
  }

  const form = new URLSearchParams();
  form.set("format", "json");
  form.set("api_key", apiKey);
  form.set("email", p.to);
  form.set("sender_name", SENDER_NAME);
  form.set("sender_email", SENDER_EMAIL);
  form.set("subject", p.subject);
  form.set("body", p.bodyHtml);
  form.set("list_id", LIST_ID);
  if (p.attachment) {
    form.set(`attachments[${p.attachment.filename}]`, p.attachment.contentBase64);
  }

  try {
    const res = await fetch(`${UNISENDER_API_BASE}/sendEmail`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = (await res.json()) as { result?: { index?: number; id?: string; email_id?: string }; error?: string; warnings?: unknown };
    if (data.error) {
      return { ok: false, error: String(data.error) };
    }
    const providerId =
      data.result?.email_id ??
      data.result?.id ??
      (data.result?.index !== undefined ? String(data.result.index) : undefined);
    return { ok: true, provider_id: providerId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
