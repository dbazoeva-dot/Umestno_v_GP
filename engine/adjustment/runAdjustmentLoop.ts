import type { CalculatedZone, DrawerSize, FitResult, LayoutPlan, LayoutRules, ZoneLayoutOptionRow } from "../types.js";
import { calculateOpenCapacityInBox } from "../zones/calculateOpenCapacityInBox.js";
import { calculateSlotsSplitZone } from "../zones/calculateSlotsSplitZone.js";
import { runFitCheck } from "../fit/runFitCheck.js";
import { applyOpenFallback } from "./applyOpenFallback.js";
import { buildAdjustmentCandidates } from "./buildAdjustmentCandidates.js";

type FailedDimension = NonNullable<FitResult["failed_dimension"]>;

type AdjustmentResult = {
  calculatedZones: CalculatedZone[];
  layoutPlan: LayoutPlan;
  adjustment_type: "slots_multi_lane" | "open_fallback" | "no_adjustment";
  fit_after_adjustment: FitResult;
  adjustment_attempts: unknown[];
  rejected_fallback_candidates?: unknown[];
  splitZone?: CalculatedZone;
  openZone?: CalculatedZone;
};

export function runAdjustmentLoop({ fitResult, calculatedZones, layoutPlan, drawerSize, zoneLayoutOptions, layoutRules }: { fitResult: FitResult; calculatedZones: CalculatedZone[]; layoutPlan: LayoutPlan; drawerSize: DrawerSize; zoneLayoutOptions: ZoneLayoutOptionRow[]; layoutRules: LayoutRules }): AdjustmentResult | null {
  const slotSplitAttempt = trySlotSplitBeforeOpenFallback({ fitResult, calculatedZones, layoutPlan, drawerSize, zoneLayoutOptions });
  if (slotSplitAttempt?.accepted) return slotSplitAttempt.adjusted;
  const adjustment_attempts = [...(slotSplitAttempt?.attempts ?? [])] as unknown[];
  const rejected_fallback_candidates = [] as unknown[];
  const candidates = buildAdjustmentCandidates({ fitResult, calculatedZones, layoutRules });
  const originalFailedZoneIds = new Set(fitResult.failed_zones.map((zone) => zone.zone_id));
  const originalFailureSummary = summarizeFailedState(fitResult);

  for (const candidate of candidates) {
    const availableBox = fitResult.available_box;
    if (!candidate.open_fallback_allowed || candidate.alternative_division !== "open" || !availableBox) {
      const rejected = { content_type: candidate.content_type, zone_id: candidate.zone_id, original_failed_zones: originalFailureSummary.failed_zones, original_failed_dimension: originalFailureSummary.failed_dimension, adjusted_zone_was_failed: originalFailedZoneIds.has(candidate.zone_id), reason_rejected: "open fallback not allowed, not alternative, or no available_box", open_fallback_allowed: candidate.open_fallback_allowed, open_fallback_rank: candidate.open_fallback_rank, open_storage_penalty: candidate.open_storage_penalty, capacity_if_open: null, required_count: candidate.count, height_ok: null };
      adjustment_attempts.push({ ...rejected, accepted: false }); rejected_fallback_candidates.push(rejected); continue;
    }
    const openResult = calculateOpenCapacityInBox({ availableBox, unit: { w_cm: candidate.unit_w_cm, d_cm: candidate.unit_d_cm, h_cm: candidate.unit_h_cm }, clearances: { side_clear: candidate.side_clear, fb_clear: candidate.fb_clear, h_clear: candidate.h_clear }, itemGap: candidate.item_gap, itemGapIfOpen: candidate.item_gap_if_open, requiredCount: candidate.count });
    if (!openResult.fits) {
      const rejected = { content_type: candidate.content_type, zone_id: candidate.zone_id, original_failed_zones: originalFailureSummary.failed_zones, original_failed_dimension: originalFailureSummary.failed_dimension, adjusted_zone_was_failed: originalFailedZoneIds.has(candidate.zone_id), capacity_if_open: openResult.capacity, required_count: candidate.count, height_ok: openResult.heightOk, open_fallback_allowed: candidate.open_fallback_allowed, open_fallback_rank: candidate.open_fallback_rank, open_storage_penalty: candidate.open_storage_penalty, reason_rejected: "open capacity or height check failed" };
      adjustment_attempts.push({ ...rejected, accepted: false }); rejected_fallback_candidates.push(rejected); continue;
    }
    const adjusted = applyOpenFallback({ candidate, availableBox, openResult, layoutPlan, calculatedZones });
    const newFit = runFitCheck({ layoutPlan: adjusted.layoutPlan, calculatedZones: adjusted.calculatedZones, drawerSize, enableDepthStackCandidates: false });
    const acceptance = evaluateOpenFallbackAcceptance({ originalFit: fitResult, adjustedFit: newFit, candidate });
    const attempt = { original_failed_zones: originalFailureSummary.failed_zones, original_failed_dimension: originalFailureSummary.failed_dimension, selected_adjustment_candidate: candidate.content_type, selected_adjustment_zone_id: candidate.zone_id, adjusted_zone_was_failed: originalFailedZoneIds.has(candidate.zone_id), new_division_type: "open", available_box: availableBox, open_capacity: openResult.capacity, required_count: candidate.count, reserve_capacity: openResult.reserveCapacity, height_ok: openResult.heightOk, final_failed_zones_after_fallback: summarizeFailedState(newFit).failed_zones, final_failed_dimension_after_fallback: newFit.failed_dimension ?? null, did_failed_zone_improve: acceptance.did_failed_zone_improve, did_failed_dimension_improve: acceptance.did_failed_dimension_improve, did_placed_count_improve: acceptance.did_placed_count_improve, rejected_fallback_candidates, accepted: acceptance.accepted, reason_rejected: acceptance.accepted ? undefined : acceptance.reason_rejected };
    adjustment_attempts.push(attempt);
    if (acceptance.accepted) return { ...adjusted, adjustment_type: "open_fallback", fit_after_adjustment: newFit, adjustment_attempts, rejected_fallback_candidates };
    rejected_fallback_candidates.push(attempt);
  }
  return adjustment_attempts.length ? { calculatedZones, layoutPlan, adjustment_type: "no_adjustment", fit_after_adjustment: fitResult, adjustment_attempts, rejected_fallback_candidates } : null;
}

