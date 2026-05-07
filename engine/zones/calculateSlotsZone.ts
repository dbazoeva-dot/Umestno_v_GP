import type { CalculatedZone, StorageRequirement, ZoneLayoutOptionRow } from "../types.js";
export function calculateSlotsZone(req: StorageRequirement, option: ZoneLayoutOptionRow): CalculatedZone {
  const gap = req.item_gap ?? 0;
  return { ...req, zone_id: `${req.content_type}_${option.option_id}`, original_division_type: req.primary_division, division_type: "slots", option_id: option.option_id, calculation_mode: "linear_depth", zone_w_cm: req.unit_w_cm + 2 * req.side_clear, zone_d_cm: req.count * req.unit_d_cm + gap * Math.max(0, req.count - 1) + 2 * req.fb_clear, zone_h_cm: req.unit_h_cm + req.h_clear, capacity: req.count };
}
