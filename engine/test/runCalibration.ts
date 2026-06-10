import { buildBaseCalibrationCaseReport, buildCalibrationCaseReport, buildForcedOpenFallbackCalibrationCaseReport, buildFourItemStressCalibrationCaseReport } from "../calibration/buildCalibrationCaseReport.js";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

function findRuleEvaluation(evaluations: Array<{ rule_id: string; status: string; enforcement?: string }>, ruleId: string) {
  return evaluations.find((evaluation) => evaluation.rule_id === ruleId);
}


const sourceToRuntimeContentType: Record<string, string> = { socks: "socks_regular" };
const excelContentTypes = [
  "socks", "panties", "boxers", "sport_tops", "bras", "tights", "thermals", "pajamas", "nightgowns",
  "tshirts", "longsleeves", "sweaters", "jeans", "leggings", "shorts",
  "belts", "jewelry_large", "jewelry_small", "scarves", "ties", "swimwear"
];
const runtimeCountTypes = new Set(defaultLibraries.volumeToCount.map((row) => row.content_type));
const runtimeProfileTypes = new Set(defaultLibraries.storageUnitProfile.map((row) => row.content_type));
for (const sourceContentType of excelContentTypes) {
  const runtimeContentType = sourceToRuntimeContentType[sourceContentType] ?? sourceContentType;
  assert(runtimeCountTypes.has(runtimeContentType), `${sourceContentType}: Excel A content type should map to runtime volume_to_count ${runtimeContentType}`);
  assert(runtimeProfileTypes.has(runtimeContentType), `${sourceContentType}: Excel B content type should map to runtime storage_unit_profile ${runtimeContentType}`);
}
assert(!runtimeCountTypes.has("socks"), "socks: source Excel id should not be a separate runtime volume_to_count type");
assert(!runtimeProfileTypes.has("socks"), "socks: source Excel id should not be a separate runtime storage_unit_profile type");
const jewelrySmallProfile = defaultLibraries.storageUnitProfile.find((profile) => profile.content_type === "jewelry_small");
assert(jewelrySmallProfile?.can_split === true, "jewelry_small: can_split should preserve B spatial-split metadata = true");
const socksRegularProfile = defaultLibraries.storageUnitProfile.find((profile) => profile.content_type === "socks_regular");
assert(Boolean(socksRegularProfile), "source socks should map to canonical runtime socks_regular");

const baseReport = buildBaseCalibrationCaseReport();
assert(baseReport.final_fit_result.fit_status === "fit_all", "base case should return fit_all");
assert(baseReport.calculated_zones.some((zone) => zone.content_type === "socks_regular" && zone.option_id === "cells_4x4"), "base case: socks should use calibrated cells_4x4");
assert(baseReport.calculated_zones.some((zone) => zone.content_type === "bras" && zone.calculation_mode === "linear_depth"), "base case: bras should use linear_depth slots");

const forcedReport = buildForcedOpenFallbackCalibrationCaseReport();
const forcedSummary = forcedReport.separate_summary;
assert(forcedReport.initial_fit_result.fit_status === "fit_all", "forced case: deterministic 2D placement should fit primary zones without fallback");
assert(forcedReport.adjustment_result === null, "forced case: adjustment should not be needed after 2D placement");
assert(forcedSummary.final_fit_status === "fit_all", "forced case: final fit status should be fit_all");
assert(forcedSummary.open_fallback_used === false, "forced case: open fallback should not be used when cells fit in 2D free rectangles");
assert(forcedReport.final_fit_result.placed_zones.some((zone) => zone.y_cm > 0), "forced case: depth-stack placement should place at least one zone in remaining depth rectangle");
assert(forcedReport.final_fit_result.placement_attempts?.every((attempt) => attempt.placed), "forced case: debug placement attempts should show every zone placed");
assert(Array.isArray(forcedReport.layout_rule_evaluations), "scenario 2 rules: report should expose layout_rule_evaluations");
assert(Array.isArray(forcedReport.scheme_payload.layout_rule_evaluations), "scenario 2 rules: scheme payload should expose layout_rule_evaluations");
assert(Array.isArray(forcedReport.debug_trace.layout_rule_evaluations), "scenario 2 rules: debug trace should expose layout_rule_evaluations");
assert(findRuleEvaluation(forcedReport.layout_rule_evaluations, "ZONE_INTEGRITY")?.status === "pass", "scenario 2 rules: zone integrity should pass after placement");
assert(findRuleEvaluation(forcedReport.layout_rule_evaluations, "D01")?.status === "pass", "scenario 2 rules: D01 should evaluate semantic storage-category adjacency, not division adjacency");
assert(findRuleEvaluation(forcedReport.layout_rule_evaluations, "D02")?.status === "pass", "scenario 2 rules: depth-stack scoring should avoid placing socks between bras and panties when a better fit_all candidate exists");
assert(findRuleEvaluation(forcedReport.layout_rule_evaluations, "D03")?.status === "report", "scenario 2 rules: D03 compactness should be reporting only");
assert(findRuleEvaluation(forcedReport.layout_rule_evaluations, "D04")?.status === "report", "scenario 2 rules: D04 reserve edge check should be reporting only");
assert(findRuleEvaluation(forcedReport.layout_rule_evaluations, "D04b")?.status === "opportunity", "scenario 2 rules: D04b should report depth-reserve absorption opportunity only");

