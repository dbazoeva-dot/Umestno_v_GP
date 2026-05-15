import type { SchemePayload, SkuCatalogRow } from "../types.js";

export interface SkuMatch {
  zone_id: string;
  content_type: string;
  match_status: "exact" | "no_match";
  candidates: SkuCatalogRow[];
}

export function matchSkus({
  schemePayload,
  skuCatalog,
  colorPreference,
}: {
  schemePayload: SchemePayload;
  skuCatalog: SkuCatalogRow[];
  colorPreference?: string;
}): SkuMatch[] {
  return schemePayload.selected_calculated_zones.map((zone) => {
    const effectiveW = zone.split_lane_zone?.zone_w_cm ?? zone.zone_w_cm;
    const effectiveD = zone.split_lane_zone?.zone_d_cm ?? zone.zone_d_cm;
    const effectiveH = zone.split_lane_zone?.zone_h_cm ?? zone.zone_h_cm;
    const neededCount = zone.split_lane_zone?.capacity ?? zone.count;

    const candidates = skuCatalog.filter((sku) => {
      if (sku.availability_status === "unavailable") return false;
      if (sku.division_type !== zone.division_type) return false;

      const cw = sku.cell_width_cm ?? sku.width_cm;
      const cd = sku.cell_depth_cm ?? sku.depth_cm;
      const h = sku.height_cm;

      if (cw == null || cd == null || h == null) return false;

      if (Math.abs(cw - zone.unit_w_cm) > 3) return false;
      if (Math.abs(cd - zone.unit_d_cm) > 1.5) return false;
      if (h < zone.unit_h_cm - 3 || h > zone.unit_h_cm + 5) return false;

      const cap = (sku.capacity_units ?? 0) * (sku.set_quantity ?? 1);
      if (cap < neededCount) return false;

      const w = sku.width_cm;
      const d = sku.depth_cm;
      if (w == null || d == null) return false;

      const fitsNormal = w <= effectiveW && d <= effectiveD;
      const fitsRotated =
        sku.can_rotate === "yes" && d <= effectiveW && w <= effectiveD;
      if (!fitsNormal && !fitsRotated) return false;

      return true;
    });

    candidates.sort((a, b) => {
      const aColor = colorPreference && a.color_group === colorPreference ? 1 : 0;
      const bColor = colorPreference && b.color_group === colorPreference ? 1 : 0;
      if (bColor !== aColor) return bColor - aColor;
      return (a.price ?? Infinity) - (b.price ?? Infinity);
    });

    return {
      zone_id: zone.zone_id,
      content_type: zone.content_type,
      match_status: candidates.length > 0 ? "exact" : "no_match",
      candidates,
    };
  });
}
