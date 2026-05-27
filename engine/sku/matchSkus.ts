import type { PlacedZone, SchemePayload, SkuCatalogRow } from "../types.js";

interface LaneSpec { lanes: number; w_cm: number; d_cm: number; h_cm: number; cap_per_lane: number }

// Footprint a single organiser must fit, measured against the DRAWN block (assigned_*),
// so the recommended product fits exactly what the user sees on the scheme.
// Split slot zones are already broken into N parallel lanes by the engine
// (split_used / lanes_needed / items_per_lane) — we match ONE lane and buy N of them.
function laneSpec(zone: PlacedZone): LaneSpec {
  const lanes = zone.split_used && zone.lanes_needed && zone.lanes_needed > 1 ? zone.lanes_needed : 1;
  const capPerLane = lanes > 1 && zone.items_per_lane && zone.items_per_lane.length
    ? Math.max(...zone.items_per_lane)
    : zone.count;
  const gap = lanes > 1 ? zone.slot_lane_gap_cm ?? 0 : 0;
  // lanes sit side by side across the width of the assigned block
  const wPerLane = (zone.assigned_w_cm - gap * (lanes - 1)) / lanes;
  return { lanes, w_cm: wPerLane, d_cm: zone.assigned_d_cm, h_cm: zone.assigned_h_cm, cap_per_lane: capPerLane };
}

export function matchSkus({ schemePayload, skuCatalog, colorPreference }: { schemePayload: SchemePayload; skuCatalog: SkuCatalogRow[]; colorPreference: string }) {
  return schemePayload.assigned_zones.map((zone) => {
    const lane = laneSpec(zone);
    const candidates = skuCatalog
      .filter((sku) =>
        sku.division_type === zone.division_type &&
        sku.capacity_units >= lane.cap_per_lane &&
        sku.width_cm <= lane.w_cm &&
        sku.depth_cm <= lane.d_cm &&
        sku.height_cm <= lane.h_cm &&
        sku.availability_status !== "unavailable")
      // prefer the requested colour, then the organiser that fills the lane best
      .sort((a, b) =>
        (Number(b.color_group === colorPreference) - Number(a.color_group === colorPreference)) ||
        ((b.width_cm * b.depth_cm) - (a.width_cm * a.depth_cm)));
    return {
      zone_id: zone.zone_id,
      content_type: zone.content_type,
      match_status: candidates[0] ? "exact" : "no_match",
      units_needed: lane.lanes,
      lane_footprint_cm: { w: lane.w_cm, d: lane.d_cm, h: lane.h_cm, capacity: lane.cap_per_lane },
      candidates
    };
  });
}