function trySlotSplitBeforeOpenFallback({ fitResult, calculatedZones, layoutPlan, drawerSize, zoneLayoutOptions }: { fitResult: FitResult; calculatedZones: CalculatedZone[]; layoutPlan: LayoutPlan; drawerSize: DrawerSize; zoneLayoutOptions: ZoneLayoutOptionRow[] }): { accepted: true; attempts: unknown[]; adjusted: AdjustmentResult } | { accepted: false; attempts: unknown[] } | null {
  if (fitResult.failed_dimension !== "depth") return null;
  const attempts = [] as unknown[];
  const splitOption = zoneLayoutOptions.find((option) => option.option_id === "slots_multi_lane_auto" && option.calculation_mode === "linear_depth_split");
  for (const failedZone of fitResult.failed_zones) {
    if (failedZone.division_type !== "slots" || failedZone.calculation_mode !== "linear_depth" || failedZone.zone_d_cm <= drawerSize.d_cm) continue;
    if (!splitOption) { attempts.push({ content_type: failedZone.content_type, split_used: false, original_single_lane_zone: summarizeZone(failedZone), split_rejected_reason: "slots_multi_lane_auto option is missing", accepted: false }); continue; }
    const splitZone = calculateSlotsSplitZone(failedZone, splitOption, drawerSize, failedZone);
    if (!splitZone.split_used) { attempts.push({ content_type: failedZone.content_type, split_used: false, original_single_lane_zone: splitZone.original_single_lane_zone, lanes_needed: splitZone.lanes_needed, max_items_per_lane: splitZone.max_items_per_lane, slot_lane_gap_cm: splitZone.slot_lane_gap_cm, split_rejected_reason: splitZone.split_rejected_reason, accepted: false }); continue; }
    const replace = (zone: CalculatedZone) => zone.zone_id === failedZone.zone_id ? splitZone : zone;
    const nextCalculatedZones = calculatedZones.map(replace);
    const nextLayoutPlan = { ...layoutPlan, selected_zones: layoutPlan.selected_zones.map(replace), placement_order: layoutPlan.selected_zones.map(replace).map((zone) => zone.content_type) };
    const nextFit = runFitCheck({ layoutPlan: nextLayoutPlan, calculatedZones: nextCalculatedZones, drawerSize, enableDepthStackCandidates: false });
    const accepted = splitZone.zone_d_cm < failedZone.zone_d_cm && nextFit.fit_status !== "fit_none";
    attempts.push({ content_type: failedZone.content_type, adjustment_type: "slots_multi_lane", split_used: true, lanes_needed: splitZone.lanes_needed, items_per_lane: splitZone.items_per_lane, max_items_per_lane: splitZone.max_items_per_lane, slot_lane_gap_cm: splitZone.slot_lane_gap_cm, original_single_lane_zone: splitZone.original_single_lane_zone, split_lane_zone: splitZone.split_lane_zone, final_failed_dimension_after_split: nextFit.failed_dimension, accepted });
    if (accepted) return { accepted: true, attempts, adjusted: { calculatedZones: nextCalculatedZones, layoutPlan: nextLayoutPlan, splitZone, adjustment_type: "slots_multi_lane", fit_after_adjustment: nextFit, adjustment_attempts: attempts } };
  }
  return { accepted: false, attempts };
}

