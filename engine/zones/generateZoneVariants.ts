import type { CalculatedZone, DrawerSize, StorageRequirement, ZoneLayoutOptionRow } from "../types.js";
import { calculateCellsZone } from "./calculateCellsZone.js";
import { calculateSlotsZone } from "./calculateSlotsZone.js";
import { calculateSlotsSplitZone } from "./calculateSlotsSplitZone.js";

const MAX_VARIANTS = 3;

export function generateZoneVariants(requirements: StorageRequirement[], zoneLayoutOptions: ZoneLayoutOptionRow[], drawerSize: DrawerSize): CalculatedZone[][] {
  return requirements.map((req) => {
    const candidates = buildCandidates(req, zoneLayoutOptions, drawerSize);
    const valid = candidates.filter((zone) => zone.capacity >= req.count);
    const pool = valid.length > 0 ? valid : candidates;
    return pool
      .sort((a, b) => (a.capacity - req.count) - (b.capacity - req.count) || a.zone_w_cm * a.zone_d_cm - b.zone_w_cm * b.zone_d_cm)
      .slice(0, MAX_VARIANTS);
  });
}

function buildCandidates(req: StorageRequirement, zoneLayoutOptions: ZoneLayoutOptionRow[], drawerSize: DrawerSize): CalculatedZone[] {
  const variants: CalculatedZone[] = [];

  for (const option of zoneLayoutOptions) {
    if (option.division_type !== req.primary_division) continue;
    if (option.calculation_mode === "open_capacity_in_box" || option.calculation_mode === "linear_depth_split") continue;
    if (req.count < (option.count_min ?? 0)) continue;

    if (option.division_type === "cells") {
      const cap = option.capacity ?? (option.cols ?? 1) * (option.rows ?? 1);
      if (cap < req.count) continue;
      variants.push(calculateCellsZone(req, option));
    } else if (option.division_type === "slots") {
      if (req.count > (option.count_max ?? Infinity)) continue;
      variants.push(calculateSlotsZone(req, option));
    } else if (option.division_type === "open") {
      if (req.count > (option.count_max ?? Infinity)) continue;
      variants.push(calculateSlotsZone(req, option));
    }
  }

  if (req.primary_division === "slots" && (req.max_slot_lanes ?? 1) >= 2) {
    const splitOption = zoneLayoutOptions.find((o) => o.option_id === "slots_multi_lane_auto");
    const singleRowOption = zoneLayoutOptions.find((o) => o.option_id === "slots_single_row");
    if (splitOption && singleRowOption) {
      const baseSingleLane = calculateSlotsZone(req, singleRowOption);
      const splitZone = calculateSlotsSplitZone(baseSingleLane, splitOption, drawerSize, baseSingleLane);
      if (splitZone.split_used && (splitZone.lanes_needed ?? 1) > 1) variants.push(splitZone);
    }
  }

  if (req.can_rotate && req.primary_division === "slots") {
    for (const zone of variants.filter((v) => v.calculation_mode === "linear_depth")) {
      if (zone.zone_w_cm === zone.zone_d_cm) continue;
      variants.push({ ...zone, zone_id: `${zone.zone_id}_rotated`, option_id: `${zone.option_id}_rotated`, zone_w_cm: zone.zone_d_cm, zone_d_cm: zone.zone_w_cm, variant_transform: "rotate_90" });
    }
  }

  return variants;
}