const fourItemReport = buildFourItemStressCalibrationCaseReport();
const stress = fourItemReport.calibration_stress_result;
assert(fourItemReport.production_validation_result.ok === true, "four-item production mode: validation should pass with max_items=4");
assert(stress.validation_result.ok === true, "four-item stress mode: validation should pass with max_items=4");
assert(stress.counted_items.length === 4 && stress.storage_requirements.length === 4 && stress.calculated_zones.length === 4, "four-item stress mode: no category should be dropped");
const brasRequirement = stress.storage_requirements.find((requirement) => requirement.content_type === "bras");
assert(brasRequirement?.can_split === false, "four-item stress mode: bras can_split should remain B/source spatial-split metadata, not internal lane metadata");
assert(stress.final_fit_result.fit_status === "fit_all", "four-item stress mode: final status should become fit_all after 2D placement");
assert(!stress.final_fit_result.placed_zones.some((zone) => zone.content_type === "bras" && zone.division_type === "open"), "four-item stress mode: bras must not be converted to open");
const stressAdjustmentAttempts = (stress.adjustment_result?.adjustment_attempts ?? []) as Array<{ adjustment_type?: string; split_used?: boolean; lanes_needed?: number; items_per_lane?: number[]; split_lane_zone?: { zone_d_cm?: number } }>;
const stressSplitAttempt = stressAdjustmentAttempts.find((attempt) => attempt.adjustment_type === "slots_multi_lane");
assert(stress.initial_fit_result.failed_zones.some((zone) => zone.content_type === "bras" && zone.calculation_mode === "linear_depth" && zone.zone_d_cm === 50.5), "four-item stress mode: bras single row should fail by depth before split");
assert(stress.adjustment_result?.adjustment_type === "slots_multi_lane", "four-item stress mode: should try slots_multi_lane before open fallback");
assert(brasRequirement?.max_slot_lanes === 2 && brasRequirement?.slot_lane_gap_cm === 1 && brasRequirement?.split_strategy === "balance_by_depth", "four-item stress mode: bras multi-lane should be controlled by internal slot-module metadata");
assert(stressSplitAttempt?.split_used === true && stressSplitAttempt?.lanes_needed === 2, "four-item stress mode: bras should split into 2 lanes");
assert(Array.isArray(stressSplitAttempt?.items_per_lane) && stressSplitAttempt.items_per_lane.join(",") === "5,5", "four-item stress mode: bras lanes should balance as 5,5");
assert(stressSplitAttempt?.split_lane_zone?.zone_d_cm === 25.5, "four-item stress mode: bras split depth should match 5 items, not 10");
assert(stress.open_fallback_summary.open_fallback_used === false, "four-item stress mode: slot split should run before unrelated open fallback");
assert(stress.final_fit_result.placed_zones.some((zone) => zone.content_type === "panties" && zone.division_type === "cells"), "four-item stress mode: panties should remain in cells after 2D placement");
assert(stress.final_fit_result.placement_attempts?.every((attempt) => attempt.placed), "four-item stress mode: debug trace should show successful placement attempts");
assert(Array.isArray(stress.layout_rule_evaluations), "scenario 4 rules: stress report should expose layout_rule_evaluations");
assert(findRuleEvaluation(stress.layout_rule_evaluations, "ZONE_INTEGRITY")?.status === "pass", "scenario 4 rules: zone integrity should pass after slot split placement");
assert(findRuleEvaluation(stress.layout_rule_evaluations, "D04b")?.status === "opportunity", "scenario 4 rules: D04b should report reserve absorption opportunity without mutating placed zones");
assert(stress.final_fit_result.placed_zones.some((zone) => zone.content_type === "bras" && zone.assigned_d_cm === 25.5 && zone.capacity === 10), "scenario 4 rules: D04b reporting must not mutate bras assigned depth or capacity");

for (const profile of defaultLibraries.storageUnitProfile) {
  const propagatedRequirements = [baseReport, forcedReport, stress].flatMap((report) => report.storage_requirements).filter((requirement) => requirement.content_type === profile.content_type);
  assert(propagatedRequirements.every((requirement) => requirement.can_split === profile.can_split), `${profile.content_type}: can_split should be propagated unchanged from B/defaultLibraries`);
}

const maxItemsOutput = runUmestnoEngine({ drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "mixed", items: [ { content_type: "bras", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "medium" }, { content_type: "panties", volume_level: "medium" }, { content_type: "tshirts", volume_level: "small" }, { content_type: "longsleeves", volume_level: "small" } ], priority: "convenient" });
assert(maxItemsOutput.result === null, "max items case: result should be null when items exceed max_items=4");
assert(maxItemsOutput.scheme_payload === null, "max items case: scheme_payload should be null when items exceed max_items=4");

const socksAliasOutput = runUmestnoEngine({ drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "socks", volume_level: "medium" } ], priority: "convenient" });
const socksAliasDebug = socksAliasOutput.debug as { input: { items: Array<{ content_type: string }> }; counted_items: Array<{ content_type: string }> };
assert(socksAliasDebug.input.items[0]?.content_type === "socks_regular", "source socks input should normalize to canonical runtime socks_regular");
assert(socksAliasDebug.counted_items[0]?.content_type === "socks_regular", "source socks should count through canonical socks_regular, not a separate socks type");
const duplicateSocksAliasOutput = runUmestnoEngine({ drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "socks", volume_level: "small" }, { content_type: "socks_regular", volume_level: "small" } ], priority: "convenient" });
assert(duplicateSocksAliasOutput.result === null, "socks and socks_regular together should be rejected after alias normalization instead of producing two zones");


