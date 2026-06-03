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
import { yookassaWebhookHandler } from "./api/yookassa.js";
import {
  originCheck,
  calculateLimiterPerMinute,
  calculateLimiterPerHour,
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
  app.listen(env.PORT, "127.0.0.1", () => {
    console.log(`[api] umestno listening on http://127.0.0.1:${env.PORT}  (env=${env.NODE_ENV})`);
  });
}

main().catch((e) => {
  console.error("[fatal] startup failed:", e);
  process.exit(1);
});
