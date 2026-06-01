// Защитные middleware: rate-limit и проверка Origin/Referer.
// Применяются к write-эндпойнтам (/api/calculate). Read-эндпойнты
// типа /api/result/:token не покрываем — там токены 22-символьные
// случайные, угадать практически нереально.

import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import type { Env } from "../config/env.js";

// Разрешённые источники запросов (Origin и префикс Referer).
const ALLOWED_ORIGINS = [
  "https://umestno-home.ru",
  "https://www.umestno-home.ru",
];

// Принимаем запрос если есть валидный Origin ИЛИ валидный Referer.
// Браузеры на POST всегда шлют Origin, поэтому в проде запрос без
// Origin/Referer почти гарантированно из curl/скрипта — режем.
// В dev (NODE_ENV !== production) пропускаем такие запросы, чтобы
// можно было локально тестировать без хождения через настоящий nginx.
export function originCheck(env: Env) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get("origin");
    const referer = req.get("referer") ?? "";

    if (origin && ALLOWED_ORIGINS.includes(origin)) return next();
    if (referer && ALLOWED_ORIGINS.some((o) => referer.startsWith(o + "/"))) return next();

    if (!origin && !referer && env.NODE_ENV !== "production") return next();

    return res.status(403).json({ ok: false, error: "forbidden_origin" });
  };
}

// Rate-limit на /api/calculate: до 5 запросов в минуту И до 30 в час
// с одного IP (применяются оба, срабатывает строжайший). Обычный юзер
// за час делает один-два расчёта; 30 — это уже автоматика.
// Хранилище — в памяти процесса; при рестарте Node счётчики сбрасываются.
// Если когда-нибудь поднимем несколько Node-инстансов — придётся
// переехать на Redis (RateLimitRedis).
export const calculateLimiterPerMinute = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", scope: "per_minute" },
});

export const calculateLimiterPerHour = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", scope: "per_hour" },
});
