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


## Split and module semantics

`can_split` follows the source ABCD glossary meaning: **whether one `content_type` may be split into two separate parent assigned zones**. In other words, `can_split` is about future spatial split behavior, such as placing `socks` zone 1 in one drawer area and `socks` zone 2 elsewhere.

`can_split` is copied from B / `storage_unit_profile` metadata and must not be redefined or inferred from runtime engine behavior. If B says `can_split = true`, spatial split is allowed for that `content_type` when spatial split logic is implemented; if B says `false`, it is not allowed. The MVP currently does **not** implement spatial splitting, so the default runtime behavior is still one contiguous parent assigned zone per `content_type`.

Internal layout is a separate concept and must not be controlled by `can_split`. Internal layout behaviors are allowed by default in the MVP unless an option/profile explicitly limits them. They include repeated or parallel modules inside one contiguous parent zone, not spatial splitting into two parent zones.

- a parent zone may contain one or more repeated modules;
- each module is an instance of the same `option_id` from C / `zone_layout_options`;
- repeated modules must remain adjacent/contiguous;
- no other `content_type` may be placed between repeated modules;
- the parent zone remains one assigned zone.

Examples:

- `bras` parent zone may use `slots_single_row × 2` as adjacent internal slot lanes, represented in the current MVP by `slots_multi_lane_auto` / `linear_depth_split`; this is valid internal module composition, **not** `can_split`.
- `socks` parent zone may later use `cells_4x4 × 2` as adjacent repeated modules; this is still one socks zone, **not** `can_split`.
- `open` packing calculates capacity inside one assigned box; this is internal packing, **not** `can_split`.

Therefore, `can_split` must not control `slots_multi_lane_auto`, repeated cells grids, open packing, or any other internal module layout.

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

## Open calibration decisions

### R4: tshirts/medium 0.5 cm depth overflow in 45 cm drawer

`tshirts/medium` (10 items) generates a slots zone with `zone_d_cm = 45.5 cm`. In a 90×45 drawer this
exceeds the available depth by 0.5 cm and produces `no_fit`. Decide before library finalisation:

- **Option A (tolerance pass):** round slot-zone depth down to the nearest 0.5 cm when overflow ≤ 1 cm.
  Risk: silently under-allocates depth, may cause items to protrude.
- **Option B (library fix):** reduce the `unit_d_cm` or `fb_clear` for tshirts in `storageUnitProfile`
  so 10 items fit inside 45 cm.
- **Option C (keep strict):** current behaviour is correct; a 90×45 drawer genuinely cannot fit 10 tshirts
  in slots layout. Document as a known hard limit.

Until resolved, 90×45 with tshirts/medium returns `result: null` + `no_fit_message`.

### D04b: aggressive depth absorption in deep drawers

`normalizePlacement` (D04b step) extends `assigned_d_cm` to absorb any adjacent same-width free rectangle.
In very deep drawers — e.g. R3 (45×80) — this extends zones from their natural depth (25–9 cm) to the
full 80 cm. `assigned_d_cm` is the geometry target used by SKU matching (`runSkuFitCheck`).

Review before SKU matching is finalised:

- A SKU selected for a zone with `assigned_d_cm = 80 cm` must physically fit that depth, or SKU
  selection must cap the target at `zone_d_cm` (the calculated storage depth) rather than the
  absorbed assigned depth.
- Suggested invariant: SKU depth fit uses `min(assigned_d_cm, drawer_d_cm)` and must not reject a
  SKU solely because `assigned_d_cm` grew beyond the zone's natural size via D04b.
- If SKU matching targets the original `zone_d_cm` instead of `assigned_d_cm`, D04b remains purely
  cosmetic/visual and no change is needed.

## Backlog

### BL-01: SKU sets / bundle organizers

**Status:** open — do not add sets to SKU catalog yet; design format first.

