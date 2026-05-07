import { buildBaseCalibrationCaseReport, buildForcedOpenFallbackCalibrationCaseReport, buildFourItemStressCalibrationCaseReport } from "../calibration/buildCalibrationCaseReport.js";
import { runUmestnoEngine } from "../index.js";
import { defaultLibraries } from "../libraries/defaultLibraries.js";
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }


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
assert(forcedReport.final_fit_result.placed_zones.some((zone) => zone.content_type === "panties" && zone.division_type === "cells" && zone.y_cm > 0), "forced case: panties cells should be placed in remaining depth rectangle");
assert(forcedReport.final_fit_result.placement_attempts?.every((attempt) => attempt.placed), "forced case: debug placement attempts should show every zone placed");

const fourItemReport = buildFourItemStressCalibrationCaseReport();
const stress = fourItemReport.calibration_stress_result;
assert(fourItemReport.production_validation_result.ok === false, "four-item production mode: validation should fail");
assert(fourItemReport.production_validation_result.error_details.some((error) => error.reason === "max_items_exceeded" && error.max_items === 3 && error.received_items === 4), "four-item production mode: should reject because max_items is 3 and received_items is 4");
assert(fourItemReport.calibration_override.allow_max_items === 4, "four-item stress mode: should use allow_max_items = 4 override");
assert(stress.validation_result.ok === true, "four-item stress mode: validation should pass with override");
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

for (const profile of defaultLibraries.storageUnitProfile) {
  const propagatedRequirements = [baseReport, forcedReport, stress].flatMap((report) => report.storage_requirements).filter((requirement) => requirement.content_type === profile.content_type);
  assert(propagatedRequirements.every((requirement) => requirement.can_split === profile.can_split), `${profile.content_type}: can_split should be propagated unchanged from B/defaultLibraries`);
}

const maxItemsOutput = runUmestnoEngine({ drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "mixed", items: [ { content_type: "bras", volume_level: "medium" }, { content_type: "socks_regular", volume_level: "medium" }, { content_type: "panties", volume_level: "medium" }, { content_type: "tshirts", volume_level: "small" } ], priority: "convenient" });
assert(maxItemsOutput.result === null, "max items case: result should be null");
assert(maxItemsOutput.scheme_payload === null, "max items case: scheme_payload should be null");

const socksAliasOutput = runUmestnoEngine({ drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "socks", volume_level: "medium" } ], priority: "convenient" });
const socksAliasDebug = socksAliasOutput.debug as { input: { items: Array<{ content_type: string }> }; counted_items: Array<{ content_type: string }> };
assert(socksAliasDebug.input.items[0]?.content_type === "socks_regular", "source socks input should normalize to canonical runtime socks_regular");
assert(socksAliasDebug.counted_items[0]?.content_type === "socks_regular", "source socks should count through canonical socks_regular, not a separate socks type");
const duplicateSocksAliasOutput = runUmestnoEngine({ drawer_width_cm: 90, drawer_depth_cm: 45, drawer_height_cm: 15, storage_category: "underwear", items: [ { content_type: "socks", volume_level: "small" }, { content_type: "socks_regular", volume_level: "small" } ], priority: "convenient" });
assert(duplicateSocksAliasOutput.result === null, "socks and socks_regular together should be rejected after alias normalization instead of producing two zones");
console.log("ok 3 calibration case(s), 1 validation case, 1 library coverage audit");
