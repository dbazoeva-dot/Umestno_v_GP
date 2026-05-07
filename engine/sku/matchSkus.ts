import type { SchemePayload, SkuCatalogRow } from "../types.js";
export function matchSkus({ schemePayload, skuCatalog, colorPreference }: { schemePayload: SchemePayload; skuCatalog: SkuCatalogRow[]; colorPreference: string }) {
  return schemePayload.selected_calculated_zones.map((zone) => {
    const candidates = skuCatalog.filter((sku) => sku.division_type === zone.division_type && sku.capacity_units >= zone.count && sku.width_cm <= zone.zone_w_cm && sku.depth_cm <= zone.zone_d_cm && sku.height_cm <= zone.zone_h_cm && sku.availability_status !== "unavailable").sort((a, b) => Number(b.color_group === colorPreference) - Number(a.color_group === colorPreference));
    return { zone_id: zone.zone_id, content_type: zone.content_type, match_status: candidates[0] ? "exact" : "no_match", candidates };
  });
}