**Problem:** Some products are sold as a set of N identical (or compatible) organizers in one package.
Example: a set of 4 soft boxes that together tile a full drawer.
Such a set can cover an entire `assigned_zone` where no single organizer would fit, and it has its own price and product page.

**Questions to resolve before implementation:**

1. **Catalog representation** — one row per set or one row per piece?
   - Option A: one row for the set, with `set_count` (e.g. 4) and `piece_w/d/h` fields.
     `width_cm` / `depth_cm` = dimensions of one piece; `capacity_units` = total capacity of all pieces.
   - Option B: one row per piece (same as individual SKU) + a `set_sku_id` foreign key linking pieces that are sold together.
   - Option C: a separate `sku_sets` table/sheet with `set_id`, `piece_sku_id`, `piece_count`.

2. **Matching logic** — how does `matchSkus` handle sets?
   - A single piece may not cover the `assigned_zone` footprint, but `piece_count` pieces side-by-side do.
   - Matching must check: `piece_w * piece_count ≈ assigned_w` OR `piece_d * piece_count ≈ assigned_d`.
   - Combined `capacity_units` (piece capacity × count) must meet `zone.count`.

3. **Pricing** — set price is the unit of purchase; individual piece price is irrelevant.

4. **Mixed-type sets** — a set may contain pieces of different `division_type` (e.g. 2 cells + 1 open tray).
   These need to be matched to multiple zones simultaneously, not one zone.

5. **UX representation** — result payload must communicate "buy this set of 4" clearly, not list 4 identical lines.

**Suggested next step:** once individual SKU catalog is complete, add a `sku_sets` sheet to `E_SKU_catalog` with columns:
`set_id | set_title | product_url | price_rub | piece_sku_id | piece_count | set_notes`
and extend `matchSkus` to try set candidates after single-piece candidates fail.

### BL-02: Drawer dividers as universal organizer replacement

**Status:** open — dividers are in the SKU catalog (`division_type = "dividers"`) but matching logic is not implemented.

**Problem:** Loose dividers (разделители для ящиков) are fundamentally different from cells/slots organizers:
- They have no fixed internal cell size — the user positions them freely
- A set of N dividers can create any grid configuration inside the assigned zone
- They can technically substitute any `division_type` (cells, slots, open) if the resulting cell size fits the items
- Example: 10 dividers in a 90×45 drawer → user creates 4×4 sock cells, 1×7 bra slots, etc.

**Why this is hard:**
- No `cell_width_cm` / `cell_depth_cm` on the SKU — size is emergent from placement
- Match condition is: "can this divider set create the required grid in `assigned_w × assigned_d`?"
  - Check: `divider_length ≈ assigned_w` OR `divider_length ≈ assigned_d`
  - Check: `divider_count ≥ (cols + rows - 2)` for a cols×rows grid
- Dividers are agnostic to `preferred_rigidity` — rigidity comes from the material of the divider itself
- A divider set may cover multiple zones simultaneously (one purchase, whole drawer)

**What needs to be designed:**
1. Additional SKU fields for dividers: `divider_length_cm`, `divider_height_cm`, `divider_count_in_set`
2. Matching logic: given zone grid (`calculated_cols`, `calculated_rows`), check if divider set can create it
3. How to combine divider recommendations across multiple zones in the same drawer
4. UX: dividers require user effort to configure — communicate this clearly vs pre-built organizers

**Suggested next step:** After individual organizer matching is live, add divider matching as a parallel candidate with lower default ranking (higher effort for user). Only surface dividers when no pre-built organizer fits.

### BL-03: Jewelry organizer matching — separate mechanics

**Status:** open — current matching logic (cell_w ≈ unit_w, cell_d ≥ unit_d) is too simple for jewelry.

