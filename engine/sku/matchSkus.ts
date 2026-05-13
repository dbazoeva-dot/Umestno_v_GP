import type { SchemePayload, SkuCatalogRow } from "../types.js";

// Rigidity compatibility: returns 2=exact, 1=compatible, 0=mismatch
function rigidityScore(preferred: string, actual: string): number {
  if (!preferred || !actual) return 0;
  if (actual === preferred) return 2;
  const compatible: Record<string, string[]> = {
    soft:       ["semi_rigid"],
    semi_rigid: ["soft", "rigid"],
    rigid:      ["semi_rigid"],
  };
  return compatible[preferred]?.includes(actual) ? 1 : 0;
}

// Color match score
function colorScore(colorPreference: string, colorGroup: string | undefined): number {
  if (!colorPreference || colorPreference === "not_important") return 0;
  return colorGroup === colorPreference ? 1 : 0;
}

export function matchSkus({
  schemePayload,
  skuCatalog,
  colorPreference,
}: {
  schemePayload: SchemePayload;
  skuCatalog: SkuCatalogRow[];
  colorPreference: string;
}) {
  return schemePayload.selected_calculated_zones.map((zone) => {
    const placedZone = schemePayload.assigned_zones.find((p) => p.zone_id === zone.zone_id);
    const assignedW = placedZone?.assigned_w_cm ?? zone.zone_w_cm;
    const assignedD = placedZone?.assigned_d_cm ?? zone.zone_d_cm;
    const assignedH = placedZone?.assigned_h_cm ?? zone.zone_h_cm;
    const assignedArea = assignedW * assignedD;

    let candidates: SkuCatalogRow[];

    if (zone.division_type === "open") {
      // Open: capacity_units not relevant — engine already sized the zone.
      // Match by physical footprint; rank by rigidity, color, then footprint closeness.
      // Exclude SKUs that cover less than 30% of the assigned area (too undersized).
      candidates = skuCatalog
        .filter((sku) =>
          sku.division_type === "open" &&
          sku.availability_status !== "unavailable" &&
          sku.width_cm <= assignedW &&
          sku.depth_cm <= assignedD &&
          sku.height_cm <= assignedH &&
          (sku.width_cm * sku.depth_cm) / assignedArea >= 0.30
        )
        .sort((a, b) => {
          const rs = rigidityScore(zone.preferred_rigidity, b.rigidity) - rigidityScore(zone.preferred_rigidity, a.rigidity);
          if (rs !== 0) return rs;
          const cs = colorScore(colorPreference, b.color_group) - colorScore(colorPreference, a.color_group);
          if (cs !== 0) return cs;
          // Prefer closer footprint (less leftover)
          const leftoverA = (assignedW - a.width_cm) * (assignedD - a.depth_cm);
          const leftoverB = (assignedW - b.width_cm) * (assignedD - b.depth_cm);
          return leftoverA - leftoverB;
        });
    } else {
      // Cells and slots: capacity_units >= required count is mandatory.
      candidates = skuCatalog
        .filter((sku) =>
          sku.division_type === zone.division_type &&
          sku.availability_status !== "unavailable" &&
          sku.capacity_units != null &&
          sku.capacity_units >= zone.count &&
          sku.width_cm <= zone.zone_w_cm &&
          sku.depth_cm <= zone.zone_d_cm &&
          sku.height_cm <= zone.zone_h_cm
        )
        .sort((a, b) => {
          const rs = rigidityScore(zone.preferred_rigidity, b.rigidity) - rigidityScore(zone.preferred_rigidity, a.rigidity);
          if (rs !== 0) return rs;
          const cs = colorScore(colorPreference, b.color_group) - colorScore(colorPreference, a.color_group);
          if (cs !== 0) return cs;
          // Prefer exact capacity over excess
          return (a.capacity_units! - zone.count) - (b.capacity_units! - zone.count);
        });
    }

    return {
      zone_id: zone.zone_id,
      content_type: zone.content_type,
      match_status: candidates[0] ? "exact" : "no_match",
      candidates,
    };
  });
}