function evaluateOpenFallbackAcceptance({ originalFit, adjustedFit, candidate }: { originalFit: FitResult; adjustedFit: FitResult; candidate: CalculatedZone }) {
  const candidateWasFailed = originalFit.failed_zones.some((zone) => zone.zone_id === candidate.zone_id);
  const candidateStillFailed = adjustedFit.failed_zones.some((zone) => zone.zone_id === candidate.zone_id);
  const did_failed_zone_improve = candidateWasFailed && !candidateStillFailed;
  const did_failed_dimension_improve = didFailedDimensionImprove(originalFit, adjustedFit);
  const did_placed_count_improve = adjustedFit.best_attempt.placed_count > originalFit.best_attempt.placed_count;
  const accepted = candidateWasFailed && adjustedFit.fit_status !== "fit_none" && (adjustedFit.fit_status === "fit_all" || did_failed_zone_improve || did_failed_dimension_improve || did_placed_count_improve);
  return { accepted, did_failed_zone_improve, did_failed_dimension_improve, did_placed_count_improve, reason_rejected: accepted ? undefined : candidateWasFailed ? "open fallback did not improve original failed zone, failed dimension, or placed count" : "unrelated open fallback is not allowed" };
}

function didFailedDimensionImprove(originalFit: FitResult, adjustedFit: FitResult) {
  if (!originalFit.failed_dimension) return false;
  return dimensionOverflow(adjustedFit, originalFit.failed_dimension) < dimensionOverflow(originalFit, originalFit.failed_dimension);
}

function dimensionOverflow(fit: FitResult, dimension: FailedDimension) {
  if (dimension === "height") return fit.overflow_height_cm || fit.missing_height_cm;
  if (dimension === "width") return fit.overflow_width_cm || fit.missing_width_cm;
  return fit.overflow_depth_cm || fit.missing_depth_cm;
}

function summarizeFailedState(fit: FitResult) { return { failed_dimension: fit.failed_dimension ?? null, failed_zones: fit.failed_zones.map((zone) => ({ zone_id: zone.zone_id, content_type: zone.content_type, division_type: zone.division_type, option_id: zone.option_id, zone_w_cm: zone.zone_w_cm, zone_d_cm: zone.zone_d_cm, zone_h_cm: zone.zone_h_cm })) }; }
function summarizeZone(zone: CalculatedZone) { return { zone_id: zone.zone_id, zone_w_cm: zone.zone_w_cm, zone_d_cm: zone.zone_d_cm, zone_h_cm: zone.zone_h_cm, capacity: zone.capacity }; }