**Problem:** Jewelry organizers have significantly more complex structure than standard cells/slots:
- Multi-tier trays (several layers stacked, different cell sizes per layer)
- Mixed cell sizes in one organizer (ring slots + bracelet compartments + chain hooks)
- Items like rings, earrings, chains, bracelets have very different storage needs even within `jewelry_small` / `jewelry_large`
- Anti-tangle and anti-scratch requirements affect rigidity matching differently
- Lid presence (`has_lid`) matters for jewelry in a way it doesn't for clothing

**What needs to be designed:**
1. Whether to split `jewelry_small` / `jewelry_large` into more granular content types
2. How to match multi-tier / mixed-cell organizers (single SKU covers multiple sub-types)
3. Whether `has_lid` becomes a hard filter or ranking signal for jewelry zones
4. Separate penalty logic for open fallback (currently `open_fallback_allowed=false` for large jewelry)

**Suggested next step:** design after individual organizer matching is live for clothing/underwear.

### BL-04: Engine `volume_to_count` mismatches with Library A

**Status:** open — engine numbers kept as-is for now; await source-of-truth call.

**Problem:** `engine/libraries/defaultLibraries.ts` and Library A disagree on four `volume_to_count` rows:

| content_type | level  | engine | Library A |
|--------------|--------|--------|-----------|
| panties      | large  | 16     | 18        |
| boxers       | small  | 5      | 6         |
| boxers       | medium | 8      | 10        |
| tights       | medium | 8      | 6         |

Aligning the engine to Library A immediately breaks `fourItemStressCalibration`:
panties large grows 16 → 18, requiring `cells_4x5` (41 × 16 cm) instead of `cells_4x4`,
which no longer fits drawer 120×40 alongside bras + socks + tights → `fit_partial`,
panties dropped. Re-tuning the stress drawer (e.g. 120 → 150 cm) is mechanically
trivial but changes the fixture without knowing whose numbers are correct.

**What needs to be decided:**
1. Are Library A's 4 numbers corrections to the engine (then update engine + re-tune the stress fixture to preserve the slot-split regression intent) or errors in A (then fix A)?
2. If engine wins, who owns Library A's correction so the spreadsheet doesn't drift back?

**Decision recorded 2026-06-01:** revert engine changes (`eb008a2`), build the configurator
form on engine numbers, resolve discrepancies with Library A authors before MVP launch.

### BL-05: `soft_clothes` vs `clothing` naming inconsistency

**Status:** open — pure rename, no behavioural effect.

**Problem:** `engine/types.ts` declares the storage category as `soft_clothes`,
but Library A and the frontend label list call it `clothing`.

**Why deferred:** `storage_category` does not affect calculation — the server
hard-codes `mixed` on every request, so the value never reaches the planner in
practice. A rename is cosmetic.

**Suggested next step:** rename to `clothing` during the next engine-types touch
to remove the internal drift.

### BL-06: Unified source of truth for engine input tables

**Status:** open — duplicate by hand for MVP, redesign before catalog grows past
~30 content types.

**Problem:** Several engine input tables are mirrored on the frontend so the
configurator can render labels and dropdowns without an API roundtrip:
- `volumeToCount` (engine) ↔ `VOLUME_BOUNDS` (`landing_design/content-labels.js`)
- content_type list (engine `types.ts`) ↔ `UMESTNO_CONTENT.items`
- group structure ↔ `UMESTNO_CONTENT.groups`
- (future) priority list, color_preference list, fold tips, etc.

At 21 content types and ~5 tables this is a 5-minute manual sync per change
and drift is caught by eye. At 100+ content types — likely once the
post-MVP catalog expansion starts (BL-01 sets, BL-02 dividers, BL-03 jewelry
sub-types) — every engine edit will silently desync the form.

**What needs to be designed:**
1. Canonical format — TypeScript/JSON file in `engine/libraries/` is the source;
   everything else generated.
2. Generation pipeline — build script that reads the canonical file and emits:
   - `landing_design/volume-bounds.js` (or whichever frontend bundle replaces it)
   - typed enums for engine
   - validation tables for the server's request schema
