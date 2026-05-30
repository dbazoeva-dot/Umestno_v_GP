// GET /api/result/:token
//
// Отдаёт сохранённую конфигурацию + подобранные SKU для рендера
// result-страницы. Картинки SKU собираются как
// `${IMAGE_BASE_URL}/<image_s3_key>.webp` — base-URL берётся из env,
// поэтому переезд статики в S3 не требует правок этого эндпойнта.

import type { Request, Response } from "express";
import type { Pool } from "pg";
import type { Env } from "../config/env.js";

interface MatchedSkuPublic {
  zone_id: string | null;
  content_type: string | null;
  block_index: number;
  units_needed: number;
  packs_needed: number;
  match_status: string;
  match_kind: string | null;
  sku: {
    sku_id: string;
    product_title: string;
    image_url: string | null;
    width_cm: number;
    depth_cm: number;
    height_cm: number;
    capacity_units: number | null;
    set_quantity: number;
    color_group: string | null;
    product_url: string | null;
  };
}

interface ResultResponse {
  token: string;
  fit_status: string;
  created_at: string;
  input: unknown;
  scheme: unknown;
  matches: MatchedSkuPublic[];
}

function buildImageUrl(env: Env, key: string | null): string | null {
  if (!key) return null;
  return `${env.IMAGE_BASE_URL}/${encodeURIComponent(key)}.webp`;
}

export function resultHandler(pool: Pool, env: Env) {
  return async (req: Request, res: Response) => {
    const { token } = req.params;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ ok: false, error: "invalid_token" });
    }

    const cfg = await pool.query<{
      id: string;
      input_payload: unknown;
      engine_output: { scheme_payload?: unknown } | null;
      fit_status: string;
      created_at: Date;
    }>(
      `SELECT id, input_payload, engine_output, fit_status, created_at
       FROM configurations WHERE token = $1`,
      [token],
    );
    if (cfg.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    const row = cfg.rows[0];

    const matchesQ = await pool.query<{
      zone_id: string | null;
      content_type: string | null;
      block_index: number;
      units_needed: number;
      packs_needed: number;
      match_status: string;
      match_kind: string | null;
      sku_id: string;
      product_title: string;
      image_s3_key: string | null;
      width_cm: string;
      depth_cm: string;
      height_cm: string;
      capacity_units: number | null;
      set_quantity: number;
      color_group: string | null;
      product_url: string | null;
    }>(
      `SELECT cs.zone_id, cs.content_type, cs.block_index,
              cs.units_needed, cs.packs_needed, cs.match_status, cs.match_kind,
              s.sku_id, s.product_title, s.image_s3_key,
              s.width_cm, s.depth_cm, s.height_cm,
              s.capacity_units, s.set_quantity, s.color_group, s.product_url
         FROM configuration_skus cs
         JOIN sku s ON s.sku_id = cs.sku_id
        WHERE cs.configuration_id = $1
        ORDER BY cs.block_index`,
      [row.id],
    );

    const matches: MatchedSkuPublic[] = matchesQ.rows.map((r) => ({
      zone_id:      r.zone_id,
      content_type: r.content_type,
      block_index:  r.block_index,
      units_needed: r.units_needed,
      packs_needed: r.packs_needed,
      match_status: r.match_status,
      match_kind:   r.match_kind,
      sku: {
        sku_id:         r.sku_id,
        product_title:  r.product_title,
        image_url:      buildImageUrl(env, r.image_s3_key),
        width_cm:       parseFloat(r.width_cm),
        depth_cm:       parseFloat(r.depth_cm),
        height_cm:      parseFloat(r.height_cm),
        capacity_units: r.capacity_units,
        set_quantity:   r.set_quantity,
        color_group:    r.color_group,
        product_url:    r.product_url,
      },
    }));

    const response: ResultResponse = {
      token,
      fit_status:  row.fit_status,
      created_at:  row.created_at.toISOString(),
      input:       row.input_payload,
      scheme:      row.engine_output?.scheme_payload ?? null,
      matches,
    };
    res.json(response);
  };
}