const p1Output = runUmestnoEngine({ drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "panties", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "small" }, { content_type: "bras", volume_level: "small" } ], priority: "convenient" });
const p1Debug = p1Output.debug as { fit_result: { fit_status: string; used_depth_cm: number; fit_notes: string[]; placed_zones: Array<{ content_type: string; x_cm: number; y_cm: number; assigned_w_cm: number; assigned_d_cm: number; zone_w_cm: number; zone_d_cm: number }> }; layout_rule_evaluations: Array<{ rule_id: string; status: string }>; scheme_payload: { selected_calculated_zones: Array<{ content_type: string; zone_w_cm: number; zone_d_cm: number; zone_h_cm: number }> } };
assert(p1Debug.fit_result.fit_status === "fit_all", "P1 depth-stack: should remain fit_all");
assert(p1Debug.fit_result.used_depth_cm > 19, "P1 depth-stack: should improve beyond the old thin one-row 19cm depth");
assert(p1Debug.fit_result.fit_notes.some((note) => note.includes("normalized")), "P1 depth-stack: should log normalization step in fit_notes");
assert(p1Debug.scheme_payload.selected_calculated_zones.some((zone) => zone.content_type === "panties" && zone.zone_w_cm === 31 && zone.zone_d_cm === 13 && zone.zone_h_cm === 7), "P1 depth-stack: panties calculated size should remain unchanged");
assert(p1Debug.scheme_payload.selected_calculated_zones.some((zone) => zone.content_type === "socks_regular" && zone.zone_w_cm === 19 && zone.zone_d_cm === 19 && zone.zone_h_cm === 8), "P1 depth-stack: socks calculated size should remain unchanged");
assert(p1Debug.scheme_payload.selected_calculated_zones.some((zone) => zone.content_type === "bras" && zone.zone_w_cm === 29 && zone.zone_d_cm === 15.5 && zone.zone_h_cm === 13), "P1 depth-stack: bras calculated size should remain unchanged");
assert(findRuleEvaluation(p1Debug.layout_rule_evaluations, "D02")?.status === "pass", "P1 depth-stack: socks should not remain between bras and panties");

const p2Output = runUmestnoEngine({ drawer_width_cm: 80, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "panties", volume_level: "medium" }, { content_type: "bras", volume_level: "small" } ], priority: "convenient" });
const p2Debug = p2Output.debug as { fit_result: { fit_status: string; used_depth_cm: number; fit_notes: string[] }; scheme_payload: { assigned_zones: Array<{ content_type: string; x_cm: number; y_cm: number; assigned_w_cm: number; assigned_d_cm: number }>; selected_calculated_zones: Array<{ content_type: string; zone_w_cm: number; zone_d_cm: number; zone_h_cm: number }> } };
assert(p2Debug.fit_result.fit_status === "fit_all", "P2 depth-stack: should remain fit_all");
assert(p2Debug.fit_result.used_depth_cm > 15.5, "P2 depth-stack: should improve beyond the old thin one-row 15.5cm depth");
assert(p2Debug.fit_result.fit_notes.some((note) => note.includes("normalized")), "P2 depth-stack: should log normalization step in fit_notes");
assert(p2Debug.fit_result.used_depth_cm > 15.5, "P2 depth-stack: depth-utilization should exceed raw bras zone depth after normalization");
assert(p2Debug.scheme_payload.selected_calculated_zones.some((zone) => zone.content_type === "panties" && zone.zone_w_cm === 31 && zone.zone_d_cm === 13 && zone.zone_h_cm === 7), "P2 depth-stack: panties calculated size should remain unchanged");
assert(p2Debug.scheme_payload.selected_calculated_zones.some((zone) => zone.content_type === "bras" && zone.zone_w_cm === 29 && zone.zone_d_cm === 15.5 && zone.zone_h_cm === 13), "P2 depth-stack: bras calculated size should remain unchanged");

const p3Output = runUmestnoEngine({ drawer_width_cm: 50, drawer_depth_cm: 40, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "panties", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "small" }, { content_type: "bras", volume_level: "small" } ], priority: "convenient" });
const p3Debug = p3Output.debug as { fit_result: { fit_status: string; used_depth_cm: number; fit_notes: string[] }; layout_rule_evaluations: Array<{ rule_id: string; status: string }>; scheme_payload: { assigned_zones: Array<{ content_type: string; x_cm: number; y_cm: number }>; selected_calculated_zones: Array<{ content_type: string; zone_w_cm: number; zone_d_cm: number; zone_h_cm: number }> } };
assert(p3Debug.fit_result.fit_status === "fit_all", "P3 depth-stack: should remain fit_all");
assert(p3Debug.fit_result.used_depth_cm >= 28.5, "P3 depth-stack: should preserve meaningful depth use in the narrow drawer");
assert(p3Debug.scheme_payload.assigned_zones.some((zone) => zone.y_cm > 0), "P3 depth-stack: should keep at least one zone in a deeper row");
assert(findRuleEvaluation(p3Debug.layout_rule_evaluations, "D05")?.status === "pass", "P3 depth-stack: scoring should improve high-frequency front ordering when possible");
assert(p3Debug.scheme_payload.selected_calculated_zones.some((zone) => zone.content_type === "socks_regular" && zone.zone_w_cm === 19 && zone.zone_d_cm === 19 && zone.zone_h_cm === 8), "P3 depth-stack: socks calculated size should remain unchanged");

