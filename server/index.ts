// Umestno API — точка входа.
//
// На старте: коннект к Postgres, прогрев каталога, поднятие Express.
// Эндпойнты добавляются по очереди (см. ARCHITECTURE.md, API surface).

import express, { type Request, type Response, type NextFunction } from "express";
import { loadEnv } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { loadCatalogFromDb } from "./catalog/loadCatalogFromDb.js";
import { calculateHandler } from "./api/calculate.js";
import { resultHandler } from "./api/result.js";
import { pdfHandler } from "./api/pdf.js";
import { orderSendEmailHandler } from "./api/orderSendEmail.js";
import { yookassaWebhookHandler } from "./api/yookassa.js";
import { promoCheckHandler } from "./api/promoCheck.js";
import { startMailerWorker } from "./workers/mailer.js";
import {
  originCheck,
  calculateLimiterPerMinute,
  calculateLimiterPerHour,
  promoCheckLimiter,
} from "./middleware/security.js";
import type { SkuCatalogRow } from "../engine/types.js";

const env = loadEnv();
const pool = createPool();

// Прогретый в памяти каталог. Парсер каталога (после прода) сможет
// дёрнуть refresh — пока обновляется только перезапуском сервера.
let catalogCache: SkuCatalogRow[] = [];

async function warmupCatalog() {
  catalogCache = await loadCatalogFromDb(pool);
  console.log(`[catalog] загружено ${catalogCache.length} активных SKU`);
}

const app = express();
// nginx стоит на 127.0.0.1, поэтому доверяем заголовку X-Forwarded-For
// только когда запрос пришёл через loopback. 'true' тут небезопасно —
// позволит любому клиенту подделать X-Forwarded-For.
app.set("trust proxy", "loopback");
app.use(express.json({ limit: "256kb" }));

// ── базовые эндпойнты ───────────────────────────────────────

app.get("/api/healthz", async (_req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      ok: true,
      env: env.NODE_ENV,
      catalog_size: catalogCache.length,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── 1.3 — расчёт схемы + матчинг SKU + сохранение в БД ─────
// Защита: пускаем только с нашего домена (originCheck) и не больше
// 5 req/min + 30 req/hour с одного IP (см. middleware/security.ts).

app.post(
  "/api/calculate",
  originCheck(env),
  calculateLimiterPerMinute,
  calculateLimiterPerHour,
  calculateHandler(pool, env, () => catalogCache),
);

// ── 1.4 — чтение сохранённого расчёта для рендера result-страницы ─

app.get("/api/result/:token", resultHandler(pool, env));

// ── 2.x — PDF-рендер «Схема хранения» через Puppeteer ──────
// Payment gate такой же, как у /api/result. Готовые PDF кэшируем
// в /var/www/umestno/storage/pdfs/{token}.pdf — повторные запросы
// идут с диска без Puppeteer.

app.get("/api/pdf/:token", pdfHandler(pool, env));

// ── 4.x — Превью промокода для /configure/ ─────────────────
// Юзер раскрывает «Есть промокод?», вводит код → фронт стучится сюда,
// мы говорим валидный/нет + итоговая сумма (для отрисовки зачёркнутой
// старой цены и новой). uses_count тут НЕ инкрементится — это только
// превью; реально код применяется в /api/calculate при сабмите.

app.post("/api/promo/check", originCheck(env), promoCheckLimiter, promoCheckHandler(pool, env));

// ── 2.x — Отправить схему на email по запросу клиента ──────
// Юзер на /result/ вводит email + согласие на ПДн, клик «Отправить» →
// сюда. Проверяем оплачен ли заказ, фиксируем согласие, кладём строку
// в emails_outbox. Воркер (workers/mailer.ts) подхватывает и шлёт.

app.post("/api/order/:token/send-email", originCheck(env), orderSendEmailHandler(pool));

// ── 3.x — YooKassa webhook: подтверждение оплаты ────────────
// Без originCheck/rate-limit — этот endpoint вызывает ЮКасса со своих
// IP, мы не можем им навязать Origin-заголовок. Идемпотентность по
// yookassa_id + активная сверка через getPayment() защищают от подделок.

app.post("/api/yookassa/webhook", yookassaWebhookHandler(pool));

// ── обработчик ошибок последним ─────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err);
  res.status(500).json({ ok: false, error: env.NODE_ENV === "production" ? "internal_error" : err.message });
});

// ── start ───────────────────────────────────────────────────

async function main() {
  await warmupCatalog();
  // Email-воркер. Если UNISENDER_API_KEY не задан — крутится вхолостую,
  // письма просто копятся в emails_outbox как 'queued'.
  startMailerWorker(pool);
  app.listen(env.PORT, "127.0.0.1", () => {
    console.log(`[api] umestno listening on http://127.0.0.1:${env.PORT}  (env=${env.NODE_ENV})`);
  });
}

main().catch((e) => {
  console.error("[fatal] startup failed:", e);
  process.exit(1);
});