3. CI guard — fail the build if generated artifacts are stale vs source.
4. Migration path — how to introduce this without breaking the existing
   `content-labels.js` consumer (result-render).

**Suggested next step:** revisit when total content types crosses ~30 or when
the first regression caused by a missed sync ships to prod, whichever comes first.

### BL-07: `content_warnings` (soft height) — wiring to `/api/result`

**Status:** ✓ closed 2026-06-02. Реализовано так:
- Сервер отдаёт `scheme.content_warnings[]` с минимумом полей
  `{warning_code, content_type, zone_id}` — БЕЗ engine-текста, потому
  что текст движка раскрывает внутренние параметры
  («комфортная высота 16 см»).
- Тексты предупреждений лежат на фронте в `WARNING_TEXT`
  (content-labels.js) с шаблоном `{category}`, рендерер
  (renderWarnings) подставляет ru-категорию через LABEL.
- Принцип «копирайт на фронте» соблюдён (api-contract.md:147).

Старое описание сохраняю для истории:

**Problem:** The engine already emits `SchemePayload.content_warnings:
SoftHeightWarning[]` with a fully built ru-text message
(`buildSoftHeightMessage` in `engine/fit/generateDepthStackCandidates.ts`).
The result page (`landing_design/result-render.js:156`) already has a renderer
(`renderWarnings`) that reads `content_warnings`, draws an «Обратите внимание»
card, and marks affected zone blocks with a `!` badge.

The wiring gap is on the server: `server/api/result.ts` doesn't project
`scheme_payload.content_warnings` into the public response, so the renderer
never receives the array even when warnings exist.

**What needs to be decided before shipping:**
1. Are the engine-built ru-texts copy-acceptable as-is, or should the
   server replace them with curated product copy keyed by `warning_code`?
2. Should the warning show on both `fit_all` and `fit_partial`, or be
   suppressed when fit isn't perfect anyway (overlap with no-fit messaging)?
3. UX of the `!` badge on the scheme block — final design or first-pass?

**Suggested next step:** revisit together with the result-page copy pass.
Until then, server simply doesn't expose the field; renderer no-ops on the
empty array.

### BL-08: In-block layout visualization (cells / slots / lanes)

**Status:** open — current renderer draws each `assigned_zone` as a flat
colored rectangle with a category label. The internal division pattern
(cells grid, slot rows, multi-lane splits, dividers) is invisible.

**Why it matters:** the engine already decides exactly how the zone is
divided (`division_type`, `calculation_mode`, `calculated_cols`,
`calculated_rows`, `lanes_needed`, `split_lane_zone`, `slot_lane_gap_cm`).
Showing it on the scheme would make «bras: 4 lanes × 2 cups», «socks: 4×4
cells», «open box for tights» visually obvious — closes the gap between
the algorithm's intent and the user's expectation of what they'll be
buying/folding into.

**What needs to be designed:**
1. Visual language per `division_type`:
   - `cells`: grid lines (`calculated_cols × calculated_rows`)
   - `slots`: parallel vertical bars (one per item, gap = `slot_lane_gap_cm`)
     with multi-lane case (`lanes_needed > 1`) drawn as N adjacent stacks
   - `open`: no internal lines, maybe a subtle "box" outline
   - `dividers`: vertical dividers at calculated positions
2. Server contract: which fields move into the public `scheme.assigned_zones[]`
   (currently we expose only x/y/w/d/h). At minimum need
   `division_type`, `calculated_cols`, `calculated_rows`, `lanes_needed`.
3. Scale handling: lines/cells should remain readable on the smallest blocks
   (eg. 25×20cm zones); below some threshold, fall back to a number badge.
4. Interaction: hover/tap → tooltip with the exact internal counts
   («4 ряда × 5 ячеек = 20 пар»).

