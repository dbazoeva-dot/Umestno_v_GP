import { runAdjustmentLoop } from "../adjustment/runAdjustmentLoop.js";
import { volumeToCount } from "../count/volumeToCount.js";
import { buildDebugTrace } from "../debug/buildDebugTrace.js";
import { runFitCheck } from "../fit/runFitCheck.js";
import { evaluatePlacementRules } from "../rules/evaluatePlacementRules.js";
import { normalizeInput } from "../input/normalizeInput.js";
import { validateInput } from "../input/validateInput.js";
import { buildLayoutPlan } from "../layout/buildLayoutPlan.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
import { buildStorageRequirements } from "../requirements/buildStorageRequirements.js";
import { buildFinalResultPayload } from "../result/buildFinalResultPayload.js";
import { buildSchemePayload } from "../scheme/buildSchemePayload.js";
import { matchSkus } from "../sku/matchSkus.js";
import { runSkuFitCheck } from "../sku/runSkuFitCheck.js";
import type { UserInput } from "../types.js";
import { generateCalculatedZones } from "../zones/generateCalculatedZones.js";

export const baseCalibrationInput: UserInput = { drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", item_1_content_type: "socks_regular", item_1_volume_level: "medium", item_2_content_type: "bras", item_2_volume_level: "medium", item_3_content_type: "panties", item_3_volume_level: "medium", priority: "convenient", color_preference: "not_important" };
export const forcedOpenFallbackCalibrationInput: UserInput = { drawer_width_cm: 75, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", item_1_content_type: "bras", item_1_volume_level: "medium", item_2_content_type: "socks_regular", item_2_volume_level: "medium", item_3_content_type: "panties", item_3_volume_level: "medium", priority: "convenient", color_preference: "not_important" };
export const fourItemStressCalibrationInput: UserInput = { drawer_width_cm: 150, drawer_depth_cm: 40, drawer_height_cm: 20, storage_category: "underwear", items: [ { content_type: "panties", volume_level: "large" }, { content_type: "bras", volume_level: "large" }, { content_type: "socks_regular", volume_level: "large" }, { content_type: "tights", volume_level: "medium" } ], priority: "convenient", color_preference: "not_important" };

export function buildCalibrationCaseReport({ input, schemeId, maxItemsOverride }: { input: UserInput; schemeId: string; maxItemsOverride?: number }) {
  const normalizedInput = normalizeInput(input, maxItemsOverride ? { maxItems: maxItemsOverride } : undefined);
  const validation = validateInput(normalizedInput);
  const countedItems = volumeToCount(normalizedInput.items, defaultLibraries.volumeToCount);
  const storageRequirements = buildStorageRequirements({ countedItems, storageUnitProfile: defaultLibraries.storageUnitProfile, zoneLayoutOptions: defaultLibraries.zoneLayoutOptions });
  const calculatedZones = generateCalculatedZones(storageRequirements);
  const layoutPlan = buildLayoutPlan({ calculatedZones, drawerSize: normalizedInput.drawerSize, priority: normalizedInput.priority, layoutRules: defaultLibraries.layoutRules });
  const initialFitResult = runFitCheck({ layoutPlan, calculatedZones, drawerSize: normalizedInput.drawerSize });
  const adjustmentResult = initialFitResult.fit_status !== "fit_all" ? runAdjustmentLoop({ fitResult: initialFitResult, calculatedZones, layoutPlan, drawerSize: normalizedInput.drawerSize, zoneLayoutOptions: defaultLibraries.zoneLayoutOptions, layoutRules: defaultLibraries.layoutRules }) : null;
  const finalFitResult = adjustmentResult?.fit_after_adjustment ?? initialFitResult;
  const finalCalculatedZones = adjustmentResult?.calculatedZones ?? calculatedZones;
  const finalLayoutPlan = adjustmentResult?.layoutPlan ?? layoutPlan;
  const layoutRuleEvaluations = evaluatePlacementRules({ drawerSize: normalizedInput.drawerSize, fitResult: finalFitResult, definitions: defaultLibraries.ruleDefinitions });
  const schemePayload = buildSchemePayload({ input: normalizedInput, countedItems, storageRequirements, calculatedZones: finalCalculatedZones, layoutPlan: finalLayoutPlan, fitResult: finalFitResult, adjustment: adjustmentResult, validation, layoutRuleEvaluations });
  schemePayload.scheme_id = schemeId;
  const skuMatches = matchSkus({ schemePayload, skuCatalog: defaultLibraries.skuCatalog, colorPreference: normalizedInput.colorPreference });
  const skuFitResult = runSkuFitCheck({ schemePayload, skuMatches, drawerSize: normalizedInput.drawerSize });
  const finalResult = buildFinalResultPayload({ schemePayload, skuMatches, skuFitResult });
  const debugTrace = buildDebugTrace({ input: normalizedInput, validation_result: validation, counted_items: countedItems, storage_requirements: storageRequirements, generated_calculated_zones: calculatedZones, selected_layout_plan: layoutPlan, initial_fit_result: initialFitResult, adjustment_result: adjustmentResult, final_fit_result: finalFitResult, assigned_zones: finalFitResult.placed_zones.map(toAssignedZoneSummary), layout_rule_evaluations: layoutRuleEvaluations, scheme_payload: schemePayload, sku_matching_result: skuMatches, sku_fit_result: skuFitResult, final_result_payload: finalResult });
  const openFallbackZone = finalCalculatedZones.find((zone) => zone.division_type === "open" && zone.calculation_mode === "open_capacity_in_box");
  const openFallbackSummary = { final_fit_status: finalFitResult.fit_status, open_fallback_used: Boolean(openFallbackZone), selected_open_fallback_category: openFallbackZone?.content_type ?? null, available_box_used_for_open_fallback: adjustmentResult && "openZone" in adjustmentResult ? initialFitResult.available_box ?? null : null, open_capacity: openFallbackZone?.open_capacity ?? null, required_count: openFallbackZone?.count ?? null, converted_open_categories: finalCalculatedZones.filter((zone) => zone.division_type === "open" && zone.calculation_mode === "open_capacity_in_box").map((zone) => zone.content_type) };
  return { validation_result: validation, counted_items: countedItems, storage_requirements: storageRequirements, calculated_zones: calculatedZones, initial_fit_result: initialFitResult, adjustment_result: adjustmentResult, final_fit_result: finalFitResult, assigned_zones: finalFitResult.placed_zones.map(toAssignedZoneSummary), layout_rule_evaluations: layoutRuleEvaluations, scheme_payload: schemePayload, debug_trace: debugTrace, separate_summary: { final_fit_status: finalFitResult.fit_status, selected_zones: finalLayoutPlan.selected_zones.map((zone) => ({ zone_id: zone.zone_id, content_type: zone.content_type, division_type: zone.division_type, option_id: zone.option_id, calculation_mode: zone.calculation_mode, zone_w_cm: zone.zone_w_cm, zone_d_cm: zone.zone_d_cm, zone_h_cm: zone.zone_h_cm, capacity: zone.capacity, required_count: zone.count })), assigned_zones: finalFitResult.placed_zones.map(toAssignedZoneSummary), open_fallback_used: openFallbackSummary.open_fallback_used, selected_open_fallback_category: openFallbackSummary.selected_open_fallback_category, available_box_used_for_open_fallback: openFallbackSummary.available_box_used_for_open_fallback, open_capacity: openFallbackSummary.open_capacity, required_count: openFallbackSummary.required_count }, open_fallback_summary: openFallbackSummary };
}
export function buildBaseCalibrationCaseReport(input: UserInput = baseCalibrationInput) { return buildCalibrationCaseReport({ input, schemeId: "scheme_90x45_base_calibration" }); }
export function buildForcedOpenFallbackCalibrationCaseReport(input: UserInput = forcedOpenFallbackCalibrationInput) { return buildCalibrationCaseReport({ input, schemeId: "scheme_75x45_forced_open_fallback" }); }
export function buildFourItemStressCalibrationCaseReport(input: UserInput = fourItemStressCalibrationInput) {
  const productionValidationResult = validateInput(normalizeInput(input));
  return { production_validation_result: productionValidationResult, calibration_stress_result: buildCalibrationCaseReport({ input, schemeId: "scheme_150x40_four_item_stress" }) };
}
function toAssignedZoneSummary(zone: { zone_id: string; content_type: string; division_type: string; x_cm: number; y_cm: number; assigned_w_cm: number; assigned_d_cm: number; assigned_h_cm: number }) { return { zone_id: zone.zone_id, content_type: zone.content_type, division_type: zone.division_type, x_cm: zone.x_cm, y_cm: zone.y_cm, assigned_w_cm: zone.assigned_w_cm, assigned_d_cm: zone.assigned_d_cm, assigned_h_cm: zone.assigned_h_cm }; }
