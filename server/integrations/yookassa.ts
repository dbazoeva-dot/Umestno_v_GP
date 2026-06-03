// YooKassa REST API client.
//
// Доки: https://yookassa.ru/developers/api
// Авторизация: HTTP Basic — login=shop_id, password=secret_key.
// Каждый POST требует Idempotence-Key (UUID), чтобы при ретрае не
// создать дубль платежа.
//
// SDK ЮКассы не используем (лишняя зависимость) — встроенный fetch
// в Node 18+ покрывает всё что нужно.

import { randomUUID } from "crypto";

const YOOKASSA_API_BASE = "https://api.yookassa.ru/v3";

interface YooKassaCredentials {
  shopId: string;
  secretKey: string;
}

export interface YooKassaPayment {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: {
    type: string;
    confirmation_url?: string;
    return_url?: string;
  };
  metadata?: Record<string, string>;
  created_at: string;
  description?: string;
  test?: boolean;
}

export interface CreatePaymentParams {
  /** Сумма в копейках (например 14900 = 149.00 ₽). */
  amount_kop: number;
  /** Куда вернуть юзера после оплаты на стороне ЮКассы. */
  return_url: string;
  /** Описание для юзера (показывается в чеке ЮКассы). */
  description: string;
  /** Произвольные пары — вернутся в webhook, по ним матчим заказ. */
  metadata: Record<string, string>;
  /** Уникальный ID идемпотентности — наш token от заказа. */
  idempotence_key: string;
}

function loadCredentials(): YooKassaCredentials {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    throw new Error(
      "YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY must be set in .env",
    );
  }
  return { shopId, secretKey };
}

function authHeader(creds: YooKassaCredentials): string {
  return (
    "Basic " + Buffer.from(creds.shopId + ":" + creds.secretKey).toString("base64")
  );
}

/** Создаёт UUID v4 (для Idempotence-Key, если наш token не подходит). */
export function newIdempotenceKey(): string {
  return randomUUID();
}

/** Конвертация копеек в строку «149.00» для YooKassa amount.value. */
function kopToRub(amountKop: number): string {
  const rub = Math.floor(amountKop / 100);
  const kop = amountKop % 100;
  return `${rub}.${String(kop).padStart(2, "0")}`;
}

/** POST /payments — создать новый платёж. */
export async function createPayment(p: CreatePaymentParams): Promise<YooKassaPayment> {
  const creds = loadCredentials();
  const body = {
    amount: {
      value: kopToRub(p.amount_kop),
      currency: "RUB",
    },
    capture: true, // авто-капчуем сразу после авторизации (один шаг)
    confirmation: {
      type: "redirect",
      return_url: p.return_url,
    },
    description: p.description,
    metadata: p.metadata,
  };

  const res = await fetch(`${YOOKASSA_API_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: authHeader(creds),
      "Idempotence-Key": p.idempotence_key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YooKassa createPayment failed: ${res.status} ${text}`);
  }
  return (await res.json()) as YooKassaPayment;
}

/** GET /payments/{id} — посмотреть текущий статус платежа. */
export async function getPayment(yookassaId: string): Promise<YooKassaPayment> {
  const creds = loadCredentials();
  const res = await fetch(`${YOOKASSA_API_BASE}/payments/${encodeURIComponent(yookassaId)}`, {
    method: "GET",
    headers: {
      Authorization: authHeader(creds),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YooKassa getPayment failed: ${res.status} ${text}`);
  }
  return (await res.json()) as YooKassaPayment;
}
