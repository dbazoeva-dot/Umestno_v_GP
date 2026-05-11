import type { CalculatedZone, DrawerSize, ZoneLayoutOptionRow } from "../types.js";

export function calculateSlotsSplitZone(req: CalculatedZone, option: ZoneLayoutOptionRow, drawerSize: DrawerSize, originalSingleLaneZone: CalculatedZone): CalculatedZone {
  const gap = req.item_gap ?? 0;
  const slotLaneGap = req.slot_lane_gap_cm ?? 1;
  const maxSlotLanes = req.max_slot_lanes ?? 1;
  const maxItemsPerLane = Math.floor((drawerSize.d_cm - 2 * req.fb_clear + gap) / (req.unit_d_cm + gap));
  if (maxItemsPerLane <= 0) return { ...originalSingleLaneZone, option_id: option.option_id, calculation_mode: "linear_depth_split", split_used: false, original_single_lane_zone: summarizeZone(originalSingleLaneZone), max_items_per_lane: maxItemsPerLane, slot_lane_gap_cm: slotLaneGap, split_rejected_reason: "available depth cannot fit one item per lane" };
  const lanesNeeded = Math.ceil(req.count / maxItemsPerLane);
  if (lanesNeeded > maxSlotLanes) return { ...originalSingleLaneZone, option_id: option.option_id, calculation_mode: "linear_depth_split", split_used: false, original_single_lane_zone: summarizeZone(originalSingleLaneZone), lanes_needed: lanesNeeded, max_items_per_lane: maxItemsPerLane, slot_lane_gap_cm: slotLaneGap, split_rejected_reason: "lanes_needed exceeds max_slot_lanes" };
  const baseItemsPerLane = Math.floor(req.count / lanesNeeded);
  const remainder = req.count % lanesNeeded;
  const itemsPerLane = Array.from({ length: lanesNeeded }, (_, index) => baseItemsPerLane + (index < remainder ? 1 : 0));
  const maxItemsInDeepestLane = Math.max(...itemsPerLane);
  const zoneW = lanesNeeded * (req.unit_w_cm + 2 * req.side_clear) + (lanesNeeded - 1) * slotLaneGap;
  const zoneD = maxItemsInDeepestLane * req.unit_d_cm + Math.max(0, maxItemsInDeepestLane - 1) * gap + 2 * req.fb_clear;
  const zoneH = req.unit_h_cm + req.h_clear;
  const splitZoneSummary = { zone_id: `${req.content_type}_${option.option_id}`, zone_w_cm: zoneW, zone_d_cm: zoneD, zone_h_cm: zoneH, capacity: req.count };
  return { ...req, zone_id: splitZoneSummary.zone_id, original_division_type: req.primary_division, division_type: "slots", option_id: option.option_id, calculation_mode: "linear_depth_split", zone_w_cm: zoneW, zone_d_cm: zoneD, zone_h_cm: zoneH, capacity: req.count, calculated_cols: lanesNeeded, calculated_rows: maxItemsInDeepestLane, split_used: true, lanes_needed: lanesNeeded, items_per_lane: itemsPerLane, max_items_per_lane: maxItemsPerLane, slot_lane_gap_cm: slotLaneGap, original_single_lane_zone: summarizeZone(originalSingleLaneZone), split_lane_zone: splitZoneSummary };
}
function summarizeZone(zone: CalculatedZone) { return { zone_id: zone.zone_id, zone_w_cm: zone.zone_w_cm, zone_d_cm: zone.zone_d_cm, zone_h_cm: zone.zone_h_cm, capacity: zone.capacity }; }