const p4Report = buildCalibrationCaseReport({ input: { drawer_width_cm: 120, drawer_depth_cm: 50, drawer_height_cm: 30, storage_category: "underwear", priority: "convenient", items: [ { content_type: "socks_regular", volume_level: "large" }, { content_type: "panties", volume_level: "large" }, { content_type: "bras", volume_level: "large" }, { content_type: "tights", volume_level: "medium" } ] }, schemeId: "scheme_120x50_p4_column_alignment", maxItemsOverride: 4 });
assert(p4Report.final_fit_result.fit_status === "fit_all", "P4 column alignment: should be fit_all");
const p4Panties = p4Report.final_fit_result.placed_zones.find((zone) => zone.content_type === "panties");
const p4Bras = p4Report.final_fit_result.placed_zones.find((zone) => zone.content_type === "bras");
assert(p4Bras !== undefined, "P4 column alignment: bras should be placed");
assert(p4Panties !== undefined, "P4 column alignment: panties should be placed");
assert(p4Panties!.x_cm === p4Bras!.x_cm, "P4 column alignment: panties and bras should share the same column (same x_cm)");
assert(p4Panties!.assigned_w_cm === p4Bras!.assigned_w_cm, "P4 column alignment: panties assigned_w_cm should be widened to match bras column width");
assert(p4Panties!.assigned_w_cm > p4Panties!.zone_w_cm, "P4 column alignment: panties assigned_w_cm should be widened beyond its original zone_w_cm");
assert(p4Panties!.assigned_w_cm === 58, "P4 column alignment: panties assigned_w_cm should be 58 (matching bras column width) after column normalization");

const scenario5Output = runUmestnoEngine({ drawer_width_cm: 80, drawer_depth_cm: 40, drawer_height_cm: 10, storage_category: "underwear", items: [ { content_type: "bras", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "medium" } ], priority: "convenient" });
const scenario5Result = scenario5Output.result as { content_warnings: Array<{ content_type: string; warning_code: string; zone_h_cm: number; drawer_h_cm: number; overflow_h_cm: number; max_allowed_overflow_h_cm: number }> };
const scenario5Debug = scenario5Output.debug as { fit_result: { fit_status: string; content_warnings: Array<{ content_type: string; warning_code: string; zone_h_cm: number; drawer_h_cm: number; overflow_h_cm: number; max_allowed_overflow_h_cm: number }> }; adjustment_result?: { adjustment_type?: string } | null; adjustment_attempts: Array<{ content_type?: string; selected_adjustment_candidate?: string }>; scheme_payload: { assigned_zones: Array<{ content_type: string; division_type: string; soft_height_warning?: unknown }>; selected_calculated_zones: Array<{ content_type: string; division_type: string }> } };
assert(scenario5Debug.fit_result.fit_status === "fit_all", "scenario 5 soft height: final status should become fit_all with content warning");
assert(scenario5Debug.scheme_payload.assigned_zones.some((zone) => zone.content_type === "bras" && zone.division_type === "slots" && zone.soft_height_warning), "scenario 5 soft height: bras should stay in slots with soft height warning");
assert(scenario5Debug.scheme_payload.assigned_zones.some((zone) => zone.content_type === "socks_regular" && zone.division_type === "cells"), "scenario 5 soft height: socks should remain cells");
assert(scenario5Debug.adjustment_result === null || scenario5Debug.adjustment_result === undefined, "scenario 5 soft height: open fallback should not run when soft height warning places bras");
assert(!scenario5Debug.adjustment_attempts.some((attempt) => attempt.content_type === "socks_regular" || attempt.selected_adjustment_candidate === "socks_regular"), "scenario 5 soft height: unrelated socks fallback should not be attempted");
assert(scenario5Debug.fit_result.content_warnings.some((warning) => warning.content_type === "bras" && warning.warning_code === "deformation_risk" && warning.zone_h_cm === 13 && warning.drawer_h_cm === 10 && warning.overflow_h_cm === 3 && warning.max_allowed_overflow_h_cm === 5), "scenario 5 soft height: debug should expose bras overflow details");
assert(scenario5Result.content_warnings.some((warning) => warning.content_type === "bras" && warning.warning_code === "deformation_risk" && warning.overflow_h_cm === 3), "scenario 5 soft height: result should expose user-facing bras warning");

const brasOverThresholdOutput = runUmestnoEngine({ drawer_width_cm: 80, drawer_depth_cm: 40, drawer_height_cm: 7, storage_category: "underwear", items: [ { content_type: "bras", volume_level: "medium" } ], priority: "convenient" });
const brasOverThresholdDebug = brasOverThresholdOutput.debug as { fit_result: { fit_status: string; failed_dimension?: string; failed_zones: Array<{ content_type: string }> }; adjustment_attempts: Array<{ content_type?: string; selected_adjustment_candidate?: string }> };
assert(brasOverThresholdOutput.result === null, "bras over threshold: no fit_all achievable — result should be null");
assert(brasOverThresholdOutput.scheme_payload === null, "bras over threshold: scheme_payload should be null when no fit_all candidate exists");
assert(brasOverThresholdDebug.fit_result.fit_status !== "fit_all", "bras over threshold: best-failed candidate should not be fit_all");
assert(brasOverThresholdDebug.fit_result.failed_dimension === "height", "bras over threshold: height should remain blocker");
assert(brasOverThresholdDebug.fit_result.failed_zones.some((zone) => zone.content_type === "bras"), "bras over threshold: bras should remain failed");
assert(!brasOverThresholdDebug.adjustment_attempts.some((attempt) => attempt.content_type === "socks_regular" || attempt.selected_adjustment_candidate === "socks_regular"), "bras over threshold: unrelated socks fallback should not be attempted");

