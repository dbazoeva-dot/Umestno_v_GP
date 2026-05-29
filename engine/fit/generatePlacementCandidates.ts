import type { CalculatedZone, DrawerSize, FitResult, LayoutPlan, PlacedZone, SoftHeightWarning, SoftHeightWarningCode } from "../types.js";
import { runFitCheck } from "./runFitCheck.js";
import { findFreeRectangles } from "./findFreeRectangles.js";

/** Toggle column-first stratay at runtime, mostly for A/B diagnostics. */
export const featureFlags = { columnFirst: true };

export function generatePlacementCandidates({ zoneVariants, drawerSize }: { zoneVariants: CalculatedZone[][]; drawerSize: DrawerSize }): FitResult[] {
  if (zoneVariants.length === 0) return [];

  const combos = cartesianProduct(zoneVariants);
  const seen = new Set<string>();
  const results: FitResult[] = [];

  for (const combo of combos) {
    for (const perm of permutations(combo)) {
      const layoutPlan = minimalLayoutPlan(perm);
      const fitResult = runFitCheck({ layoutPlan, calculatedZones: perm, drawerSize, enableDepthStackCandidates: false });
      const key = fingerprint(fitResult);
      if (!seen.has(key)) { seen.add(key); results.push(fitResult); }

      const colStack = tryColumnStack(perm, drawerSize);
      if (colStack) {
        const csKey = fingerprint(colStack);
        if (!seen.has(csKey)) { seen.add(csKey); results.push(colStack); }
      }

      if (featureFlags.columnFirst) {
        const colFirst = tryColumnFirstPlacement(perm, drawerSize);
        if (colFirst) {
          const cfKey = fingerprint(colFirst);
          if (!seen.has(cfKey)) { seen.add(cfKey); results.push(colFirst); }
        }
      }
    }
  }

  return results;
}

// Column-first: ставим первую зону якорем в колонку 1, каждую следующую пытаемся
// положить под предыдущую в той же колонке (если по ширине ≤ ширины колонки и по
// глубине ещё помещается). Иначе — открываем новую колонку справа.
// Это даёт колоночные раскладки, которые greedy-top-left пропускает, потому что
// он берёт самый «верхний» свободный rect и не пытается лезть под предыдущую зону.
function tryColumnFirstPlacement(zones: CalculatedZone[], drawerSize: DrawerSize): FitResult | null {
  if (zones.length === 0) return null;
  const placed: PlacedZone[] = [];
  const content_warnings: SoftHeightWarning[] = [];
  let colX = 0, colY = 0, colMaxW = 0;
  let firstInColumn = true;

  for (const zone of zones) {
    const w = zone.assigned_box_w_cm ?? zone.zone_w_cm;
    const d = zone.assigned_box_d_cm ?? zone.zone_d_cm;
    const h = zone.assigned_box_h_cm ?? zone.zone_h_cm;

    let softWarning: SoftHeightWarning | undefined;
    if (h > drawerSize.h_cm) {
      if (!zone.soft_height_warning_allowed || !zone.max_soft_height_overflow_cm || !zone.soft_height_warning_code) return null;
      const overflow = h - drawerSize.h_cm;
      if (overflow > zone.max_soft_height_overflow_cm) return null;
      softWarning = columnStackSoftWarning(zone, drawerSize.h_cm, h, overflow);
    }

    const fitsCurrent = !firstInColumn && w <= colMaxW + 0.0001 && colY + d <= drawerSize.d_cm + 0.0001;
    if (!fitsCurrent) {
      // открыть новую колонку
      const newColX = firstInColumn ? 0 : colX + colMaxW;
      if (newColX + w > drawerSize.w_cm + 0.0001) return null;
      if (d > drawerSize.d_cm + 0.0001) return null;
      colX = newColX;
      colY = 0;
      colMaxW = w;
      firstInColumn = false;
    }

    placed.push({ ...zone, x_cm: colX, y_cm: colY, assigned_w_cm: w, assigned_d_cm: d, assigned_h_cm: h, soft_height_warning: softWarning });
    if (softWarning) content_warnings.push(softWarning);
    colY += d;
  }

  const free_rectangles = findFreeRectangles(drawerSize, placed);
  return {
    fit_status: "fit_all",
    placed_zones: placed,
    unplaced_zones: [],
    failed_zones: [],
    best_attempt: { placed_count: placed.length },
    failed_dimension: undefined,
    missing_width_cm: 0, missing_depth_cm: 0, missing_height_cm: 0,
    used_width_cm: placed.reduce((max, z) => Math.max(max, z.x_cm + z.assigned_w_cm), 0),
    used_depth_cm: placed.reduce((max, z) => Math.max(max, z.y_cm + z.assigned_d_cm), 0),
    used_height_cm: placed.reduce((max, z) => Math.max(max, z.assigned_h_cm), 0),
    overflow_width_cm: 0, overflow_depth_cm: 0, overflow_height_cm: 0,
    free_rectangles,
    available_box: free_rectangles[0] ? { ...free_rectangles[0] } : undefined,
    fit_notes: ["Column-first placement candidate (anchor + same-column stacking, new column on overflow).",
      ...(content_warnings.length ? ["Some content zones were accepted with configured soft height warnings; SKU/product height fit remains strict."] : [])],
    content_warnings,
  };
}

