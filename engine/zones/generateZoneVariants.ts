import type { CalculatedZone, DrawerSize, StorageRequirement, ZoneLayoutOptionRow } from "../types.js";
import { calculateCellsZone } from "./calculateCellsZone.js";
import { calculateSlotsZone } from "./calculateSlotsZone.js";
import { calculateSlotsSplitZone } from "./calculateSlotsSplitZone.js";

const MAX_VARIANTS = 3;

// Вытянутые cells-раскладки с ТОЧНОЙ вместимостью (BL-18): 2×8 (=16), 3×8/2×12 (=24).
// По surplus они равны компактным 4×4/4×6, поэтому пускать их в общий пул нельзя —
// иначе мульти-зонный оптимизатор начнёт выбирать их в обычных ящиках и менять
// привычные схемы. Подключаем их как «спасательные» формы только когда ни одна
// компактная раскладка (включая поворот) не вписывается в геометрию ящика.
export const FALLBACK_CELLS = new Set(["cells_2x8", "cells_3x8", "cells_2x12"]);

function footprintFits(zone: CalculatedZone, drawerSize: DrawerSize): boolean {
  return zone.zone_w_cm <= drawerSize.w_cm && zone.zone_d_cm <= drawerSize.d_cm;
}

// Fit-aware поворот cells: повёрнутый вариант сетки нужен только если прямая
// ориентация не лезет в ящик, а повёрнутая лезет. Схемы, которые уже помещаются
// «как есть», ориентацию не меняют.
function rotateCellsForFit(zone: CalculatedZone, drawerSize: DrawerSize): CalculatedZone | null {
  if (zone.zone_w_cm === zone.zone_d_cm) return null;
  const rotatedFits = zone.zone_d_cm <= drawerSize.w_cm && zone.zone_w_cm <= drawerSize.d_cm;
  if (footprintFits(zone, drawerSize) || !rotatedFits) return null;
  return { ...zone, zone_id: `${zone.zone_id}_rotated`, option_id: `${zone.option_id}_rotated`, zone_w_cm: zone.zone_d_cm, zone_d_cm: zone.zone_w_cm, calculated_cols: zone.calculated_rows, calculated_rows: zone.calculated_cols, variant_transform: "rotate_90" };
}

export function generateZoneVariants(requirements: StorageRequirement[], zoneLayoutOptions: ZoneLayoutOptionRow[], drawerSize: DrawerSize): CalculatedZone[][] {
  return requirements.map((req) => {
    const candidates = buildCandidates(req, zoneLayoutOptions, drawerSize);
    const valid = candidates.filter((zone) => zone.capacity >= req.count);
    const pool = valid.length > 0 ? valid : candidates;
    // Geometry-first: вариант, чей след вписывается в ящик, идёт раньше того,
    // что не вписывается, — чтобы подходящая форма не выпала из окна top-MAX_VARIANTS
    // до того, как её увидит placement-скоринг. Среди равно (не)вписывающихся
    // вариантов сохраняется прежний порядок surplus→площадь, поэтому схемы, чьи
    // лучшие кандидаты и так помещались, не меняются.
    return pool
      .sort((a, b) =>
        (Number(footprintFits(b, drawerSize)) - Number(footprintFits(a, drawerSize))) ||
        (a.capacity - req.count) - (b.capacity - req.count) ||
        a.zone_w_cm * a.zone_d_cm - b.zone_w_cm * b.zone_d_cm)
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
      if (FALLBACK_CELLS.has(option.option_id)) continue; // rescue shapes added below, only if needed
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

  // Cells rotation (BL-18): fit-aware rotation of the standard grids.
  if (req.can_rotate && req.primary_division === "cells") {
    for (const zone of variants.filter((v) => v.calculation_mode === "fixed_grid")) {
      const rotated = rotateCellsForFit(zone, drawerSize);
      if (rotated) variants.push(rotated);
    }
  }

  // Rescue elongated cells (BL-18): only when no standard grid — upright or
  // rotated — fits the drawer footprint. Keeps roomy-drawer schemes on the
  // compact grids and offers very narrow/deep shapes (3×8, 2×12, 2×8) solely
  // for non-standard drawers where nothing else fits.
  if (req.primary_division === "cells" && !variants.some((v) => v.calculation_mode === "fixed_grid" && footprintFits(v, drawerSize))) {
    for (const option of zoneLayoutOptions) {
      if (!FALLBACK_CELLS.has(option.option_id)) continue;
      if (req.count < (option.count_min ?? 0)) continue;
      const cap = option.capacity ?? (option.cols ?? 1) * (option.rows ?? 1);
      if (cap < req.count) continue;
      const zone = calculateCellsZone(req, option);
      variants.push(zone);
      if (req.can_rotate) {
        const rotated = rotateCellsForFit(zone, drawerSize);
        if (rotated) variants.push(rotated);
      }
    }
  }

  return variants;
}