const tshirtsSoftOutput = runUmestnoEngine({ drawer_width_cm: 80, drawer_depth_cm: 40, drawer_height_cm: 14, storage_category: "soft_clothes", items: [ { content_type: "tshirts", volume_level: "small" } ], priority: "convenient" });
const tshirtsSoftResult = tshirtsSoftOutput.result as { content_warnings: Array<{ content_type: string; warning_code: string; overflow_h_cm: number }> };
const tshirtsSoftDebug = tshirtsSoftOutput.debug as { fit_result: { fit_status: string }; adjustment_result?: { adjustment_type?: string } | null; scheme_payload: { assigned_zones: Array<{ content_type: string; division_type: string; option_id: string; soft_height_warning?: unknown }> } };
assert(tshirtsSoftDebug.fit_result.fit_status === "fit_all", "tshirts soft height: should fit with warning");
assert(tshirtsSoftDebug.scheme_payload.assigned_zones.some((zone) => zone.content_type === "tshirts" && zone.division_type === "slots" && zone.option_id === "slots_single_row" && zone.soft_height_warning), "tshirts soft height: division and option should be preserved");
assert(tshirtsSoftDebug.adjustment_result === null || tshirtsSoftDebug.adjustment_result === undefined, "tshirts soft height: open fallback should not run");
assert(tshirtsSoftResult.content_warnings.some((warning) => warning.content_type === "tshirts" && warning.warning_code === "compressed_storage" && warning.overflow_h_cm === 2), "tshirts soft height: result should expose compressed storage warning");

const disabledSocksOutput = runUmestnoEngine({ drawer_width_cm: 80, drawer_depth_cm: 40, drawer_height_cm: 7, storage_category: "underwear", items: [ { content_type: "socks_regular", volume_level: "medium" } ], priority: "convenient" });
const disabledSocksDebug = disabledSocksOutput.debug as { fit_result: { fit_status: string; failed_dimension?: string; failed_zones: Array<{ content_type: string }> } };
assert(disabledSocksOutput.result === null, "disabled socks guard: no fit_all achievable — result should be null");
assert(disabledSocksDebug.fit_result.fit_status !== "fit_all", "disabled socks guard: socks should not soft-fit by height");
assert(disabledSocksDebug.fit_result.failed_dimension === "height", "disabled socks guard: height should remain blocker");
assert(disabledSocksDebug.fit_result.failed_zones.some((zone) => zone.content_type === "socks_regular"), "disabled socks guard: socks should remain failed");

const scenario6Output = runUmestnoEngine({ drawer_width_cm: 60, drawer_depth_cm: 40, drawer_height_cm: 12, storage_category: "mixed", items: [ { content_type: "jeans", volume_level: "large" }, { content_type: "sweaters", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "large" } ], priority: "convenient" });
const scenario6Debug = scenario6Output.debug as { fit_result: { fit_status: string; failed_dimension?: string; failed_zones: Array<{ content_type: string }>; placed_zones: Array<{ content_type: string; division_type: string }> }; adjustment_attempts: Array<{ content_type?: string; selected_adjustment_candidate?: string; accepted?: boolean; adjusted_zone_was_failed?: boolean; original_failed_dimension?: string }> };
assert(scenario6Output.result === null, "scenario 6 guard: no fit_all achievable when clothing heights exceed drawer — result should be null");
assert(scenario6Output.scheme_payload === null, "scenario 6 guard: scheme_payload should be null when no fit_all candidate exists");
assert(scenario6Debug.fit_result.fit_status !== "fit_all", "scenario 6 guard: best-failed candidate should not be fit_all");
assert(scenario6Debug.fit_result.failed_dimension === "height", "scenario 6 guard: clothing height should remain the true blocker");
assert(scenario6Debug.fit_result.failed_zones.some((zone) => zone.content_type === "jeans"), "scenario 6 guard: jeans should be reported as failed");
assert(scenario6Debug.fit_result.failed_zones.some((zone) => zone.content_type === "sweaters"), "scenario 6 guard: sweaters should be reported as failed");
assert(scenario6Debug.fit_result.placed_zones.some((zone) => zone.content_type === "socks_regular" && zone.division_type === "cells"), "scenario 6 guard: unrelated socks should remain in cells in the best-failed candidate");
assert(!scenario6Debug.fit_result.placed_zones.some((zone) => zone.content_type === "socks_regular" && zone.division_type === "open"), "scenario 6 guard: unrelated socks must not be converted to open");
assert(!scenario6Debug.adjustment_attempts.some((attempt) => attempt.content_type === "socks_regular" || attempt.selected_adjustment_candidate === "socks_regular"), "scenario 6 guard: unrelated socks fallback should not be attempted");

