import type { DrawerSize, SchemePayload, SkuCatalogRow } from "../types.js";
import type { MatchKind, MatchStatus, NoMatchLogEntry, SkuMatch } from "./matchSkus.js";

export interface MatchedSkuFinal extends SkuCatalogRow {
  zone_id: string;
  content_type: string;
  match_status: MatchStatus;
  match_kind: MatchKind;
  units_needed: number;
  packs_needed: number;
}

export interface SkuFitResult {
  sku_fit_status: "fit_all" | "no_sku_matches";
  matched_skus_final: MatchedSkuFinal[];
  failed_skus: NoMatchLogEntry[];
  failed_dimension?: "width" | "depth" | "height";
  missing_width_cm: number;
  missing_depth_cm: number;
  missing_height_cm: number;
  alternative_sku_candidates: SkuCatalogRow[];
  needs_adjustment: boolean;
  scheme_fit_status: SchemePayload["fit_status"];
}

export function runSkuFitCheck({
  schemePayload,
  skuMatches,
}: {
  schemePayload: SchemePayload;
  skuMatches: SkuMatch[];
  drawerSize: DrawerSize;
}): SkuFitResult {
  const matched_skus_final: MatchedSkuFinal[] = skuMatches
    .filter((m) => m.candidates[0])
    .map((m) => ({
      ...m.candidates[0],
      zone_id: m.zone_id,
      content_type: m.content_type,
      match_status: m.match_status,
      match_kind: m.match_kind,
      units_needed: m.units_needed,
      packs_needed: m.packs_needed,
    }));

  const failed_skus: NoMatchLogEntry[] = skuMatches.flatMap((m) => (m.no_match_log ? [m.no_match_log] : []));

  return {
    sku_fit_status: skuMatches.every((m) => m.match_status !== "no_match") ? "fit_all" : "no_sku_matches",
    matched_skus_final,
    failed_skus,
    failed_dimension: undefined,
    missing_width_cm: 0,
    missing_depth_cm: 0,
    missing_height_cm: 0,
    alternative_sku_candidates: [],
    needs_adjustment: false,
    scheme_fit_status: schemePayload.fit_status,
  };
}
