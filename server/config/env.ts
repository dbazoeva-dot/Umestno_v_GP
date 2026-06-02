// Чтение и валидация переменных окружения.
// Это единственное место, где код смотрит в process.env. Дальше по
// коду все берут конфиг через loadEnv() — типизированно, с дефолтами.

import { config as dotenvConfig } from "dotenv";

dotenvConfig();

export interface Env {
  /** Порт, на котором Node API слушает локально (за nginx). */
  PORT: number;
  /** Базовый URL для картинок SKU. В MVP — относительный путь под nginx,
   *  после переезда на S3 — полный CDN-URL. */
  IMAGE_BASE_URL: string;
  /** Окружение: development / production. Влияет на формат логов и ошибок. */
  NODE_ENV: "development" | "production";
  /** Если true — paywall режим: orders.status='created' при fit_all, ждём
   *  оплату через YooKassa. Если false — dev-обход: status='sent_free' сразу,
   *  без YooKassa (для локальной разработки без поднятой платёжной интеграции).
   *  В проде ВСЕГДА true. См. docs/data-model.md. */
  PAYMENT_REQUIRED: boolean;
  /** Цена услуги в копейках (snapshot оферты). Должна совпадать с текстом
   *  оферты на сайте. При изменении — синхронно править .env и /oferta/. */
  PRICE_KOP: number;
}

export function loadEnv(): Env {
  const nodeEnv = process.env.NODE_ENV === "production" ? "production" : "development";
  return {
    PORT: parseInt(process.env.PORT ?? "3000", 10),
    IMAGE_BASE_URL: process.env.IMAGE_BASE_URL ?? "/assets/images/sku",
    NODE_ENV: nodeEnv,
    PAYMENT_REQUIRED: process.env.PAYMENT_REQUIRED === "true",
    PRICE_KOP: parseInt(process.env.PRICE_KOP ?? "14900", 10),
  };
}