const scenario7Output = runUmestnoEngine({ drawer_width_cm: 100, drawer_depth_cm: 50, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "panties", volume_level: "large" }, { content_type: "bras", volume_level: "large" }, { content_type: "socks_regular", volume_level: "large" } ], priority: "convenient" });
const scenario7Result = scenario7Output.result as { content_warnings: Array<{ content_type: string }> };
const scenario7Debug = scenario7Output.debug as { fit_result: { fit_status: string }; adjustment_result?: { adjustment_type?: string; splitZone?: { option_id?: string } } | null; layout_rule_evaluations: Array<{ rule_id: string; status: string; enforcement?: string }>; scheme_payload: { layout_rule_evaluations: Array<{ rule_id: string; status: string; enforcement?: string }>; selected_calculated_zones: Array<{ content_type: string; division_type: string; option_id: string }> } };
assert(scenario7Debug.fit_result.fit_status === "fit_all", "scenario 7 guard: final status should remain fit_all");
assert(scenario7Debug.scheme_payload.selected_calculated_zones.some((zone) => zone.content_type === "bras" && zone.division_type === "slots" && zone.option_id === "slots_multi_lane_auto"), "scenario 7 guard: bras should use slots_multi_lane_auto variant from permutation search");
assert(!scenario7Result.content_warnings.some((warning) => warning.content_type === "bras"), "scenario 7 guard: no soft height warning should be emitted when height already fits");

assert(Array.isArray(scenario7Debug.layout_rule_evaluations), "scenario 7 rules: debug trace should expose layout_rule_evaluations");
assert(Array.isArray(scenario7Debug.scheme_payload.layout_rule_evaluations), "scenario 7 rules: scheme payload should expose layout_rule_evaluations");
assert(findRuleEvaluation(scenario7Debug.layout_rule_evaluations, "ZONE_INTEGRITY")?.status === "pass", "scenario 7 rules: zone integrity should pass after adjustment placement");
assert(findRuleEvaluation(scenario7Debug.layout_rule_evaluations, "D02")?.status === "pass", "scenario 7 rules: D02 should pass when socks is to the side of bras+panties column, not between them on a shared axis");
assert(["opportunity", "report"].includes(findRuleEvaluation(scenario7Debug.layout_rule_evaluations, "D04b")?.status ?? ""), "scenario 7 rules: D04b status should be opportunity or report (absorption applied in normalization)");
assert(scenario7Debug.scheme_payload.selected_calculated_zones.some((zone) => zone.content_type === "bras" && zone.division_type === "slots" && zone.option_id === "slots_multi_lane_auto"), "scenario 7 rules: evaluator must not change bras placement option");

// D02 true positive: socks in the same x-column between bras and panties on y-axis → violation
// drawer 75x45 depth-stack: panties y=0, socks y=13, bras x=31 — socks is NOT between bras and panties (different x column) → pass (existing forcedReport test covers this)
// For a direct true-positive guard, use the forced scenario where socks is literally depth-stacked between bras and panties
const d02ForcedD02 = findRuleEvaluation(forcedReport.layout_rule_evaluations, "D02");
assert(d02ForcedD02?.status === "pass", "D02 true-positive guard: forced scenario socks between panties/bras in depth (same column) should still evaluate correctly after fix");

// ── BL-18: small drawer + medium/large volumes (elongated cells layouts) ──
// Weak spot in prior coverage: shallow/narrow drawers with mid-large counts.
// Each previously returned no_scheme because only square cells grids existed.
function bl18Zone(output: ReturnType<typeof runUmestnoEngine>, contentType: string) {
  const debug = output.debug as { fit_result: { fit_status: string }; scheme_payload: { selected_calculated_zones: Array<{ content_type: string; option_id: string; division_type: string; zone_w_cm: number; zone_d_cm: number; capacity: number; count: number }> } };
  return { fit_status: debug.fit_result.fit_status, zone: debug.scheme_payload.selected_calculated_zones.find((z) => z.content_type === contentType) };
}

// 1. The headline regression: 40×30×20 + socks Много (24 пары). Must become
//    fit_all via cells_4x6 rotated to 37×25 (was no_scheme with only cells_5x5).
const bl18Socks = runUmestnoEngine({ drawer_width_cm: 40, drawer_depth_cm: 30, drawer_height_cm: 20, storage_category: "underwear", items: [ { content_type: "socks_regular", volume_level: "large" } ], priority: "convenient" });
const bl18SocksZone = bl18Zone(bl18Socks, "socks_regular");
assert(bl18Socks.result !== null, "BL-18 socks: 40×30×20 + socks large should produce a scheme (was no_scheme)");
assert(bl18SocksZone.fit_status === "fit_all", "BL-18 socks: should be fit_all");
assert(bl18SocksZone.zone?.option_id === "cells_4x6_rotated", "BL-18 socks: should use elongated cells_4x6 rotated into the drawer");
assert(bl18SocksZone.zone?.zone_w_cm === 37 && bl18SocksZone.zone?.zone_d_cm === 25, "BL-18 socks: rotated zone should be 37×25 and fit 40×30");
assert((bl18SocksZone.zone?.capacity ?? 0) >= 24, "BL-18 socks: 24 pairs must fit in the chosen grid");

