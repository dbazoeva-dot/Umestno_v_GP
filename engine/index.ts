import type { Libraries, UserInput } from "./types.js";
import { defaultLibraries } from "./libraries/defaultLibraries.js";
import { normalizeInput } from "./input/normalizeInput.js";
import { validateInput } from "./input/validateInput.js";
import { volumeToCount } from "./count/volumeToCount.js";
import { buildStorageRequirements } from "./requirements/buildStorageRequirements.js";
import { generateCalculatedZones } from "./zones/generateCalculatedZones.js";
import { buildLayoutPlan } from "./layout/buildLayoutPlan.js";
import { runFitCheck } from "./fit/runFitCheck.js";
import { runAdjustmentLoop } from "./adjustment/runAdjustmentLoop.js";
import { buildSchemePayload } from "./scheme/buildSchemePayload.js";
import { matchSkus } from "./sku/matchSkus.js";
import { runSkuFitCheck } from "./sku/runSkuFitCheck.js";
import { buildFinalResultPayload } from "./result/buildFinalResultPayload.js";
import { buildDebugTrace } from "./debug/buildDebugTrace.js";
export function buildValidationErrorPayload(validation: ReturnType<typeof validateInput>) { return { result: null, debug: { validation_result: validation } }; }
export function runUmestnoEngine(input: UserInput, libraries: Libraries = defaultLibraries) {
  const normalizedInput = normalizeInput(input);
  const validation = validateInput(normalizedInput);
  if (!validation.ok) return { ...buildValidationErrorPayload(validation), scheme_payload: null };
  const countedItems = volumeToCount(normalizedInput.items, libraries.volumeToCount);
  const storageRequirements = buildStorageRequirements({ countedItems, storageUnitProfile: libraries.storageUnitProfile, zoneLayoutOptions: libraries.zoneLayoutOptions });
  const calculatedZones = generateCalculatedZones(storageRequirements);
  const layoutPlan = buildLayoutPlan({ calculatedZones, drawerSize: normalizedInput.drawerSize, priority: normalizedInput.priority, layoutRules: libraries.layoutRules });
  let fitResult = runFitCheck({ layoutPlan, calculatedZones, drawerSize: normalizedInput.drawerSize });
  let adjustedLayout: ReturnType<typeof runAdjustmentLoop> = null;
  if (fitResult.fit_status !== "fit_all") {
    adjustedLayout = runAdjustmentLoop({ fitResult, calculatedZones, layoutPlan, drawerSize: normalizedInput.drawerSize, zoneLayoutOptions: libraries.zoneLayoutOptions, layoutRules: libraries.layoutRules });
    if (adjustedLayout) fitResult = adjustedLayout.fit_after_adjustment;
  }
  const finalCalculatedZones = adjustedLayout?.calculatedZones ?? calculatedZones;
  const finalLayoutPlan = adjustedLayout?.layoutPlan ?? layoutPlan;
  const schemePayload = buildSchemePayload({ input: normalizedInput, countedItems, storageRequirements, calculatedZones: finalCalculatedZones, layoutPlan: finalLayoutPlan, fitResult, adjustment: adjustedLayout, validation });
  const skuMatches = matchSkus({ schemePayload, skuCatalog: libraries.skuCatalog, colorPreference: normalizedInput.colorPreference });
  const skuFitResult = runSkuFitCheck({ schemePayload, skuMatches, drawerSize: normalizedInput.drawerSize });
  const finalResult = buildFinalResultPayload({ schemePayload, skuMatches, skuFitResult });
  const debugTrace = buildDebugTrace({ input: normalizedInput, validation_result: validation, counted_items: countedItems, storage_requirements: storageRequirements, generated_calculated_zones: calculatedZones, selected_layout_plan: layoutPlan, fit_result: fitResult, adjustment_result: adjustedLayout, adjustment_attempts: adjustedLayout?.adjustment_attempts ?? [], scheme_payload: schemePayload, sku_matching_result: skuMatches, sku_fit_result: skuFitResult, final_result_payload: finalResult });
  return { result: finalResult, scheme_payload: schemePayload, debug: debugTrace };
}
export * from "./types.js";
