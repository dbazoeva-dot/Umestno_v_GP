# Content library audit: Excel ABCD vs runtime defaults

Source file: `Internal Library ABCD_v0605.xlsx`.
Runtime file: `engine/libraries/defaultLibraries.ts`.

## Summary

- Excel A (`volume_to_count`) contains 21 source `content_type` values.
- Excel B (`storage_unit_profile`) contains the same 21 source `content_type` values.
- Before this PR, runtime A/B had 7 MVP-supported canonical types: `socks_regular`, `panties`, `boxers`, `bras`, `tights`, `tshirts`, `jeans`.
- This PR adds missing Excel source content coverage while keeping the existing 7 runtime-supported types unchanged.
- Canonical runtime ID for regular socks is `socks_regular`. Excel source `socks` is covered by alias/normalization: `socks` → `socks_regular`.
- `socks` must not be treated as a separate selectable runtime content type, and runtime A/B should not contain independent `socks` rows.
- Existing supported types are not automatically synchronized in this PR; mismatches are listed below as product decisions.
- `can_split` is preserved as B metadata for spatial split into separate parent zones only. It is not used for internal layout, `slots_multi_lane_auto`, repeated modules, or open packing.

## Excel source content types

`belts`, `boxers`, `bras`, `jeans`, `jewelry_large`, `jewelry_small`, `leggings`, `longsleeves`, `nightgowns`, `pajamas`, `panties`, `scarves`, `shorts`, `socks`, `sport_tops`, `sweaters`, `swimwear`, `thermals`, `tights`, `ties`, `tshirts`.

## Runtime content types after this PR

`belts`, `boxers`, `bras`, `jeans`, `jewelry_large`, `jewelry_small`, `leggings`, `longsleeves`, `nightgowns`, `pajamas`, `panties`, `scarves`, `shorts`, `socks_regular`, `sport_tops`, `sweaters`, `swimwear`, `thermals`, `tights`, `ties`, `tshirts`.

## Source-to-runtime alias mapping

| Excel source content_type | Canonical runtime content_type | Notes |
|---|---|---|
| `socks` | `socks_regular` | MVP canonical ID remains `socks_regular`; source `socks` is intentionally covered by normalization and audit mapping, not by a separate runtime category. |

## Added runtime A/B content types

| content_type | Source group | Runtime category | Notes |
|---|---|---|---|
| `sport_tops` | underwear | underwear | Uses Excel spelling `sport_tops`; older `sports_tops` is not in source A/B. |
| `thermals` | underwear | underwear | Source primary division is `open`; engine behavior for primary-open zones remains a product/engine follow-up. |
| `pajamas` | underwear | underwear | Added from source A/B. |
| `nightgowns` | underwear | underwear | Added from source A/B. |
| `longsleeves` | clothing | soft_clothes | Runtime category maps source `clothing` to current `soft_clothes`. |
| `sweaters` | clothing | soft_clothes | Runtime category maps source `clothing` to current `soft_clothes`. |
| `leggings` | clothing | soft_clothes | Added from source A/B. |
| `shorts` | clothing | soft_clothes | Added from source A/B. |
| `belts` | accessories | accessories | Added runtime category `accessories`. |
| `jewelry_large` | accessories | accessories | Added from source A/B. |
| `jewelry_small` | accessories | accessories | Preserves source `can_split = true` as spatial-split metadata. |
| `scarves` | accessories | accessories | Added from source A/B. |
| `ties` | accessories | accessories | Added from source A/B. |
| `swimwear` | accessories | accessories | Added from source A/B. |

## Existing runtime types intentionally not overwritten

| content_type | Source value | Runtime value | Assessment |
|---|---|---|---|
| `socks` / `socks_regular` | Source ID `socks`, unit `6×6×8`, clearances `0`, count `8/16/24` | Canonical runtime `socks_regular`, unit `6×6×7`, clearances `0.5/0.5/1`, count `8/16/24` | Intentional MVP alias/calibration; source `socks` maps to canonical `socks_regular`. |
| `panties` large count | `18` | `16` | Product decision; do not overwrite automatically. |
| `panties` dimensions/clearances | `10×3×9`, clearances `0` | `10×3×6`, clearances `0.5/0.5/1` | Product decision; height mismatch may affect fit. |
| `boxers` counts | `6/10/16` | `5/8/12` | Product decision; runtime undercounts vs source. |
| `boxers` dimensions/clearances | `12×5×10`, clearances `0` | `11×4×7`, clearances `0.5/0.5/1` | Product decision; runtime under-sizes vs source. |
| `bras` storage method/can_rotate | `flat`, `can_rotate=yes` | `delicate_stack`, `can_rotate=false` | Likely intentional MVP override for delicate handling. |
| `bras` internal lane metadata | Source has no `max_slot_lanes` fields | Runtime has `max_slot_lanes=2`, `slot_lane_gap_cm=1`, `split_strategy=balance_by_depth` | Intentional MVP extension; not controlled by `can_split`. |
| `tights` count/division/dimensions | medium `6`, primary `open`, unit `10×10×8` | medium `8`, primary `cells`, unit `7×4×8` | Product decision; currently treated as intentional runtime calibration until decided. |
| `tshirts` storage method/dimensions | `folded_squares_thin`, unit `20×5×10` | `folded_squares_medium`, unit `22×4×11` | Product decision; do not overwrite automatically. |
| `jeans` dimensions/clearances | `25×10×12`, clearances `1/1/1`, rigidity `rigid`, rotate `yes` | `25×5×13`, clearances `0.5/0.5/1`, rigidity `semi_rigid`, rotate `false` | Critical product decision; runtime may underestimate depth. |

## C / zone layout options notes

This PR does not change `zone_layout_options`. Existing runtime options remain MVP-focused.

Known C differences requiring a separate decision:

- Excel C includes additional fixed-grid options such as `cells_3x6`, `cells_2x8`, and `cells_4x6` that runtime does not currently expose.
- Runtime includes `slots_multi_lane_auto` / `linear_depth_split`, an intentional MVP engine extension not present in Excel C.
- Excel C includes dividers modes (`dividers_linear_depth`, `dividers_grid_auto`) while runtime types currently expose only minimal dividers support and do not use dividers in the MVP flow.
- Large cell counts such as `jewelry_small large = 50` may require repeated-module support or additional C options in a later PR.

## Follow-up product decisions

1. Decide whether the temporary `socks` → `socks_regular` normalization should become a formal alias layer shared by Excel loaders and user input normalization.
2. Decide whether `sport_tops` fully replaces older `sports_tops` naming.
3. Decide whether to align `panties`, `boxers`, `tights`, `tshirts`, and `jeans` runtime values to Excel or keep runtime calibration overrides.
4. Decide how primary `open` content such as `thermals` should be represented in the scheme-first layout flow.
5. Decide how repeated modules should handle large cell capacities such as `jewelry_small large = 50`.