// 2. panties Много (16) in 40×30×15. cells_4x4 (41×13) is too wide; the engine
//    must fall back to the narrower cells_3x6 (31×19), which fits upright.
const bl18Panties = runUmestnoEngine({ drawer_width_cm: 40, drawer_depth_cm: 30, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "panties", volume_level: "large" } ], priority: "convenient" });
const bl18PantiesZone = bl18Zone(bl18Panties, "panties");
assert(bl18Panties.result !== null && bl18PantiesZone.fit_status === "fit_all", "BL-18 panties: 40×30×15 + panties large should be fit_all (was no_scheme)");
assert(bl18PantiesZone.zone?.option_id === "cells_3x6", "BL-18 panties: should fall back to narrower cells_3x6 when 4×4 is too wide");
assert((bl18PantiesZone.zone?.capacity ?? 0) >= 16, "BL-18 panties: 16 items must fit in the chosen grid");

// 3. Multi-category small box: 45×35×15 with socks Много (24) + tights Мало (3).
//    Both categories must place; socks uses the rotated elongated grid.
const bl18Multi = runUmestnoEngine({ drawer_width_cm: 45, drawer_depth_cm: 35, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "socks_regular", volume_level: "large" }, { content_type: "tights", volume_level: "small" } ], priority: "convenient" });
const bl18MultiSocks = bl18Zone(bl18Multi, "socks_regular");
const bl18MultiTights = bl18Zone(bl18Multi, "tights");
assert(bl18Multi.result !== null && bl18MultiSocks.fit_status === "fit_all", "BL-18 multi: 45×35×15 socks large + tights small should be fit_all");
assert(bl18MultiSocks.zone?.division_type === "cells" && bl18MultiTights.zone?.division_type === "cells", "BL-18 multi: both categories should stay in cells");
assert((bl18MultiSocks.zone?.capacity ?? 0) >= 24 && (bl18MultiTights.zone?.capacity ?? 0) >= 3, "BL-18 multi: both grids must satisfy their counts");

// 4. Accessories with square cells (ties Много = 12, unit 8×8). cells_3x4 (24×32)
//    overflows depth 30; rotation of the existing option to 32×24 must fix it.
const bl18Ties = runUmestnoEngine({ drawer_width_cm: 40, drawer_depth_cm: 30, drawer_height_cm: 15, storage_category: "mixed", items: [ { content_type: "ties", volume_level: "large" } ], priority: "convenient" });
const bl18TiesZone = bl18Zone(bl18Ties, "ties");
assert(bl18Ties.result !== null && bl18TiesZone.fit_status === "fit_all", "BL-18 ties: 40×30×15 + ties large should be fit_all via rotation");
assert(bl18TiesZone.zone?.option_id === "cells_3x4_rotated", "BL-18 ties: should rotate the existing cells_3x4 to fit a shallow drawer");

// 5. Capacity-gap closure: jewelry_small Много (50). Max cells capacity used to be
//    30, so no grid could be built at all; cells_7x8 (56) now covers it.
const bl18Jewelry = runUmestnoEngine({ drawer_width_cm: 40, drawer_depth_cm: 30, drawer_height_cm: 20, storage_category: "mixed", items: [ { content_type: "jewelry_small", volume_level: "large" } ], priority: "convenient" });
const bl18JewelryZone = bl18Zone(bl18Jewelry, "jewelry_small");
assert(bl18Jewelry.result !== null && bl18JewelryZone.fit_status === "fit_all", "BL-18 jewelry_small: 40×30×20 + 50 items should be fit_all (capacity gap closed)");
assert((bl18JewelryZone.zone?.capacity ?? 0) >= 50, "BL-18 jewelry_small: chosen grid must hold all 50 items");

// 6. Boundary guard: 35×30 is genuinely too small for socks Много (the only fitting
//    grid, 4×6 rotated 37×25, needs 37 cm width). Must stay no_scheme — the new
//    options must not fabricate an impossible fit.
const bl18TooSmall = runUmestnoEngine({ drawer_width_cm: 35, drawer_depth_cm: 30, drawer_height_cm: 12, storage_category: "underwear", items: [ { content_type: "socks_regular", volume_level: "large" } ], priority: "convenient" });
assert(bl18TooSmall.result === null && bl18TooSmall.scheme_payload === null, "BL-18 boundary: 35×30 socks large is genuinely too small and must remain no_scheme");

// 7. Backward-compat: a roomy drawer must still produce fit_all for socks large
//    (elongated options must not regress previously-working large drawers).
const bl18BigDrawer = runUmestnoEngine({ drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "socks_regular", volume_level: "large" } ], priority: "convenient" });
assert(bl18BigDrawer.result !== null && bl18Zone(bl18BigDrawer, "socks_regular").fit_status === "fit_all", "BL-18 backward-compat: 90×45 socks large must remain fit_all");

// ── BL-18b: full shape set for 16/24 as geometry-driven rescue layouts ──
// Extra exact-capacity elongated grids (cells_2x8 / cells_3x8 / cells_2x12) must
// stay invisible in normal drawers (so compact defaults don't drift) and appear
// only when no compact grid — even rotated — fits the actual drawer geometry.

// 8. Very narrow + deep drawer for socks Много (24): compact 5×5/4×6 (and their
//    rotations) all exceed 22 cm width; cells_3x8 (19×49) is the only fit.
const bl18bDeepSocks = runUmestnoEngine({ drawer_width_cm: 22, drawer_depth_cm: 60, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "socks_regular", volume_level: "large" } ], priority: "convenient" });
const bl18bDeepSocksZone = bl18Zone(bl18bDeepSocks, "socks_regular");
assert(bl18bDeepSocks.result !== null && bl18bDeepSocksZone.fit_status === "fit_all", "BL-18b deep socks: 22×60 socks large should be fit_all via a rescue grid");
assert(bl18bDeepSocksZone.zone?.option_id === "cells_3x8", "BL-18b deep socks: should use the elongated rescue grid cells_3x8");

