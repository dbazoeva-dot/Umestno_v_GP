import type { CalculatedZone, StorageRequirement, ZoneLayoutOptionRow } from "../types.js";
export function calculateCellsZone(req: StorageRequirement, option: ZoneLayoutOptionRow): CalculatedZone {
  const cols = option.cols ?? 1; const rows = option.rows ?? 1;
  return { ...req, zone_id: `${req.content_type}_${option.option_id}`, original_division_type: req.primary_division, division_type: "cells", option_id: option.option_id, calculation_mode: "fixed_grid", zone_w_cm: cols * req.unit_w_cm + 2 * req.side_clear, zone_d_cm: rows * req.unit_d_cm + 2 * req.fb_clear, zone_h_cm: req.unit_h_cm + req.h_clear, capacity: cols * rows, calculated_cols: cols, calculated_rows: rows };
}
