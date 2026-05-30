// POST /api/calculate
//
// Принимает форму конфигуратора → гонит engine + matchSkus →
// сохраняет результат в configurations + configuration_skus →
// возвращает token для перехода на /result/[token].
//
// Контракт запроса задаётся фронтом из configure/index.html.

import { randomBytes } from "crypto";
import type { Request, Response } from "express";
import type { Pool } from "pg";
import { runUmestnoEngine } from "../../engine/index.js";
import { defaultLibraries } from "../../engine/libraries/defaultLibraries.js";
import type { SkuCatalogRow, FitStatus } from "../../engine/types.js";

interface CalculateRequest {
  drawer_width_cm: number;
  drawer_depth_cm: number;
  drawer_height_cm: number;
  storage_category: "underwear" | "soft_clothes" | "accessories" | "mixed";
  items: Array<{ content_type: string; volume_level: "small" | "medium" | "large" }>;
  priority: "convenient" | "capacity" | "budget";
  color_preference?: string;
  session_id?: string;
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

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO configurations (session_id, input_payload, engine_output, fit_status, token)
         VALUES ($1, $2, $3, $4, $5)`,
        [body.session_id ?? null, body, result, fitStatus, token],
      );

      // Если схема построена — пишем выбранные SKU по каждой зоне
      if (result.scheme_payload && result.debug.sku_matching_result) {
        const configRow = await client.query<{ id: string }>(
          `SELECT id FROM configurations WHERE token = $1`,
          [token],
        );
        const configId = configRow.rows[0]?.id;
        if (configId) {
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