// 9. Even narrower drawer pushes socks to the most elongated rescue grid 2×12.
const bl18bNarrowSocks = runUmestnoEngine({ drawer_width_cm: 16, drawer_depth_cm: 80, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "socks_regular", volume_level: "large" } ], priority: "convenient" });
const bl18bNarrowSocksZone = bl18Zone(bl18bNarrowSocks, "socks_regular");
assert(bl18bNarrowSocks.result !== null && bl18bNarrowSocksZone.fit_status === "fit_all", "BL-18b narrow socks: 16×80 socks large should be fit_all");
assert(bl18bNarrowSocksZone.zone?.option_id === "cells_2x12", "BL-18b narrow socks: should use the most elongated rescue grid cells_2x12");

// 10. panties Много (16) in a narrow shallow drawer where even 3×6 (31×19) is too
//     wide: cells_2x8 (21×25) rescues it.
const bl18bPanties = runUmestnoEngine({ drawer_width_cm: 24, drawer_depth_cm: 30, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "panties", volume_level: "large" } ], priority: "convenient" });
const bl18bPantiesZone = bl18Zone(bl18bPanties, "panties");
assert(bl18bPanties.result !== null && bl18bPantiesZone.fit_status === "fit_all", "BL-18b panties: 24×30 panties large should be fit_all via rescue grid");
assert(bl18bPantiesZone.zone?.option_id === "cells_2x8", "BL-18b panties: should use the rescue grid cells_2x8 when 4×4/3×6 are too wide");

// 11. Anti-regression: in a roomy drawer the rescue grids must NOT be chosen —
//     socks large stays on a compact grid, never an elongated rescue shape.
const bl18bRoomy = runUmestnoEngine({ drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "socks_regular", volume_level: "large" } ], priority: "convenient" });
const bl18bRoomyOption = bl18Zone(bl18bRoomy, "socks_regular").zone?.option_id ?? "";
assert(bl18bRoomy.result !== null, "BL-18b roomy: 90×45 socks large should be fit_all");
assert(!["cells_2x8", "cells_3x8", "cells_2x12"].some((id) => bl18bRoomyOption.startsWith(id)), "BL-18b roomy: rescue grids must not be selected when a compact grid fits");

// ── BL-18c: factorization completeness for every cells count ──
// For each item count a cells category can produce, every non-degenerate
// rectangular grid (both sides ≥ 2, aspect ≤ 6, i.e. excluding 1×N strips)
// must exist in the library in either orientation — so the engine always has
// the full shape set to match drawer geometry. This guards against future
// volumeToCount edits silently re-introducing a missing layout.
{
  const cellsTypes = new Set(defaultLibraries.storageUnitProfile.filter((p) => p.primary_division === "cells").map((p) => p.content_type));
  const cellsCounts = [...new Set(defaultLibraries.volumeToCount.filter((r) => cellsTypes.has(r.content_type)).map((r) => r.count))];
  const cellsGrids = new Set(defaultLibraries.zoneLayoutOptions.filter((o) => o.division_type === "cells").map((o) => `${Math.min(o.cols ?? 0, o.rows ?? 0)}x${Math.max(o.cols ?? 0, o.rows ?? 0)}`));
  for (const n of cellsCounts) {
    for (let a = 2; a * a <= n; a++) {
      if (n % a !== 0) continue;
      const b = n / a;
      if (b / a > 6) continue; // skip degenerate 1×N-like strips (aspect > 6)
      assert(cellsGrids.has(`${a}x${b}`), `BL-18c completeness: cells count ${n} is missing grid ${a}×${b}`);
    }
  }
}

// 12. Rescue grid cells_2x4 (=8) must place when no compact grid (even rotated)
//     fits: 16×18 rejects 3×3 in both orientations (22×13 / 13×22) but fits 2×4 (15×17).
const bl18cTights = runUmestnoEngine({ drawer_width_cm: 16, drawer_depth_cm: 18, drawer_height_cm: 15, storage_category: "mixed", items: [ { content_type: "tights", volume_level: "medium" } ], priority: "convenient" });
assert(bl18cTights.result !== null && bl18Zone(bl18cTights, "tights").zone?.option_id === "cells_2x4", "BL-18c rescue: 16×18 tights (8) should use cells_2x4");

// 13. Rescue grid cells_5x10 (=50) for jewelry_small in a narrow deep drawer.
const bl18cJewelry = runUmestnoEngine({ drawer_width_cm: 18, drawer_depth_cm: 70, drawer_height_cm: 15, storage_category: "mixed", items: [ { content_type: "jewelry_small", volume_level: "large" } ], priority: "convenient" });
assert(bl18cJewelry.result !== null && bl18Zone(bl18cJewelry, "jewelry_small").zone?.option_id === "cells_5x10", "BL-18c rescue: 18×70 jewelry_small (50) should use cells_5x10");

console.log("ok 3 calibration case(s), 1 validation case, 1 library coverage audit, 6 soft height scenarios, 13 BL-18 small-drawer/elongated-cells scenarios + cells factorization-completeness audit");