**Suggested next step:** design after the catalog/affiliate ship (Stage 1
complete). Tight rendering loop here is medium-effort; backend exposure of
internal layout fields is the simpler half.

### BL-09: Affiliate URL coverage audit + normalization

**Status:** open — non-code task; result-page already links cards to
`sku.product_url` directly, regardless of affiliate status.

**Problem:** the `sku.product_url` column in production is partially
populated with affiliate links and partially with non-affiliate (plain
marketplace search results or Yandex CPC tracking URLs that don't earn us
commission). One example: `UM-SKU-034` points at
`market.yandex.ru/card/...?sponsored=1&cpc=...` — the `cpc` token is
Yandex's own click-tracking from search, not our affiliate ID; clicks
through it monetize Yandex Direct, not us.

**Why deferred:** writing the auditor / migrator is straightforward, but
the gate is *business*: signing up for affiliate programs (WB Партнёры,
Ozon Партнёры, Yandex.Market Affiliate / Admitad), getting a `partner_id`
/ `subid` per platform, and re-deriving partner URLs from the public
product page. Until those accounts exist, there's nothing to migrate to.

**Suggested next step:**
1. Pick programs and register: WB Партнёры, Ozon Партнёры, Admitad (covers
   Yandex, AliExpress, etc.).
2. Once partner IDs are known, write a script that walks `sku.product_url`,
   parses the marketplace and product ID, rebuilds the partner URL with
   our `subid` (use `configuration_id` template — needs server-side
   substitution if subid must be per-click).
3. Schedule periodic re-audit (links rot; affiliate URLs sometimes expire).

Until done: MVP ships with mixed coverage. Clicks still work, monetization
is partial.

### BL-10: Promo code system (Stage 3 dependency)

**Status:** scoped — database design agreed, business design (which codes,
when, what discounts) — owned by product. Implementation deferred until
Stage 3 (YooKassa integration), because promo codes are no-op in the
dev-bypass mode (`PAYMENT_REQUIRED=false`, `orders.status='sent_free'`
regardless).

**Scenarios to support (all three):**
- **(a) Discount codes** — `EARLYBIRD20` = -20%, `NY2026` = -50 ₽, with
  expiration and usage caps.
- **(b) Free codes for friends/testers** — `FRIENDS` = 100% off,
  `orders.status='sent_free'`, bypasses YooKassa entirely. Useful as a
  permanent backdoor for known users even after `PAYMENT_REQUIRED=true`.
- **(c) Tracking codes** — `ALEX2026` = 0% discount but logs the source
  in `orders.promo_code_id`. UTM-equivalent but in our own DB.

**Schema (migration `0003_promo_codes.sql`, to be written):**

```sql
CREATE TABLE promo_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,         -- 'FRIENDS', 'EARLYBIRD20'
  discount_type   text NOT NULL CHECK (discount_type IN ('percent','fixed','free')),
  discount_value  int NOT NULL,                 -- % or kopecks; 100 for 'free'
  max_uses        int,                          -- NULL = unlimited
  uses_count      int NOT NULL DEFAULT 0,
  valid_from      timestamptz,
  valid_until     timestamptz,
  notes           text,                         -- internal: why created
  is_active       bool NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders
  ADD COLUMN promo_code_id uuid REFERENCES promo_codes(id),
  ADD COLUMN discount_kop  int NOT NULL DEFAULT 0;
```

`discount_kop` is denormalized on purpose: if the parent `promo_codes`
row is later edited (rate change, deactivation), historical orders keep
their original discount. Same pattern as `configuration_skus.set_quantity_snap`.

**Endpoints (to be written in Stage 3):**
- `POST /api/promo/validate` — `{code} → {valid, discount_type, discount_value, message?}`.
  Returns 400 with reason if expired/exhausted/inactive/not-found.
- `POST /api/order/create` — accepts optional `promo_code`, re-validates
  server-side, computes discount, sets `orders.amount_kop` and
  `discount_kop`. If discount_type='free' → `orders.status='sent_free'`
  immediately, no YooKassa call.