function tryColumnStack(zones: CalculatedZone[], drawerSize: DrawerSize): FitResult | null {
  const placed: PlacedZone[] = [];
  const content_warnings: SoftHeightWarning[] = [];
  let y = 0;

  for (const zone of zones) {
    const w = zone.assigned_box_w_cm ?? zone.zone_w_cm;
    const d = zone.assigned_box_d_cm ?? zone.zone_d_cm;
    const h = zone.assigned_box_h_cm ?? zone.zone_h_cm;

    if (w > drawerSize.w_cm || y + d > drawerSize.d_cm) return null;

    let softWarning: SoftHeightWarning | undefined;
    if (h > drawerSize.h_cm) {
      if (!zone.soft_height_warning_allowed || !zone.max_soft_height_overflow_cm || !zone.soft_height_warning_code) return null;
      const overflow = h - drawerSize.h_cm;
      if (overflow > zone.max_soft_height_overflow_cm) return null;
      softWarning = columnStackSoftWarning(zone, drawerSize.h_cm, h, overflow);
      content_warnings.push(softWarning);
    }

    placed.push({ ...zone, x_cm: 0, y_cm: y, assigned_w_cm: w, assigned_d_cm: d, assigned_h_cm: h, soft_height_warning: softWarning });
    y += d;
  }

  const free_rectangles = findFreeRectangles(drawerSize, placed);
  const fit_notes = ["Column-stacked placement candidate.",
    ...(content_warnings.length ? ["Some content zones were accepted with configured soft height warnings; SKU/product height fit remains strict."] : [])];

  return {
    fit_status: "fit_all",
    placed_zones: placed,
    unplaced_zones: [],
    failed_zones: [],
    best_attempt: { placed_count: placed.length },
    failed_dimension: undefined,
    missing_width_cm: 0, missing_depth_cm: 0, missing_height_cm: 0,
    used_width_cm: placed.reduce((max, z) => Math.max(max, z.x_cm + z.assigned_w_cm), 0),
    used_depth_cm: y,
    used_height_cm: placed.reduce((max, z) => Math.max(max, z.assigned_h_cm), 0),
    overflow_width_cm: 0, overflow_depth_cm: 0, overflow_height_cm: 0,
    free_rectangles,
    available_box: free_rectangles[0] ? { ...free_rectangles[0] } : undefined,
    fit_notes,
    content_warnings,
  };
}

function columnStackSoftWarning(zone: CalculatedZone, availableH: number, neededH: number, overflow: number): SoftHeightWarning {
  const code = zone.soft_height_warning_code as SoftHeightWarningCode;
  const message = code === "deformation_risk"
    ? `Схема помещается в ваш ящик, но есть нюанс по высоте: для ${zone.content_type} доступно ${availableH} см, а комфортная высота хранения составляет около ${neededH} см. Их можно разместить, но чашки могут слегка сжиматься и со временем деформироваться.`
    : `Схема помещается в ваш ящик, но есть нюанс по высоте: для ${zone.content_type} доступно ${availableH} см, а комфортная высота хранения составляет около ${neededH} см. Вещи поместятся, но хранение будет более плотным: их может быть чуть менее удобно доставать.`;
  return { content_type: zone.content_type, zone_id: zone.zone_id, warning_code: code, message, available_h_cm: availableH, drawer_h_cm: availableH, needed_h_cm: neededH, zone_h_cm: neededH, overflow_h_cm: overflow, max_allowed_overflow_h_cm: zone.max_soft_height_overflow_cm! };
}

function minimalLayoutPlan(zones: CalculatedZone[]): LayoutPlan {
  return { layout_id: "candidate", selected_zones: zones, placement_order: zones.map((z) => z.content_type), rules_applied: [], reserve_policy: "reserve_to_edge_or_open_zone" };
}

function fingerprint(fitResult: FitResult): string {
  return fitResult.placed_zones
    .map((z) => `${z.zone_id}:${z.x_cm.toFixed(4)}:${z.y_cm.toFixed(4)}:${z.assigned_w_cm.toFixed(4)}:${z.assigned_d_cm.toFixed(4)}`)
    .sort()
    .join("|");
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, array) => acc.flatMap((existing) => array.map((item) => [...existing, item])), [[]]);
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}
