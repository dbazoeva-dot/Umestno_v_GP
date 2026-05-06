# Umestno Engine MVP Baseline

This repository currently contains the MVP baseline for the Umestno storage-layout engine. The engine is **scheme-first**: it calculates an explainable drawer storage scheme before SKU/product matching.

## Public API

```ts
runUmestnoEngine(input) -> {
  result,
  scheme_payload,
  debug
}
```

- `result` — current final user/product-facing payload (`final_result_payload`).
- `scheme_payload` — technical drawer scheme with `selected_calculated_zones`, `assigned_zones`, layout plan, reserve zones, warnings, and fit status.
- `debug` — full trace for validation, volume-to-count, requirements, generated zones, layout/fit, adjustment, SKU matching, SKU fit, and final payload.

Validation failures return `result: null`, `scheme_payload: null`, and `debug.validation_result`.

## Current pipeline

1. User Input
2. Validation
3. Volume → Count
4. Storage Requirement Builder
5. Zone Size Calculation
6. Layout Rule Engine
7. Deterministic 2D/free-rectangle Fit Check
8. Reserve / Adjustment
   - slot multi-lane split before unrelated open fallback
   - open fallback only from propagated metadata
9. Scheme Payload
10. SKU Matching stub/minimal implementation
11. SKU Fit Check stub/minimal implementation
12. Final Result Payload
13. Debug Trace

## Supported calculation modes

- `fixed_grid` — cells layout: fixed cols × rows grid.
- `linear_depth` — single-lane slot layout, depth grows with count.
- `linear_depth_split` — multi-lane slot layout for slot-stored categories when a single lane exceeds drawer depth.
- `open_capacity_in_box` — box-first capacity calculation for open fallback.

## ABCD libraries status

The MVP currently uses hardcoded libraries in `engine/libraries/defaultLibraries.ts`:

- A: `volumeToCount`
- B: `storageUnitProfile`
- C: `zoneLayoutOptions`
- D: `layoutRules`
- E: `skuCatalog` placeholder/stub

Excel files are present in the repo, but the runtime engine does **not** load Excel yet. Excel loader integration can be connected later without changing the public API.

## Calibration commands

```bash
npm run calibration:json
npm run calibration:json:forced-open
npm run calibration:json:four-item-stress
```

Full checks for this baseline:

```bash
npx tsc --noEmit
npm test
npm --silent run calibration:json:four-item-stress > /tmp/four_item_stress.json
python -m json.tool /tmp/four_item_stress.json >/dev/null
```

## Expected calibration results

- Base `90×45×15` underwear medium case: `fit_all`.
- Forced/open fallback regression `75×45×15`: current deterministic 2D behavior fits primary zones without open fallback when cells fit in remaining depth. If open fallback behavior is changed later, keep a separate unit/regression test for true open fallback.
- Four-item stress `120×40×20`: `fit_all` after bras multi-lane split and deterministic 2D/free-rectangle placement.
  - `bras large/many = 10`
  - `bras_slots_single_row` fails by depth at `50.5 cm`
  - `bras_slots_multi_lane_auto` splits into 2 lanes `[5, 5]`, depth `25.5 cm`
  - `panties_cells_4x4` stays in cells and does not need open fallback

## Debug trace structure

Debug trace includes, depending on validation/fit path:

- `input`
- `validation_result`
- `counted_items`
- `storage_requirements`
- `generated_calculated_zones`
- `selected_layout_plan`
- `initial_fit_result` / `fit_result`
- `adjustment_result` / `adjustment_attempts`
- `final_fit_result`
- `assigned_zones`
- `scheme_payload`
- `sku_matching_result`
- `sku_fit_result`
- `final_result_payload`

Fit results include deterministic placement debug via `placement_attempts` and `free_rectangles`.

## Known limitations

- SKU matching and SKU fit check are stub/minimal unless implemented later.
- Product-facing output/view model is not final.
- Landing/demo UI is not included yet.
- Libraries are hardcoded in TypeScript; Excel loading is not connected at runtime.
- The placement engine is deterministic and rule-based, not a global optimizer/solver.

## Codex workflow rule

After every completed iteration:

1. Run tests/checks.
2. Commit changes.
3. Push the current branch.
