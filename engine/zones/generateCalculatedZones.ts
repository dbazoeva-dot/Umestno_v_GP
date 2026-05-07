import type { CalculatedZone, StorageRequirement } from "../types.js";
import { calculateCellsZone } from "./calculateCellsZone.js";
import { calculateSlotsZone } from "./calculateSlotsZone.js";
export function generateCalculatedZones(requirements: StorageRequirement[]): CalculatedZone[] {
  return requirements.map((req) => {
    const primaryOptions = req.available_layout_options.filter((option) => option.division_type === req.primary_division && option.calculation_mode !== "open_capacity_in_box" && option.calculation_mode !== "linear_depth_split");
    const generated = primaryOptions.map((option) => option.division_type === "cells" ? calculateCellsZone(req, option) : calculateSlotsZone(req, option));
    if (generated.length === 0) throw new Error(`No primary calculated zone generated for ${req.content_type}`);
    return generated.sort((a, b) => (a.capacity - a.count) - (b.capacity - b.count) || (a.zone_w_cm * a.zone_d_cm) - (b.zone_w_cm * b.zone_d_cm))[0];
  });
}
