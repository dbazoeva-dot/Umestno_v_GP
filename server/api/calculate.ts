// POST /api/calculate
//
// Принимает форму конфигуратора → гонит engine + matchSkus →
// сохраняет результат в configurations + configuration_skus →
// в одной транзакции пишет согласие с офертой в consents →
// возвращает token для перехода на /result/[token].
//
// Контракт запроса задаётся фронтом из configure/index.html.
// consent_oferta: true обязателен (api-contract.md решение №6).

import { randomBytes } from "crypto";
import type { Request, Response } from "express";
import type { Pool } from "pg";
import { runUmestnoEngine } from "../../engine/index.js";
import { defaultLibraries } from "../../engine/libraries/defaultLibraries.js";
import type { SkuCatalogRow, FitStatus } from "../../engine/types.js";

// Текущая версия оферты. Меняется при редактировании самой оферты —
// при изменении завести новый код ('oferta_v2', …), старые согласия
// остаются с прежней версией для аудита.
const OFERTA_VERSION = "oferta_v1";

interface CalculateRequest {
  drawer_width_cm: number;
  drawer_depth_cm: number;
  drawer_height_cm: number;
  storage_category: "underwear" | "soft_clothes" | "accessories" | "mixed";
  items: Array<{ content_type: string; volume_level: "small" | "medium" | "large" }>;
  priority: "convenient" | "capacity" | "budget";
  color_preference?: string;
  session_id?: string;
  consent_oferta: true;
}

interface CalculateResponse {
  token: string;
  fit_status: FitStatus | "no_scheme";
}

function makeToken(): string {
  // 16 байт → 22 url-safe символа, достаточно для непредсказуемости
  return randomBytes(16).toString("base64url");
}

function validateRequest(body: unknown): body is CalculateRequest {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.drawer_width_cm !== "number" || b.drawer_width_cm <= 0) return false;
  if (typeof b.drawer_depth_cm !== "number" || b.drawer_depth_cm <= 0) return false;
  if (typeof b.drawer_height_cm !== "number" || b.drawer_height_cm <= 0) return false;
  if (typeof b.storage_category !== "string") return false;
  if (!Array.isArray(b.items) || b.items.length === 0) return false;
  if (typeof b.priority !== "string") return false;
  return true;
}

export function calculateHandler(pool: Pool, getCatalog: () => SkuCatalogRow[]) {
  return async (req: Request, res: Response) => {
    if (!validateRequest(req.body)) {
      return res.status(400).json({ ok: false, error: "invalid_request" });
    }
    const body = req.body as CalculateRequest;
    if (body.consent_oferta !== true) {
      // отдельный код, чтобы фронт мог показать релевантную ошибку
      return res.status(400).json({ ok: false, error: "consent_required" });
    }

    // Передаём актуальный каталог в engine через libraries (не мутируя
    // глобальный defaultLibraries — это важно для конкурентных запросов).
    const libraries = { ...defaultLibraries, skuCatalog: getCatalog() };

    const result = runUmestnoEngine(
      {
        drawer_width_cm: body.drawer_width_cm,
        drawer_depth_cm: body.drawer_depth_cm,
        drawer_height_cm: body.drawer_height_cm,
        storage_category: body.storage_category,
        items: body.items,
        priority: body.priority,
        color_preference: body.color_preference,
      } as Parameters<typeof runUmestnoEngine>[0],
      libraries,
    ) as {
      result: unknown;
      scheme_payload: { fit_status: FitStatus; assigned_zones: Array<Record<string, unknown>> } | null;
      debug: { sku_matching_result?: Array<Record<string, unknown>> };
    };

    const token = makeToken();
    const fitStatus: FitStatus | "no_scheme" = result.scheme_payload?.fit_status ?? "no_scheme";

    // ip — реальный клиентский (с учётом trust proxy='loopback' в index.ts),
    // user_agent — из заголовка; оба для аудита согласий.
    const ip = req.ip ?? null;
    const userAgent = req.get("user-agent") ?? null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO configurations (session_id, input_payload, engine_output, fit_status, token)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [body.session_id ?? null, body, result, fitStatus, token],
      );
      const configId = inserted.rows[0].id;

      // 152-ФЗ: журналируем согласие с офертой. email тут ещё неизвестен
      // (юзер впишет его позже на result-странице) — оставляем NULL,
      // потом связываем по configuration_id если согласимся на ПД.
      await client.query(
        `INSERT INTO consents (email, configuration_id, consent_type, consent_version, ip, user_agent)
         VALUES (NULL, $1, 'oferta', $2, $3, $4)`,
        [configId, OFERTA_VERSION, ip, userAgent],
      );

      // Если схема построена — пишем выбранные SKU по каждой зоне
      if (result.scheme_payload && result.debug.sku_matching_result) {
        const matches = result.debug.sku_matching_result;
        for (let i = 0; i < matches.length; i++) {
          const m = matches[i] as {
            zone_id?: string;
            content_type?: string;
            match_status?: string;
            match_kind?: string | null;
            units_needed?: number;
            packs_needed?: number;
            candidates?: Array<{ sku_id?: string; set_quantity?: number }>;
          };
          const top = m.candidates?.[0];
          const matchStatus = m.match_status ?? "no_match";
          if (matchStatus === "no_match" || !top?.sku_id) continue;

          await client.query(
            `INSERT INTO configuration_skus
               (configuration_id, sku_id, zone_id, content_type, block_index,
                units_needed, packs_needed, set_quantity_snap, match_status, match_kind)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              configId,
              top.sku_id,
              m.zone_id ?? null,
              m.content_type ?? null,
              i,
              m.units_needed ?? 1,
              m.packs_needed ?? 1,
              top.set_quantity ?? 1,
              matchStatus,
              m.match_kind ?? null,
            ],
          );
        }
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    const response: CalculateResponse = { token, fit_status: fitStatus };
    res.json(response);
  };
}