**Frontend (Stage 3):**
- Form on `/result/` near email submit: `[input promo code] → live validation`
- Show `«Скидка X% / -Y ₽ → итого Z ₽»`

**Open product decisions (Dzera owns):**
- Naming convention (descriptive vs short vs gift-card-style random)
- Initial set of codes for soft launch
- Whether codes are case-sensitive (recommend no — store and compare in lowercase)
- One code per order, or can stack? (recommend one — stacking gets messy fast)

### BL-11: `fit_partial` — что показывать пользователю

**Status:** open — текущее поведение временное. Решение принимается
**на основе данных из реального трафика**, не заранее.

**Текущее поведение (после фикса 02.06):** при `fit_partial` юзера
редиректят на `/no-fit/?t=TOKEN` со стандартным текстом «не подошло».
Реализовано так согласно решению №8 в `docs/api-contract.md`:
жёстко, потому что **деньги берём только за `fit_all`**, а
`fit_partial` означает «часть категорий не влезла» — за половинчатый
расчёт платить нельзя.

**Проблема:** `fit_partial` это не то же самое что `fit_none`.
- `fit_none` = вообще ничего не помещается (например ящик 10×10×10).
- `fit_partial` = из 5 категорий влезли 3, на 2 места не хватило.

Сейчас оба случая выглядят одинаково — текст «не подошло, оставь
email». Юзер не понимает, что у него **почти** получилось, и какие
именно категории не влезли. Это плохой UX: впечатление неудачи там,
где система могла бы предложить «уберите 1–2 категории → всё влезет».

**Что нужно решить:**
1. Показывать ли юзеру список не влезших категорий (`unplaced_zones`
   из движка)? Если да — где: на `/no-fit/` отдельной плашкой, или
   на новой странице `/partial/`?
2. Предлагать ли «попробовать снова без [категория X]»? Как
   технически — кнопка которая снимает категорию и шлёт новый POST?
3. Тон сообщения: «увы, не всё влезло» vs «почти получилось,
   уберите X — и всё поместится».
4. Email-шаблон: оставлять кнопку «прислать вариант» на /no-fit/
   с одинаковым шаблоном для fit_none и fit_partial, или разный
   email-шаблон под каждый случай?

**Когда решать:** **после публичного запуска**, при подтверждении
достаточного объёма `fit_partial`-кейсов в реальном трафике. Метрика
для триггера в Яндекс.Метрике или БД: если `fit_partial`-заказов за
неделю > 5% от общего объёма — есть смысл делать UX-улучшение
(окупится в виде конверсии). Если < 1% — терпеть, кейс редкий.
Аналитика упущенного дохода из `data-model.md` (SUM amount_kop WHERE
status='created' AND fit_status='fit_partial') покажет финансовый
масштаб проблемы для приоритизации.

**Связано с:** BL-07 (content_warnings — другие предупреждения),
docs/api-contract.md решение №8 (актуальное «жёстко на no-fit»).

### BL-12: Compatibility with Russian antivirus suites

**Status:** open — observed in production with Kaspersky on author's
laptop: POST `/api/calculate` got silently intercepted, the request
never reached the server, no error was visible to the user. fetch's
`.catch` did fire (the `gc.kis.v2.scr.kaspersky-labs.com` scan endpoint
returned 400 to Kaspersky internally), but the rejection looked like a
generic network error in Chrome.

**Why it matters:** Kaspersky is widely deployed in Russia, especially
among women 35+ — a chunk of our target audience. Other AVs (Dr.Web,
Avast, Norton in Russian build) likely behave similarly. If 10% of
intended buyers hit a wall, that's 10% lost revenue — significant
when the catalog is just starting.

