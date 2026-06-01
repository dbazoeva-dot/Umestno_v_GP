// GET /api/result/:token
//
// Отдаёт сохранённую конфигурацию + подобранные SKU для рендера
// result-страницы. Картинки SKU собираются как
// `${IMAGE_BASE_URL}/<image_s3_key>.webp` — base-URL берётся из env,
// поэтому переезд статики в S3 не требует правок этого эндпойнта.
//
// Контракт ответа — docs/api-contract.md (раздел GET /api/result/:token).
// Главный принцип: сервер шлёт только данные расчёта + эхо ввода,
// внутренние поля движка (option_id, calculation_mode, layout_plan,
// layout_rule_evaluations, scheme_id, …) сюда не попадают.

import type { Request, Response } from "express";
import type { Pool } from "pg";
import type { Env } from "../config/env.js";

interface PublicInput {
  drawer: { w_cm: number; d_cm: number; h_cm: number };
  items: Array<{ content_type: string; volume_level: "small" | "medium" | "large" }>;
  priority: "convenient" | "capacity" | "budget";
}

interface PublicAssignedZone {
  zone_id: string;
  content_type: string;
  x_cm: number; y_cm: number;
  assigned_w_cm: number; assigned_d_cm: number; assigned_h_cm: number;
}

interface PublicReserveRect {
  x_cm: number; y_cm: number; w_cm: number; d_cm: number; h_cm: number;
}

interface PublicScheme {
  drawer: { w_cm: number; d_cm: number; h_cm: number };
  assigned_zones: PublicAssignedZone[];
  reserve_zones: PublicReserveRect[];
}

interface PublicMatch {
  zone_id: string | null;
  content_type: string | null;
  block_index: number;
  sku: {
    sku_id: string;
    product_title: string;
    product_url: string | null;
    image_url: string | null;
    width_cm: number;
    depth_cm: number;
    height_cm: number;
    capacity_units: number | null;
    rigidity: "soft" | "semi_rigid" | "rigid";
    division_type: "cells" | "slots" | "open" | "dividers";
    color_group: string | null;
  };
}

interface ResultResponse {
  token: string;
  fit_status: string;
  created_at: string;
  input: PublicInput;
  scheme: PublicScheme | null;
  matches: PublicMatch[];
}

function buildImageUrl(env: Env, key: string | null): string | null {
  if (!key) return null;
  return `${env.IMAGE_BASE_URL}/${encodeURIComponent(key)}.webp`;
}

// Сырой input_payload (из POST /api/calculate) — пользовательский ввод с
// флагами согласия, session_id и т.п. Клампим до того, что показывает фронт.
function clampInput(raw: unknown): PublicInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const items = Array.isArray(r.items)
    ? (r.items as Array<Record<string, unknown>>).map((it) => ({
        content_type: String(it.content_type ?? ""),
        volume_level: (it.volume_level ?? "medium") as "small" | "medium" | "large",
      }))
    : [];
  return {
    drawer: {
      w_cm: Number(r.drawer_width_cm ?? 0),
      d_cm: Number(r.drawer_depth_cm ?? 0),
      h_cm: Number(r.drawer_height_cm ?? 0),
    },
    items,
    priority: (r.priority ?? "convenient") as "convenient" | "capacity" | "budget",
  };
}

// Внутренний SchemePayload движка → публичная форма. Жёстко перечисляем поля,
// чтобы новые внутренние ключи в движке не утекали наружу автоматически.
function clampScheme(raw: unknown, inputDrawer: PublicInput["drawer"]): PublicScheme | null {
  if (!raw || typeof raw !== "object") return null;
  const sp = raw as Record<string, unknown>;
  const assignedRaw = Array.isArray(sp.assigned_zones) ? (sp.assigned_zones as Array<Record<string, unknown>>) : [];
  const reserveRaw = Array.isArray(sp.reserve_zones) ? (sp.reserve_zones as Array<Record<string, unknown>>) : [];
  return {
    drawer: { w_cm: inputDrawer.w_cm, d_cm: inputDrawer.d_cm, h_cm: inputDrawer.h_cm },
    assigned_zones: assignedRaw.map((z) => ({
      zone_id:        String(z.zone_id ?? ""),
      content_type:   String(z.content_type ?? ""),
      x_cm:           Number(z.x_cm ?? 0),
      y_cm:           Number(z.y_cm ?? 0),
      assigned_w_cm:  Number(z.assigned_w_cm ?? 0),
      assigned_d_cm:  Number(z.assigned_d_cm ?? 0),
      assigned_h_cm:  Number(z.assigned_h_cm ?? 0),
    })),
    reserve_zones: reserveRaw.map((r) => ({
      x_cm: Number(r.x_cm ?? 0),
      y_cm: Number(r.y_cm ?? 0),
      w_cm: Number(r.w_cm ?? 0),
      d_cm: Number(r.d_cm ?? 0),
      h_cm: Number(r.h_cm ?? 0),
    })),
  };
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
      sku_id: string;
      product_title: string;
      product_url: string | null;
      affiliate_url: string | null;
      image_s3_key: string | null;
      width_cm: string;
      depth_cm: string;
      height_cm: string;
      capacity_units: number | null;
      rigidity: "soft" | "semi_rigid" | "rigid";
      division_type: "cells" | "slots" | "open" | "dividers";
      color_group: string | null;
    }>(
      `SELECT cs.zone_id, cs.content_type, cs.block_index,
              s.sku_id, s.product_title, s.product_url, s.affiliate_url,
              s.image_s3_key,
              s.width_cm, s.depth_cm, s.height_cm,
              s.capacity_units, s.rigidity, s.division_type, s.color_group
         FROM configuration_skus cs
         JOIN sku s ON s.sku_id = cs.sku_id
        WHERE cs.configuration_id = $1
        ORDER BY cs.block_index`,
      [row.id],
    );

    const matches: PublicMatch[] = matchesQ.rows.map((r) => ({
      zone_id:      r.zone_id,
      content_type: r.content_type,
      block_index:  r.block_index,
      sku: {
        sku_id:         r.sku_id,
        product_title:  r.product_title,
        // Партнёрская ссылка предпочтительнее публичной (если есть).
        // Фронт получает одно поле product_url и не отличает одно от
        // другого; expected_affiliate_cpa на фронт не уходит (бизнес-метрика).
        product_url:    r.affiliate_url ?? r.product_url,
        image_url:      buildImageUrl(env, r.image_s3_key),
        width_cm:       parseFloat(r.width_cm),
        depth_cm:       parseFloat(r.depth_cm),
        height_cm:      parseFloat(r.height_cm),
        capacity_units: r.capacity_units,
        rigidity:       r.rigidity,
        division_type:  r.division_type,
        color_group:    r.color_group,
      },
    }));

    const input = clampInput(row.input_payload);
    const scheme = clampScheme(row.engine_output?.scheme_payload, input.drawer);

    const response: ResultResponse = {
      token,
      fit_status:  row.fit_status,
      created_at:  row.created_at.toISOString(),
      input,
      scheme,
      matches,
    };
    res.json(response);
  };
}
