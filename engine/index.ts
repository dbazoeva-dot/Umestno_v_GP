import type { CalculatedZone, LayoutPlan, Libraries, UserInput } from "./types.js";
import { defaultLibraries } from "./libraries/defaultLibraries.js";
import { normalizeInput } from "./input/normalizeInput.js";
import { validateInput } from "./input/validateInput.js";
import { volumeToCount } from "./count/volumeToCount.js";
import { buildStorageRequirements } from "./requirements/buildStorageRequirements.js";
import { generateZoneVariants } from "./zones/generateZoneVariants.js";
import { generatePlacementCandidates } from "./fit/generatePlacementCandidates.js";
import { selectBestCandidate } from "./fit/selectBestCandidate.js";
import { normalizePlacement } from "./fit/normalizePlacement.js";
import { evaluatePlacementRules } from "./rules/evaluatePlacementRules.js";
import { buildSchemePayload } from "./scheme/buildSchemePayload.js";
import { matchSkus } from "./sku/matchSkus.js";
import { runSkuFitCheck } from "./sku/runSkuFitCheck.js";
import { buildFinalResultPayload } from "./result/buildFinalResultPayload.js";
import { buildDebugTrace } from "./debug/buildDebugTrace.js";

const NO_FIT_MESSAGE = "По введённым размерам и объему вещей мы не можем собрать надёжную схему для этого ящика. Попробуйте уменьшить объём одной из категорий или проверьте внутренние размеры ящика: ширину, глубину и полезную высоту до закрытия.";

export function buildValidationErrorPayload(validation: ReturnType<typeof validateInput>) { return { result: null, debug: { validation_result: validation } }; }
export function runUmestnoEngine(input: UserInput, libraries: Libraries = defaultLibraries) {
  const normalizedInput = normalizeInput(input);
  const validation = validateInput(normalizedInput);
  if (!validation.ok) return { ...buildValidationErrorPayload(validation), scheme_payload: null };

  const countedItems = volumeToCount(normalizedInput.items, libraries.volumeToCount);
  const storageRequirements = buildStorageRequirements({ countedItems, storageUnitProfile: libraries.storageUnitProfile, zoneLayoutOptions: libraries.zoneLayoutOptions });

  const zoneVariants = generateZoneVariants(storageRequirements, libraries.zoneLayoutOptions, normalizedInput.drawerSize);
  const allCandidates = generatePlacementCandidates({ zoneVariants, drawerSize: normalizedInput.drawerSize });
  const bestRaw = selectBestCandidate({ candidates: allCandidates, drawerSize: normalizedInput.drawerSize });

  if (!bestRaw) {
    const bestFailed = allCandidates.reduce<typeof allCandidates[0] | undefined>((best, c) => !best || c.best_attempt.placed_count > best.best_attempt.placed_count ? c : best, undefined);
    return {
      result: null,
      scheme_payload: null,
      debug: buildDebugTrace({ input: normalizedInput, validation_result: validation, counted_items: countedItems, storage_requirements: storageRequirements, zone_variants: zoneVariants, candidate_count: allCandidates.length, fit_result: bestFailed, adjustment_result: null, adjustment_attempts: [], no_fit: true }),
      no_fit_message: NO_FIT_MESSAGE
    };
  }

  const fitResult = normalizePlacement({ fitResult: bestRaw, drawerSize: normalizedInput.drawerSize });

  const selectedZones = fitResult.placed_zones as CalculatedZone[];
  const layoutPlan: LayoutPlan = {
    layout_id: `permutation_v2_${normalizedInput.priority}_${normalizedInput.drawerSize.w_cm}x${normalizedInput.drawerSize.d_cm}`,
    selected_zones: selectedZones,
    placement_order: selectedZones.map((z) => z.content_type),
    rules_applied: libraries.layoutRules.rule_ids,
    reserve_policy: libraries.layoutRules.reserve_policy
  };

  const layoutRuleEvaluations = evaluatePlacementRules({ drawerSize: normalizedInput.drawerSize, fitResult, definitions: libraries.ruleDefinitions });
  const schemePayload = buildSchemePayload({ input: normalizedInput, countedItems, storageRequirements, calculatedZones: selectedZones, layoutPlan, fitResult, adjustment: null, validation, layoutRuleEvaluations });
  const skuMatches = matchSkus({ schemePayload, skuCatalog: libraries.skuCatalog, colorPreference: normalizedInput.colorPreference });
  const skuFitResult = runSkuFitCheck({ schemePayload, skuMatches, drawerSize: normalizedInput.drawerSize });
  const finalResult = buildFinalResultPayload({ schemePayload, skuMatches, skuFitResult });
  const debugTrace = buildDebugTrace({ input: normalizedInput, validation_result: validation, counted_items: countedItems, storage_requirements: storageRequirements, zone_variants: zoneVariants, candidate_count: allCandidates.length, selected_layout_plan: layoutPlan, fit_result: fitResult, adjustment_result: null, adjustment_attempts: [], layout_rule_evaluations: layoutRuleEvaluations, scheme_payload: schemePayload, sku_matching_result: skuMatches, sku_fit_result: skuFitResult, final_result_payload: finalResult });
  return { result: finalResult, scheme_payload: schemePayload, debug: debugTrace };
}
export * from "./types.js";
export { ruleDefinitions } from "./rules/ruleDefinitions.js";
export { evaluatePlacementRules } from "./rules/evaluatePlacementRules.js";