**What's already done (02.06):**
1. Frontend distinguishes HTTP errors (server returned 4xx/5xx) from
   network errors (no response at all). For network errors we show a
   specific message: «Запрос не дошёл до сервера. Возможно, его
   блокирует антивирус или расширение браузера…» with a hint to
   whitelist `umestno-home.ru` or try another browser.
2. On every network-error catch we fire Yandex Metrika goal
   `calc_request_blocked` — so we can measure the loss rate from the
   Metrika dashboard. Metrika beacons usually pass even when /api/*
   is blocked (AVs whitelist them).

**What's not done:**
1. Test matrix across AV+browser combos: Kaspersky+Chrome,
   Kaspersky+Yandex.Browser, Dr.Web+Chrome, Avast+Firefox, Norton+Edge.
   Need to find which AVs actually block, and what request shape
   triggers them (POST? JSON content-type? URL pattern?).
2. If a specific AV reliably blocks our /api/calculate — try
   workarounds: alternative endpoint path (not /api/), form-encoded
   body instead of JSON, GET with query params instead of POST,
   adding a non-suspicious `Accept` header, etc.
3. FAQ entry on the site: «У меня кнопка «Получить расчёт» не работает,
   что делать?» — пошагово как добавить домен в исключения Kaspersky /
   Dr.Web / других распространённых AV.
4. Monitor `calc_request_blocked` goal in Metrika. Если > 5% — нужно
   решать раньше; если < 1% — терпимо до следующей итерации.

**Suggested next step:** дождаться первой партии реальных юзеров,
посмотреть в Метрике сколько раз стрелял `calc_request_blocked`,
тогда уже решать стоит ли тратить силы на обходы.

### BL-13: Переделать механику dev-обхода (`sent_free`) после релиза

**Status:** open — `sent_free` сейчас транзитная реализация для dev-режима
разработчика, чтобы инженер мог гонять флоу без поднятой YooKassa.

**Текущее поведение (dev-режим, `PAYMENT_REQUIRED=false`):** сервер
при `INSERT orders` для `fit_all` сразу выставляет `status='sent_free'`,
`amount_kop=0`. YooKassa не дёргается. В проде `PAYMENT_REQUIRED=true`
всегда, `sent_free` для новых заказов не выставляется. В исторических
данных `sent_free` может оставаться как след dev-периода до запуска
(`paywall` модель — единственная боевая, см. `docs/data-model.md`,
секция «Жизненный цикл»).

**Проблема:** статус `sent_free` создаёт «лишнюю» ветку в логике
гейтинга `/api/result/:token` и `/api/pdf/:token`, причём эта ветка
существует **только ради dev-удобства**. Это смешение dev-инфраструктуры
с бизнес-логикой.

Также «дать заказ бесплатно вне dev» нам потенциально нужно для:
- внутреннего тестирования (свои IP, staging-окружение)
- ситуаций поддержки («у клиента не сработала оплата, дайте ему доступ»)
- демо для партнёров

**Варианты на ревизию (после релиза):**
1. **Удалить `sent_free` из enum**, переделать dev-обход на
   автоматически применяемый системный промокод `DEV_BYPASS` (записан
   в `promo_codes` с `discount_type='free'`, applied при
   `PAYMENT_REQUIRED=false`). Это унифицирует логику «бесплатно» под
   один механизм (promo).
2. **Оставить `sent_free`**, но использовать только для админов /
   support-overrides. Dev-обход перевести на автопромо как в (1).
3. **ADMIN_IPS-style whitelist** на платёжный шаг — добавленные IP
   обходят оплату с `status='paid', amount_kop=0`. Промо не используется.

**Зависимости:** связано с BL-10 (promo_codes — там придумывается
вся механика скидочных кодов). Решать вместе.

**Когда:** после публичного запуска, в течение первых 2–3 месяцев
прода, когда станет понятно реальное использование статусов.

## Codex workflow rule

After every completed iteration:

1. Run tests/checks.
2. Commit changes.
3. Push the current branch.
