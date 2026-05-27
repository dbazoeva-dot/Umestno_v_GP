import type { DrawerSize, SchemePayload } from "../types.js";
export function runSkuFitCheck({ schemePayload, skuMatches }: { schemePayload: SchemePayload; skuMatches: ReturnType<typeof import("./matchSkus.js").matchSkus>; drawerSize: DrawerSize }) {
  return { sku_fit_status: skuMatches.every((match) => match.match_status === "exact") ? "fit_all" : "no_sku_matches", matched_skus_final: skuMatches.flatMap((match) => match.candidates[0] ? [{ ...match.candidates[0], units_needed: match.units_needed }] : []), failed_skus: [], failed_dimension: undefined, missing_width_cm: 0, missing_depth_cm: 0, missing_height_cm: 0, alternative_sku_candidates: [], needs_adjustment: false, scheme_fit_status: schemePayload.fit_status };
}
