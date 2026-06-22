# Уместно — Единая архитектура продукта, движка, матчинга, данных и будущей линейки

> **Тип документа:** архитектурный memo для основателя, product lead, tech lead и разработчиков.
> **Статус:** предложение к принятию (одна архитектура, а не каталог мнений).
> **Горизонт:** MVP → промежуточная → целевая, 6–12 месяцев.
> **Дата:** 22 июня 2026.
>
> **Что это.** Сведение всех приложенных материалов (`umestno_final_architecture_v5`,
> `UMESTNO_ARCHITECTURE_v3_1`, `umestno_architectural_memo`, техническое
> `Zaklyuchenie_matching_SKU`, Design-бриф, исследования отзывов) и source-of-truth
> репозитория (`ARCHITECTURE.md`, `README_ENGINE.md`, `engine/sku/SPEC.md`,
> `engine/sku/REDESIGN.md`, `docs/api-contract.md`, `docs/data-model.md`,
> `db/migrations/*`, фактический код `engine/`, `server/`) в **одну непротиворечивую
> архитектуру**. Конфликты разрешены явно (раздел 2), привязка — к реальным
> `file:line`.
>
> **Иерархия источников при конфликте** (по убыванию): (1) явные продуктовые решения
> основателя; (2) эмпирика реальных прогонов и фактическое поведение кода; (3) текущие
> source-of-truth доки; (4) пользовательские исследования; (5) архитектурные memo
> аналитиков как *proposals*.
>
> **Принятые допущения** (помечены `[ASSUMPTION]` по тексту), поскольку ТЗ требует не
> задавать уточняющих вопросов до анализа: пороги допусков, N модулей на зону, порог
> элегантности и т.п. даны как *provisional policy* с условием пересмотра по данным.

---

## 1. Резюме для основателя (без технического жаргона)

**Что мы продаём и в чём разрыв.** Уместно продаёт не картинку и не список товаров, а
**состояние ящика после раскладки**: ровные зоны, вещи на местах, понятный план покупки.
Сегодня движок честно рисует красивую схему, но **подбор товаров под неё спотыкается**:
он ищет один идеальный товар под уже зафиксированную, косметически раздутую зону и при
малейшем расхождении формы отдаёт «ничего не нашли». В реальных заказах это даёт пустые
и странные результаты при геометрически верной схеме.

**Что принимаем.** Один принцип: **первичен DesignIntent** — красивое, функционально
правдивое, бытово удобное и реализуемое состояние ящика. Всё остальное (расчётная зона,
назначенная зона, конкретный товар, текущая логика раздува D04b) — служебные механизмы,
которые имеют право меняться ради этой цели. Движок и матчер начинают **разговаривать до
финальной схемы**: движок считает потребность и предлагает красивую форму; матчер
возвращает **ландшафт способов реализации зоны** (один товар, два-четыре одинаковых
модуля, набор, разделители, открытый лоток или «рынок не закрывает»), а не один
ближайший товар; движок в пределах **косметического бюджета** двигает только
договороспособные размеры и выбирает лучшее решение. Всё рассмотренное — включая то,
что было бы идеально без ограничений рынка, — пишется в **Design Demand Ledger**.

**Почему это улучшит продукт.** (1) Меньше ложных «не нашли»: реальный кейс «зона 31 см,
товар 32 см» решается сдвигом на 1 см, а не отказом. (2) Схема остаётся красивой —
эстетика и удобство остаются жёстким полом, рынок не диктует дизайн. (3) Одна зона может
честно собираться из 2–4 одинаковых модулей, и пользователь видит **одну** понятную
схему и **один** план сборки, а не маркетплейсную простыню. (4) С первого реального
расчёта копится чистая карта того, чего рынку не хватает.

**Что делать первым.** Не глобальный оптимизатор. Сначала — **корректность матчера**
(раздельные ворота для ячеек/слотов/открытых/наборов, асимметричные допуски ячейки,
разнесение «подходит вещи» и «влезает в ящик»), затем **probe-режим** (увидеть товар
чуть больше зоны как «чинибельный overfill») и **один локальный переговорный проход**,
и с самого начала — **журнал спроса**. Это малый, безопасный для текущего стека объём.

**Что будет через 6–12 месяцев.** Сервис, который (а) почти всегда выдаёт красивый
реализуемый результат с честным уровнем уверенности, (б) накопил карту повторяющихся
идеальных схем и настоящих дыр рынка, (в) на этой карте запускает **собственную линейку**
органайзеров под наши частотные зоны и **premium-custom** под редкий дорогой спрос.
Рынок перестаёт быть потолком красоты.

**Одной строкой.** Не схема без рынка и не рынок вместо схемы, а **со-проектирование**:
движок проектирует, матчер описывает способы воплощения, данные хранят всё, чего рынку
не хватило.

---

## 2. Синтез источников и разрешение конфликтов

Не усредняю. Для каждого существенного конфликта — позиции, эмпирика, **одно** решение,
последствия, какие доки правим. Полная сводка решений — в decision-table (раздел 20).

| # | Конфликт | Позиции источников | Эмпирика / код | Финальное решение | Последствия | Доки к правке |
|---|---|---|---|---|---|---|
| C1 | Что первично: CalculatedZone или AssignedZone | memo v1: «AssignedZone — лицо и target»; ранние тексты: «матчить по calculated» | Обе сущности уже есть (`engine/types.ts:53,60`); спор бесплоден | **DesignIntent-first.** Calculated = функциональный пол, Assigned = материализация выбранного DesignSolution, обе служат цели | Снимается дихотомия; вводится слой DesignIntent/DesignSolution | ARCHITECTURE.md, README_ENGINE.md |
| C2 | По какой геометрии матчить: `need` (zone_*) или `assigned` (assigned_*) | REDESIGN.md §2: целимся в `assigned`; ранняя идея: целиться в `zone_d` | Заключение §В3: «матчить строго под need — тупик»: LaDom 24 см не влезает в need 19, но влезает в assigned 31 (`matchSkus.ts:47-48` берёт `assigned_*`) | **Probe целится в need-anchored target + repair budget; final целится в согласованный assigned.** Внутренняя пригодность считается от `need`, внешний footprint — от финальной зоны/ящика | Разводим internal suitability и external footprint; `assigned` пересчитывается каталог-aware | SPEC.md, README_ENGINE.md, REDESIGN.md |
| C3 | Одна зона = один SKU? | Текущий матчер: один `SkuMatch`/зону (`matchSkus.ts:320`) | Реальные кейсы требуют 2–4 модуля; `composed_from_slots` уже частный случай | **Матчер возвращает RealizationOptions** (single / repeated / tiled / composed / divider / open / custom). `single` = частный случай | Меняется контракт матчера; UX показывает один план | SPEC.md, api-contract.md |
| C4 | Overfill: сразу no_match? | Текущее: hard-фильтр «влезает в зону» (`fitsFootprint` `matchSkus.ts:55`) | Кейс 120×45: носки 31/бра 31 vs товар 32 = +1 см режется до ранжирования | **Probe видит repairable overfill; final — никогда.** +1–2 см → запрос к negotiation, не отказ | Новый probe/final split; confidence не спасает отрезанного кандидата | SPEC.md |
| C5 | Монетизация: affiliate или платный результат | `ARCHITECTURE.md:11` «доход — affiliate-комиссия»; `docs/data-model.md` «paywall 149 ₽ — единственная боевая модель, affiliate — добавка» | data-model новее и детальнее, описывает весь lifecycle | **Paywall первичен, affiliate — добавка.** | Закрыть drift | **ARCHITECTURE.md** (привести к paywall-first) |
| C6 | `exact` — омоним | v3_1/v5: технический `exact` путается с пользовательским «точно» | `MatchStatus='exact'` (`matchSkus.ts:16`), таблица `configuration_skus.match_status` (`0001_init_schema.sql`) | **Technical: `exact`→`primary_match`. Public confidence — отдельный слой** (exact/compatible/acceptable/workaround/none) | Миграция enum + рефактор; апдейт SPEC | SPEC.md, data-model, миграция |
| C7 | Раздув глубины (D04b) — истина или баг | README_ENGINE D04b: «открытый вопрос»; Заключение: безлимитный раздув — патология (носки 19×19→31×32) | `absorbDepthReserve` (в `normalizePlacement`) тянул до стенки; фикс есть на ветке `claude/vibrant-cori-5EmX4` (коммит 046b09f), **в main не смержен** | **D04b — источник косметического бюджета, не финальная истина.** Слайвер-потолок мержим; раздув «в пустоту» запрещён; позже — market-aware normalization | Мерж фикса; D04b становится переговорным slack | README_ENGINE.md, REDESIGN.md |
| C8 | Ёмкость: от `count` или от `assigned` | Текущее: `cap_per_lane = count` (`matchSkus.ts:44`) | Заключение §В4: лишнее косметическое место — ресурс, не пустота | **Ёмкость считать от assigned-зоны, отдавать «поместится до N».** `need` остаётся полом потребности | Меняется выдача ёмкости и copy; не путать с раздуванием обещанной потребности | SPEC.md, README_ENGINE.md |
| C9 | Сколько архитектурных memo принять | Три proposal: memo (SkuMatchTarget, 5 правд), v3_1 (три правды + reconciliation), v5 (DesignIntent + RealizationOptions + Ledger) | v5 — наиболее полный и поздний; явно надстраивает прочие | **Базис — v5.** `SkuMatchTarget` из memo = probe-контракт; reconciliation из v3_1 = инвариант I9 «экран=реальность» | Один документ-истина (этот) | ARCHITECTURE.md ссылается сюда |
| C10 | Открытость алгоритма во `why_this_layout` | api-contract решение №1: тексты «почему» — фронтовый копирайт, сервер не шлёт | Фронт уже берёт из `content-labels.js` | **Подтверждаю: negotiation/probe/ideal — не в API.** Публичны только зоны, товары, confidence, note_code | Без изменений, фиксируем как инвариант I11 | — |

**Drift доков и кода (зафиксировать отдельно):**
- `ARCHITECTURE.md:11` (income=affiliate) ↔ `docs/data-model.md` (paywall-first). → C5.
- Слой `adjustment` существует (`engine/adjustment/runAdjustmentLoop.ts`), но в бою
  передаётся `null` (`engine/index.ts:55,59`); зовётся только из калибровки
  (`engine/calibration/buildCalibrationCaseReport.ts:30`). README_ENGINE описывает
  стадию «Reserve/Adjustment» как живую — **drift**.
- Матчер целится в косметический `assigned` (`matchSkus.ts:47-48`), хотя доки трактуют
  цель как «правду» — **drift**, разрешён C2.
- Безлимитный `absorbDepthReserve` в main; фикс на ветке не смержен — **drift**, C7.
- `engine/sku/SPEC.md` в одном месте задаёт симметричный `±1.5` cell_depth; код уже
  асимметричный `-1.5/+3` (`matchSkus.ts:13`) — частично пофикшено, SPEC дочистить.

---

## 3. Продуктовые принципы и инварианты

### 3.1. Неотменяемые продуктовые принципы
1. Сервис формирует **оптимальную схему хранения**, а не подбирает отдельные органайзеры.
2. Пользователь покупает **состояние ящика после раскладки**, не каталог.
3. Рыночные товары — **временный слой реализации**, не финальная истина.
4. Одна проектная зона реализуется одним SKU, 2/4 одинаковыми модулями, однородным
   тайлингом, набором, композицией, разделителями, open-решением, будущим своим изделием
   или custom. **`одна зона = один SKU` запрещено как допущение.**
5. Пользователю показываем **одну цельную выбранную схему и один понятный способ её
   собрать** (+ ограниченные альтернативы). Никаких «наборов A/B/C на выбор».
6. Конечная цель — не только match rate, но **чистая карта дыр рынка**.
7. Диалог с рынком **не стирает идеальный спрос**: храним idDeal/market/compromise/что
   сняло бы компромисс.

### 3.2. Технические границы (не нарушать)
- Engine, `matchSkus`, каталог, библиотеки A–E, layout rules — **только на сервере**.
- Engine **не делает прямой I/O в Postgres**; каталог приходит как versioned snapshot.
- Frontend не получает: `engine_output`, debug, `unit_*`, `item_gap`, match scores,
  nearest-fit vectors, layout candidates, fallback internals, affiliate URL, manufacturing
  analytics (закреплено `docs/api-contract.md` «Что НЕ отдаём»).
- Публичный API — curated, **contract-first** (доки → типы → сервер → фронт).
- Движок **детерминированный, rule-based**. Никакого неограниченного solver/недетерминизма.
  Один `input + engine_version + policy_version + catalog_snapshot` = воспроизводимый
  результат.
- Не ломать семантику: `set_quantity`, `lanes`, `composed_from_slots`,
  `alternative_division`; `can_split` = деление **родительской** зоны, а не внутренняя
  композиция модулей.

### 3.3. Полный набор инвариантов
| ID | Инвариант | Смысл |
|---|---|---|
| I0 | DesignIntent first | Ни одна техническая сущность — не самоцель. |
| I1 | Functional truth is hard | Capacity, пригодность ячейки, высота, доступ, drawer-fit нельзя ухудшить ради SKU. |
| I2 | Aesthetic & usability floor | Нельзя выбрать хаотичную/неудобную схему только потому, что под неё есть товар. |
| I3 | Cell suitability ≠ footprint fit | Бóльшая допустимая ячейка **не** увеличивает зону автоматически. |
| I4 | Probe may exceed; final may not | Probe видит repairable overfill; финальный SKU обязан помещаться в финальную зону. |
| I5 | Whole-drawer non-overlap | После любой правки заново проверяются все зоны, границы ящика, functional minimum соседей. |
| I6 | Matcher returns a landscape | Матчер возвращает варианты реализации, а не приказ «сделай под этот SKU». |
| I7 | Cosmetic dimensions are negotiable | Slack от выравнивания/D04b перераспределяется в пределах бюджета; `need` неприкосновенен. |
| I8 | Bounded & deterministic | Ограниченное число кандидатов/итераций; повтор даёт тот же результат. |
| I9 | Screen = reality (reconciliation) | Финальная схема пересобирается под фактически выбранные товары; недозаполнение рисуется ровной полосой «свободный край». |
| I10 | Rejected demand is retained | Невыбранный красивый кандидат и дорогая адаптация сохраняются как assortment evidence. |
| I11 | Scheme quality beats coverage | Случайная mixed-композиция не становится хорошей только потому, что закрывает площадь. |
| I12 | Private mechanics | Ideal specs, probes, scores, negotiation — не в public API. |
| I13 | One parent zone may host modules | Несколько внутренних модулей в одной родительской зоне не нарушают семантику `can_split`. |
| I14 | Confidence ≠ match_status | Пользовательский confidence — отдельный слой от технического пути. |
| I15 | Compromise never raises confidence | Любой компромисс только понижает/ограничивает confidence. |
| I16 | Quality caps confidence | Хлипкий SKU ограничивает confidence независимо от geometry fit. |
| I17 | `deformation_risk` неприкосновенен | Бюстгальтеры/деликатные не пережимаем: только точный матч или gap, никогда компромисс. |

---

## 4. Аудит текущей архитектуры (as-is)

### 4.1. Пайплайн (фактический, `engine/index.ts:22-60`)
```
normalizeInput → validateInput → volumeToCount → buildStorageRequirements
→ generateZoneVariants → generatePlacementCandidates → selectBestCandidate
→ normalizePlacement(alignColumns + absorbDepthReserve)   // D04b: появляется assigned_*
→ matchSkus → runSkuFitCheck → buildFinalResultPayload → buildDebugTrace
```
Поток **односторонний**. `adjustment` передаётся `null` (`engine/index.ts:55,59`) —
переговорного слоя в бою нет, хотя `engine/adjustment/runAdjustmentLoop.ts` существует
(зовётся лишь из калибровки).

### 4.2. Две геометрии зоны (это уже есть)
- `need`: `zone_w/d/h_cm` — потребность вещи + зазоры + сетка
  (`generateZoneVariants`→`calculateCellsZone`/`calculateSlotsZone`). Суверенна.
- `assigned`: `assigned_w/d/h_cm` — косметика поверх `need` (`normalizePlacement`:
  `alignColumns` выравнивает ширину + поглощает слайверы < 8 см; `absorbDepthReserve`
  заполняет глубину позади). **Матчер берёт `assigned`** (`matchSkus.ts:47-48`) — корень
  искажений (Заключение P1).

### 4.3. Матчер (`engine/sku/matchSkus.ts`, 378 строк)
- Возвращает **один `SkuMatch` на зону** (`.map`, `:320`); `candidates[]` — альтернативы
  **одного** изделия, не набор.
- Ворота — AND-цепочка `baseFilterGates` (`:114-161`), ветвление по `division_type`:
  - `cells`: `cell_fit` (обе ориентации) + `capacity` + `footprint` + `height`.
  - `slots`: `cell_width`/`cell_depth` направленные + `capacity` + `footprint`.
  - `open`: **только** `footprint` (правильно: без cell/capacity — пофикшено B2).
  - `adjustable` (соты): `adaptiveCellsFit` — сколько ячеек влезает в зону vs потребность;
    **считает от раздутой `lane_w/d`** (`:67-76`) → соты проходят за счёт раздува (P5).
- Допуски — **глобальный хардкод** `TOL={cellW:3,cellDUnder:1.5,cellDOver:3,hUnder:3,hOver:5}`
  (`:13`), одинаковый для всех content_type (REDESIGN Класс 1.1).
- Fallback-пути: `composed_from_slots` (`:329`, только при 0 cells-кандидатов),
  `alternative_division` (`:340`, обычно open). Dividers — PROPOSAL, не реализованы (SPEC).
- `runFilterFunnel`/`explainSkuMatch.ts` — **диагностика** (killer-gate), не боевой путь.

### 4.4. Выбор схемы рынка не видит
`selectBestCandidate` (`engine/fit/selectBestCandidate.ts:10-56`) скорит геометрию и
правила раскладки; каталог в него **не подаётся**. Матчер — постфактум-вердикт.

### 4.5. Данные (фактические таблицы, `db/migrations/0001_init_schema.sql`)
- `sku` (каталог, 54 строки; поля геометрии, `adjustable`, `availability_status`,
  `price_kop`, `fit_risk_notes`, `source_confidence`, `last_checked_at`).
- `configurations(input_payload, engine_output jsonb, fit_status, token)`.
- `configuration_skus(zone_id, units_needed, packs_needed, match_status CHECK
  exact|composed_from_slots|alternative_division|no_match, match_kind, position jsonb)`.
- `sku_no_match_log(zone_*, unit_*, units_needed, preferred_rigidity)` — зачаток data loop,
  **пишет только провалы**, не «почти» и не идеал.
- `orders`-центричная модель + paywall (`docs/data-model.md`).

### 4.6. Эмпирика (реальные заказы, Заключение)
- **Доминирует не только underfill, но и overfill:** носки 31/товар 32 (+1),
  бра 31/32 (+1), трусы глубина 13/cells от 20 (+7).
- **Реальные дыры каталога:** под плоскую ячейку трусов 10×3 см товара нет (P4).
- **Раздув «в пустоту»:** носки 19×19→31×32 (P2, фикс на ветке, **не в main**).
- **Соты пухнут от зоны:** ёмкость 12–18 вместо 8 (P5/P7).
- Уже исправлено в main: асимметричный cell_depth (B1), open без cell-ворот (B2),
  обе ориентации ячейки (B3), соты как `cells+adjustable` вместо `dividers` (B4).

### 4.7. Что уже соответствует целевой модели (не ломать)
Scheme-first; две геометрии зон; deterministic 2D fit; lanes; `set_quantity`,
`composed_from_slots`, `alternative_division`; engine/каталог только на сервере;
contract-first API; Postgres — source of truth каталога; `sku_no_match_log` как зачаток.

---

## 5. Целевая доменная онтология

Точные определения, ответственность, инварианты. Колонка **Жизнь** кодирует: `R` runtime,
`P` persisted, `A` analytical, `Pub` public, `Int` internal, `T` только target, `M` нужно
уже в MVP.

| Сущность | Определение / ответственность | Инварианты | Жизнь |
|---|---|---|---|
| **DesignIntent** | Продуктовая цель: эстетически цельный, функционально верный, бытово удобный, реализуемый ящик. Не структура данных, а приоритет. | I0 главенствует над всеми. | R, M |
| **FunctionalNeed** | Потребность вещей: counted_items, units, секции, capacity, высота, доступ. Рынок не участвует. | Не мутирует от рынка/красоты (I1). | R, M |
| **CalculatedZone** | Минимальное функциональное ядро от `FunctionalNeed` (`zone_*`, cols×rows/lanes, rigidity). | Функциональный пол, не финальная эстетика; не растягивается ради схемы. | R, P(jsonb), M |
| **IdealDesignSpec** | Какой внешний footprint и внутренняя логика **идеально** воплотили бы DesignIntent **до** рыночной адаптации. | Сохраняется всегда, даже если выдали компромисс (I10). | A, P, M(минимально) |
| **DesignCandidate** | Один эстетически и функционально допустимый вариант **всей** схемы. | ≥ functional floor и ≥ aesthetic floor. | R, M(1–2 шт) |
| **CandidateZone** | Зона внутри конкретного DesignCandidate (proposed box + functional constraints). | calculated ⊆ candidate ⊆ drawer. | R, M |
| **SkuMatchTarget** | Запрос движка матчеру по зоне: `proposed_box + functional_constraints + allowed_realization_modes + repair_budget + policy_version`. Производная, не стадия. | Разводит functional_min и visual_assigned (C2, I3). | R, M |
| **RealizationOption** | Один способ реализовать зону (single/repeated/tiled/composed/divider/open/custom). | Хранит combined_outer_box отдельно от internal_suitability (I3). | R, A, M(подмн.) |
| **SingleSkuRealization** | Один SKU закрывает зону. | external_fit ≤ зона (final). | R, M |
| **RepeatedModuleRealization** | 2/4 **одинаковых** модуля = одна зона. | Однородность; combined box ≤ зона. | R, M(огранич.) |
| **HomogeneousTiledRealization** | Однородный тайлинг (2×1,1×2,2×2,row,col). | Тот же SKU; non-overlap внутри зоны. | R, T(полно), M(огранич.) |
| **MixedCompositionRealization** | Разные SKU в одной зоне. | Высокий complexity penalty; **не основной путь до target**. | R, T |
| **DividerRealization** | Набор разделителей формирует сетку. | Эмёрджентная ячейка; `divider_workaround`, low confidence. | R, T |
| **OpenFallbackRealization** | Открытый лоток вместо деления. | Без cell-ворот; footprint+height+usability. | R, M |
| **MarketProbe** | Прогон матчера в probe-режиме по CandidateZone: survivors, killer_gate, nearest-fit, repairable_overfill. | Может видеть overfill (I4); не выбирает финал. | R, A, M |
| **NearestFitVector** | Разница между proposed zone и внешней геометрией реализации (`{depth:+13,...}`), отдельно от cell suitability. | Только probe; не публичен. | R, A, M |
| **NegotiationAction** | Одно переговорное действие (`micro_snap`/`reallocate_slack`/`shift_neighbor`/`switch_pattern`). | В пределах cosmetic budget; после — I5. | R, A, M(micro) |
| **NegotiationBudget** | Бюджет правок: micro(0–2), moderate(2–5), major(>5). | Policy constants; матчеру не даёт права расширять зону. | R, M(micro) |
| **DesignSolution** | Выбранная итоговая схема после переговоров. | Лучший по selection policy (раздел 9). | R, P, M |
| **AssignedZone** | Runtime-геометрия зоны выбранного DesignSolution (`assigned_*`, x/y). | calculated ⊆ assigned ⊆ drawer; не догма (I0). | R, P, Pub(подмн.) |
| **VisualZone** | Рендер-проекция AssignedZone (цвет, подпись, внутренняя разлиновка cells/slots/lanes). | Не источник расчёта; не для матчинга; без engine-internals. | Pub, M(частично, BL-08) |
| **MarketCandidate** | Строка каталога + способ применения к зоне. | Не «готовый набор»; модуль схемы. | R, A | 
| **SelectedRealization** | Финальная реализация зоны: SKU/модули/ориентация/packs/confidence. | Физически влезает (I4). | P, Pub(подмн.), M |
| **RecommendationConfidence** | Пользовательская оценка: exact/compatible/acceptable/workaround/none. | ≠ match_status (I14); компромисс не повышает (I15); quality ограничивает (I16). | Pub, M |
| **DemandGap** | Повторяющийся footprint-кластер с систематическим no/near-match. | Определяется **после** рассмотрения реализаций, не по первому no_match. | A, M(сбор) |
| **MarketHoleSignal** | Чистый сигнал, что идеальную/частотную потребность рынок не закрывает надёжно. | gap_type классифицирован (раздел 11). | A, P, M(сбор) |
| **ManufacturingSignal** | Агрегат: частота + severity + accommodation cost + intent → решение о производстве. | Защита от false gaps; мин. объём данных. | A, T |
| **FutureOrganizerSpec** | Производственная спецификация своей линейки/custom. | Ядро+резерв; не сырой AssignedZone. | A, T |
| **ResultPromise** | Контракт «что видишь — то соберёшь»: уровень уверенности + конкретный план + свободный край. | Соответствует I9; без процентов/внутренностей. | Pub, M |

**Что существует только в target:** ManufacturingSignal, FutureOrganizerSpec, полноценные
Mixed/Divider realizations, market-size families, global re-solve. **Что нужно уже в MVP:**
FunctionalNeed, CalculatedZone, минимальный IdealDesignSpec, SkuMatchTarget, MarketProbe,
NearestFitVector, micro NegotiationAction, DesignSolution, AssignedZone,
RecommendationConfidence, ResultPromise, сбор DemandGap/MarketHoleSignal.

---

## 6. Целевая системная архитектура

```
                          ┌──────────────────────────────────────────────┐
                          │            SERVER (internal only)            │
USER INPUT                │                                              │
 drawer, items, ──────────┼─► orchestrateCalculation(input, libs, catSnapshot)
 priority, color          │      │                                       │
                          │      ▼                                       │
                          │  buildFunctionalModel ──► FunctionalNeed / CalculatedZones
                          │      │                         │  (правда о вещах)         [DATA] input+need
                          │      ▼                         ▼                                   │
                          │  generateDesignCandidates ─► IdealDesignSpec + DesignCandidates    │
                          │      │   (эстетически допустимые схемы; aesthetic/functional floor)│
                          │      ▼                                                              │
                          │  probeRealizationLandscape(candidates, catSnapshot) ── MATCHER:probe┤[DATA] options+vectors
                          │      │   ZoneRealizationOptions + NearestFitVectors                 │
                          │      ▼                                                              │
                          │  negotiateLayouts(candidates, probes, policy) ── NegotiationActions ┤[DATA] negotiation
                          │      │   micro-snap / reallocate slack; затем I5 whole-drawer recheck│
                          │      ▼                                                              │
                          │  selectDesignSolution(negotiated, policy) ── lexicographic/Pareto   │[DATA] selected+rejected
                          │      │   DesignSolution + AssignedZones                              │
                          │      ▼                                                              │
                          │  finalizeSkuPlan(selected, catSnapshot) ── MATCHER:final (I4 fit)   │
                          │      │   SelectedRealization per zone (modules/packs/confidence)     │
                          │      ▼                                                              │
                          │  reconcileScheme (I9) ── свободный край ровной полосой              │
                          │      │                                                              │
                          │      ├──► buildPublicResult ──► ResultPromise ──────────► PUBLIC API ──► FRONT/PDF
                          │      └──► buildDesignDemandLedger ───────────────────────► [DATA] Ledger (sidecar)
                          │                                                                     │
                          │  catalog snapshot ◄── loadCatalogFromDb (versioned, engine не I/O)  │
                          └──────────────────────────────────────────────────────────────────────┘
                                                                                           │
                                            Postgres ◄──── operational + analytical ledger ─┘
                                              │
                                              ▼  (offline)
                          Assortment Intelligence ──► DemandGap ──► ManufacturingSignal ──► FutureOrganizerSpec
```

**Ответственность слоёв (и чего НЕ делают):**

| Слой | Делает | Не делает |
|---|---|---|
| Functional Need | counted items, units, секции, capacity, height, access | не оптимизирует под рынок/красоту |
| Design Candidate Generator | эстетически+функционально допустимые схемы, IdealDesignSpec | не выбирает SKU |
| Realization Probe (matcher) | способы реализации + nearest-fit vectors | не объявляет финальную схему |
| Layout Negotiation | распределяет косметический slack, проверяет соседей и whole-drawer | не нарушает functional/aesthetic gates |
| Design Selection | выбирает лучший DesignSolution по policy | не берёт любой SKU ради покрытия |
| Final SKU Planner (matcher) | физически помещающиеся SKU, packs, модули | не допускает overfill/overlap |
| Scheme Reconciliation | пересбор под факт. товары, свободный край | не меняет смысл зоны |
| Result Builder | пользовательская схема + copy | не раскрывает internals |
| Design Demand Ledger | идеал, рынок, переговоры, intent | не зависит только от no_match |

**Где живёт orchestration и как сохраняется purity.** Все вычислительные функции —
**pure TS**, принимают `catalogSnapshot` как вход (engine не ходит в БД). `orchestrateCalculation`
физически может остаться в engine-пакете **или** стать тонким server-side координатором над
pure-функциями — это деталь, не меняющая контрактов. Текущий стек (Node + TS engine +
Postgres) сохраняется. `[ASSUMPTION]` оркестратор — новый модуль `engine/orchestrate/`,
вызывается из `server/api/calculate.ts` вместо прямого `runUmestnoEngine` (обратная
совместимость: `runUmestnoEngine` остаётся фасадом для MVP single-candidate).

---

## 7. Архитектура взаимодействия Engine ↔ Matcher

### 7.1. Текстовая sequence diagram (bounded co-design)
```
Engine          Matcher(probe)      Negotiator        Selector       Matcher(final)   Ledger
  │ functional need + candidate │        │               │               │             │
  ├───────────────►│            │        │               │               │             │
  │   ZoneRealizationOptions    │        │               │               │             │
  │◄───────────────┤ + NearestFitVectors │               │               │             │
  │ accept/reject/reallocate slack ──────►│               │               │             │
  │                │            │ I5 whole-drawer recheck │               │             │
  │ re-probe changed candidate  │        │               │               │             │
  ├───────────────►│            │        │               │               │             │
  │◄───────────────┤            │        │               │               │             │
  │                          choose DesignSolution ──────►│               │             │
  │                                       │   final fit (I4) ─────────────►│             │
  │                                       │               │  SelectedRealization        │
  │                                       │               │◄──────────────┤             │
  │  ideal + options + actions + selected + intent ────────────────────────────────────►│
```
Итерации **ограничены** (`[ASSUMPTION]` ≤ 2 negotiation rounds, ≤ K=5 кандидатов, top-M=8
options/зону). Детерминизм: фиксированный порядок кандидатов/действий + версионирование
`engine/matcher/policy/catalog`.

### 7.2. Контракты (TypeScript-like, не production)
```ts
interface SkuMatchTarget {
  candidate_id: string; zone_id: string; content_type: string; division_type: DivisionType;
  proposed_zone_box: Box;                 // visual_assigned кандидата
  functional_constraints: {               // правда о вещах (от need)
    cell_min: Cell; cell_max: Cell;       // АСИММЕТРИЧНО, per content/division
    capacity_required: number; unit_h: number; rigidity: Rigidity; deformation_risk: boolean;
  };
  allowed_realization_modes: RealizationKind[];
  repair_budget: { micro_cm: number; moderate_cm: number };  // probe only
  mode: "probe" | "final";
  policy_version: string;
}

interface ZoneRealizationOptions { zone_id: string; options: RealizationOption[]; killer_gate?: string; }

interface RealizationOption {
  kind: "single_sku" | "repeated_same_sku" | "homogeneous_tiled"
      | "composed_from_slots" | "divider_set" | "open_fallback" | "mixed_composition" | "custom_needed";
  sku_ids: string[]; module_count: number; orientation: "as_is" | "rotated"; module_layout?: Tiling;
  combined_outer_box: Box;                // EXTERNAL — для layout fit / non-overlap (I3)
  internal_suitability: { cell_ok: boolean; capacity_ok: boolean; deltas: CellDeltas };
  external_fit_class: "fits" | "repairable_overfill" | "hard_overfill";
  nearest_fit_vector: { w: number; d: number; h: number };   // signed cm
  quality_risk_flags: string[]; purchase_complexity: number; assembly_complexity: number;
  availability: "available" | "unknown" | "out_of_stock";
  confidence_ceiling: Confidence;         // quality/availability ограничивают (I16)
}

interface MarketProbe { candidate_id: string; per_zone: ZoneRealizationOptions[]; }

interface NegotiationAction {
  action_type: "micro_snap" | "reallocate_slack" | "shift_neighbor" | "switch_pattern" | "switch_candidate";
  before_box: Box; after_box: Box; source_of_space: "reserve" | "neighbor_slack" | "alignment";
  affected_neighbor_zones: string[]; aesthetic_cost: number; accepted: boolean; rejection_reason?: string;
}
```

### 7.3. Псевдокод оркестрации
```
function orchestrateCalculation(input, libs, catalogSnapshot, policy):
  functional   = buildFunctionalModel(input, libs)             # I1: рынок не участвует
  candidates   = generateDesignCandidates(functional, policy)  # K≤5, aesthetic+functional floor
  best = null
  for cand in candidates:                                      # детерминированный порядок
     probe = probeRealizationLandscape(cand, catalogSnapshot, mode=PROBE)   # matcher: probe
     for round in 0..policy.maxRounds:                         # bounded (≤2)
        actions = planNegotiation(cand, probe, policy.budget)  # micro-snap/reallocate
        if actions.isEmpty(): break
        cand = applyActions(cand, actions)
        if not validateWholeDrawer(cand): cand = rollback(cand, actions); break   # I5
        probe = probeRealizationLandscape(cand, catalogSnapshot, mode=PROBE)
     scored = scoreCandidate(cand, probe, policy)              # lexicographic (раздел 9)
     best   = pickBetter(best, scored)                         # deterministic tie-break
  selected = best ?? bestDesignIntentCandidate(candidates)     # product-protection rule
  finalPlan = finalizeSkuPlan(selected, catalogSnapshot, mode=FINAL)  # I4: must fit
  solution = reconcileScheme(selected, finalPlan)              # I9: свободный край
  return {
    result:        buildPublicResult(solution, finalPlan),     # curated, I12
    scheme_payload: solution,                                  # internal
    analytics:     buildDesignDemandLedger(functional, candidates, probes, actions, selected, finalPlan)
  }
```

### 7.4. Probe vs Final (две роли матчера)
| Режим | Разрешено | Запрещено |
|---|---|---|
| **probe** | видеть SKU/композиции чуть больше зоны в пределах repair budget; вернуть `required_box`, `nearest_fit_vector`, `repairable_overfill` | показывать пользователю физически не влезающий товар |
| **final** | выбирать только реализации, **полностью** влезающие в финальные AssignedZones | любой overfill, overlap, выход за drawer, сжатие соседа ниже functional minimum |

### 7.5. Кто решает и как не уйти в крайности
- **Корректировку зоны решает negotiation/selection layer**, не матчер (I6). Матчер только
  возвращает landscape и vectors.
- **Чтобы рынок не диктовал дизайн:** functional floor (I1) и aesthetic/usability floor (I2)
  — hard gates; при слабом рынке выбирается лучший DesignIntent-кандидат, дыра пишется как
  MarketHoleSignal (product-protection rule, раздел 9).
- **Чтобы движок не игнорировал рынок:** probe участвует **до** финала; negotiation тратит
  косметический бюджет на реализуемость; selection минимизирует число `none`-зон.
- **Проверки на каждой принятой правке:** non-overlap, drawer containment, preservation of
  functional need соседей, aesthetic threshold, purchase simplicity (I5).

---

## 8. Ландшафт реализаций и правила матчинга (per-division)

### 8.1. Типы реализаций, очередность, стадия
Очередь применения (детерминированная, останавливаемся на первом наборе с непустыми
кандидатами в данной стадии; для selection собираем top-M на зону):

| Kind | Смысл | MVP | Intermediate | Target |
|---|---|---|---|---|
| `single_sku` | один SKU на зону | ✅ | ✅ | ✅ |
| `repeated_same_sku` | 2/4 одинаковых модуля, ограниченные паттерны | ✅ (огранич.) | ✅ | ✅ |
| `composed_from_slots` | существующий cells→repeated slots | ✅ (есть) | ✅ | ✅ |
| `homogeneous_tiled` | 2×1/1×2/2×2/row/col тем же SKU | — | ✅ | ✅ |
| `open_fallback` | открытый лоток | ✅ (per-division policy) | ✅ | ✅ |
| `divider_set` | разделители строят сетку | — | ✅ | ✅ |
| `mixed_composition` | разные SKU в зоне | — | — (огранич.) | ✅ (только при scheme quality) |
| `custom_needed` | нет надёжной реализации | ✅ (signal/CTA) | ✅ | ✅ |

**Защита от комбинаторного взрыва:** (1) MVP = `single` + `repeated_same` + текущий
`composed` + `open`; (2) число модулей на зону ограничено `[ASSUMPTION] N≤4` и только
делителями стороны (2×1,1×2,2×2); (3) tiling — **только однородный** (один SKU); (4) на
зону отдаём `top-M=8` options, дальше отсекаем; (5) mixed composition имеет высокий
complexity penalty и в MVP/intermediate не основной путь.

### 8.2. Ранжирование RealizationOptions (после hard gates)
Лексикографически: (1) сохранение functional truth; (2) сохранение DesignIntent/эстетики;
(3) минимальность negotiation cost; (4) **простота покупки** (меньше разных SKU и упаковок);
(5) **простота сборки** (одинаковые модули выше mixed); (6) качество конструкции/reliability;
(7) availability confidence; (8) color/material как второй эстетический слой после формы и
функции. Лишние элементы в наборе (`dirty multipack`) — last resort, ограничивает confidence.
Несколько маркетплейсов: один и тот же модуль с разных площадок — одна логическая реализация,
выбор площадки — по availability/source_confidence, не размножаем варианты пользователю.

### 8.3. Internal suitability ≠ external footprint (критический инвариант I3)
```
Internal check (пригодность ВЕЩИ, от need):  cell/slot size (асимм. tol), capacity, access, rigidity
External check (РАЗМЕЩЕНИЕ, от зоны/ящика):  combined outer box, orientation, zone containment, whole-drawer non-overlap
```
Допуск по ячейке **не** даёт права раздуть зону (I3). Матчер обязан возвращать
**фактический outer box** реализации (а не выводить геометрию зоны как `cell_size × rows/cols`).

### 8.4. Per-division ворота и скоринг

**A. cells.** Hard: `cell_w/d` в асимметричных границах, `capacity_units ≥ need`, footprint
(external), height. Soft: oversize-cell comfort, rigidity, color, fill. Внутренняя
пригодность (ячейка) и внешний footprint — раздельно (8.3). Соотношение capacity↔cell:
адаптивные (`adjustable`) считают realizable cols×rows от зоны (`adaptiveCellsFit`), но —
**от `need`-anchored зоны, не от раздутой** (фикс P5; см. C8: ёмкость «до N» от assigned —
это про **выдачу пользователю**, а проверку прохождения ведём от need, чтобы соты не
«проходили за счёт раздува»).

**B. slots.** Hard: slot/lane-семантика, `capacity ≥ cap_per_lane`, per-lane footprint,
height. Поворот **направленный** (слоты вдоль depth/width — UX), через `composed`. Soft:
lane balance, rigidity, color. `set_quantity`→`packs_needed`; repeated modules — внутренняя
композиция родительской зоны (I13), не spatial split content_type.

**C. open.** Hard: **только** footprint + height + content compatibility. **Без** cell-size
и без стандартной `capacity_units`-логики (у open их нет — регресс B2 не возвращать). Soft:
practical capacity/usability, rigidity/material, fill.

**D. dividers** (target). Hard: `divider_count ≥ (cols−1)+(rows−1)`, `length ≥ пролёт` (или
`cuttable`), эмёрджентная ячейка в асимм. допуске, `height ∈ [unit_h; drawer_h]`. Эмёрджентная
сетка → высокий охват, **низкий confidence** (`divider_workaround`). Запускать последним.

**E. sets/composition.** Hard: combined footprint, capacity, package availability. Soft:
module homogeneity, packs, assembly complexity. `set_quantity > N` отбрасываем (кроме
last-resort dirty с ограничением confidence).

**F. composed realizations.** Существующий `composed_from_slots` — частный случай repeated:
slot-SKU мостит ячеистую нужду. Снять ограничение «только при 0 cells», сделать полноценным
RealizationOption в landscape.

### 8.5. Асимметричные допуски ячейки (заменяют глобальный `TOL`)
```
cell_w_min = ideal_w − strict_under;   cell_w_max = ideal_w + wider_over
cell_d_min = ideal_d − strict_under;   cell_d_max = ideal_d + wider_over
```
Границы задаются **per content_type/division** через библиотеку/policy, не одной глобальной
константой (`matchSkus.ts:13`). Слишком маленькая ячейка чаще ломает функцию; чуть бóльшая
допустима, но штрафуется в density/confidence. Точка отсчёта — **эффективная ячейка**
(`unit + item_gap`), как уже в коде (`effectiveCellDims`). `[ASSUMPTION]` стартовые значения
= текущие `TOL` (cellW±3, cellD −1.5/+3, h −3/+5), вынесенные в библиотеку как дефолт, далее
калибруются по ledger. **`deformation_risk`-категории (бра): only-exact, oversize-ячейка не
применяется** (I17).

---

## 9. Политика переговоров и выбора

### 9.1. Hard constraints (отсечение до скоринга)
Функциональная неверность; ниже aesthetic/usability floor; final overfill/overlap; выход за
drawer; сжатие соседа ниже functional minimum; нарушение `deformation_risk`.

### 9.2. Soft constraints (скоринг)
Market realizability, число `none`-зон, purchase/assembly complexity, aesthetic score,
density/fill, quality risk, availability, color/material.

### 9.3. NegotiationBudget (классы правок)
| Класс | Размер | Правило |
|---|---|---|
| Micro-snap | 0–2 см | локально, если есть slack и whole-drawer fit сохраняется (MVP) |
| Moderate | 2–5 см | только через reserve/reflow или другой DesignCandidate (intermediate) |
| Major | >5 см | не локальная правка; новый pattern/realization или фиксируем gap |
Пороги — policy constants, **калибруются**; матчеру **не** дают права расширять зону, только
определяют, какие options стоит вернуть на проверку (I7). Кейс 120×45: носки 31→32 — micro;
трусы 13 vs 20 (+7) — major, micro не применим.

### 9.4. Selection policy (lexicographic + Pareto, не один непрозрачный score)
1. Отбросить функционально неверные кандидаты.
2. Отбросить ниже aesthetic/usability floor.
3. На оставшихся — Pareto-frontier по {market realizability, purchase/assembly complexity,
   aesthetic score}.
4. Минимизировать число `no_reliable_market_match` зон; максимизировать качество **худшей**
   зоны (worst-zone confidence).
5. При близких — проще для покупки и сборки.
6. Равенство — детерминированный tie-break (стабильный порядок id).

### 9.5. Правило защиты продукта
Если рынок слаб по **всем** эстетически допустимым кандидатам — выбираем лучший
**DesignIntent**-кандидат, а недостаток рынка фиксируем как MarketHoleSignal. Схема **не**
деградирует ниже брендового порога (I2). Это прямой барьер против «рынок диктует дизайн».

### 9.6. Ограничение итераций и детерминизм
`[ASSUMPTION]` ≤ 2 negotiation rounds, ≤ K=5 кандидатов, top-M=8 options/зону. Все упорядочивания
стабильны; версионируются `engine/matcher/policy/catalog`. Повтор с теми же версиями = тот же
результат (I8).

### 9.7. D04b в новой модели
D04b перестаёт быть финальной истиной → становится **одним из источников cosmetic budget**.
MVP: текущая нормализация сохраняется (с merged-фиксом слайвер-потолка, C7), но её slack
осознанно перераспределяется negotiation-слоем. Intermediate: D04b заменяется
**market-aware normalization** — зоны дотягиваются к частотным форматам (а позже — к нашей
линейке), а не к произвольной стенке.

---

## 10. Архитектура данных и Design Demand Ledger

Принцип: **additive migrations и sidecar tables**, текущие 14 таблиц не переписываем.
Операционные данные (заказ/расчёт/выбранные SKU) остаются как есть; добавляется
**аналитический ledger**, который хранит идеал, варианты, переговоры и intent — то, чего
`sku_no_match_log` не покрывает (он пишет только провалы).

### 10.1. Что нельзя потерять (с первого расчёта)
IdealDesignSpec (до адаптации); все разумные RealizationOptions (не только ближайший single);
resolved negotiations (31→32 за 1 см = market-size signal); rejected beautiful candidates;
accommodation cost; user intent (клик/PDF/email/custom). Иначе диалог улучшит UX, но
уничтожит ассортиментную разведку (главная зависимость — data discipline).

### 10.2. MVP: одна additive-таблица (JSONB sidecar)
Чтобы не плодить 7 таблиц до трафика — одна `design_demand_log`, строка на candidate-zone.
```sql
-- миграция 00NN_design_demand_log.sql (additive, sidecar)
CREATE TABLE design_demand_log (
  id                bigserial PRIMARY KEY,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  configuration_id  uuid,                 -- soft FK на configurations (как sku_no_match_log)
  candidate_id      text,                 -- какой DesignCandidate
  zone_id           text,
  selected          bool NOT NULL DEFAULT false,   -- выбран ли этот кандидат/реализация
  -- версии для воспроизводимости
  engine_version    text, matcher_version text, policy_version text, catalog_snapshot_at timestamptz,
  -- слои правды (JSONB снапшоты)
  ideal_spec            jsonb,            -- desired box, functional core, division, section schema, role
  realization_options   jsonb,           -- [{kind,sku_ids,outer_box,deltas,quality,complexity,confidence_ceiling}]
  negotiation           jsonb,           -- [{action_type,before,after,source_of_space,cost,accepted}]
  final_outcome         jsonb,           -- {selected_kind,confidence,technical_path,packs,fill,note_code}
  -- классификация дыры
  gap_type          text,                -- algorithmic|catalog|size|internal_structure|quality|availability|packaging|complexity|aesthetic|true_product|custom_only
  gap_severity      numeric(4,2),
  desired_product_spec jsonb,            -- NeededProductSpec при gap
  recommended_action   text             -- catalog|seller|own_product|custom
);
CREATE INDEX ddl_config   ON design_demand_log (configuration_id);
CREATE INDEX ddl_gap      ON design_demand_log (gap_type, occurred_at DESC);
CREATE INDEX ddl_selected ON design_demand_log (selected) WHERE selected;
```
- **Финальные выбранные SKU** остаются в `configuration_skus` (уже есть `position`,
  `units_needed`, `packs_needed`). Расширяем `match_status` enum под новые пути (см. C6).
- `sku_no_match_log` **сохраняем** для совместимости; постепенно становится **производным**
  отчётом (view) над `design_demand_log WHERE gap_type IN (...)`.
- user intent линкуем через существующий `affiliate_clicks` (`order_id`) + email/PDF события.

### 10.3. Что хранить relationally / JSONB / только в engine_output
| Данные | Хранилище | Почему |
|---|---|---|
| заказ, статус, оплата | relational (`orders`,`payments`) | коммерция, воронка |
| выбранные SKU | relational (`configuration_skus`) | join к каталогу, клики |
| ideal/options/negotiation | **JSONB** (`design_demand_log`) | переменная форма, до нормализации |
| gap_type/severity/action | relational-колонки `design_demand_log` | индексируем для отчётов |
| полный след движка | `configurations.engine_output` (JSONB) | дебаг, не наружу |
| probes/scores/repair budgets | только engine_output/debug | I12, не в API |

### 10.4. Нормализация после объёма (target, migration path)
После первых сотен/тысяч расчётов JSONB-ledger раскладывается на
`design_candidate_zones`, `sku_realization_options`, `layout_negotiation_events`,
`market_hole_signals`. **Materialized views** для отчётов (раздел 11). Это migration path,
**не** MVP scope. БД не раздуваем: JSONB-снапшоты + retention (см. 10.6); top-K options
вместо всех; индексы только по `gap_type`/`occurred_at`/`selected`.

### 10.5. Versioning / reproducibility
Каждая строка ledger несёт `engine/matcher/policy/catalog`-версии. Воспроизводимость:
`input + те же версии = тот же результат` (I8). `catalog_snapshot_at` фиксирует, какой
снапшот каталога подавался (engine не I/O — snapshot версионируется отдельно).

### 10.6. Privacy / retention
Ledger — **аналитический и внутренний** (I12): не содержит PII, только геометрия/исходы/intent.
Наследует retention-политику проекта (`docs/data-model.md`: 3 года, monthly cron, scrub без
DELETE). PII в ledger не пишем; связь с заказом — через `configuration_id` (анонимизируется
вместе с `configurations`).

---

## 11. Assortment intelligence и стратегия производства

### 11.1. Карты (materialized views/отчёты над ledger)
Functional Core Map; Ideal Design Footprint Map; Market Realization Map;
Negotiation/Accommodation Map; True Market Hole Map; Quality Gap Map; Availability Gap Map;
Purchase Complexity Gap Map; User Intent Map.

### 11.2. Классификация: что есть что
| Тип | Как распознать | Действие |
|---|---|---|
| **algorithm/layout gap** | реализация существовала, но движок/snap её не выбрал | фикс движка/policy, **не** производство |
| **catalog coverage gap** | товар есть на рынке, но не в нашем каталоге | parser/seeding каталога |
| **true size gap** | нет хорошей реализации после negotiation (трусы 13 vs 20) | own product / custom |
| **internal structure gap** | внешний размер есть, ячейка/деление не подходит | own product |
| **quality gap** | размер есть, quality flags системно высокие | seller requirement / свой качественный |
| **availability gap** | хороший SKU есть, но часто out_of_stock | catalog/seller, не производство первым |
| **packaging/set gap** | только неудобный `set_quantity`/4–5 упаковок | bundle / own set |
| **purchase complexity gap** | mixed composition вместо одного | own cleaner SKU |
| **aesthetic gap** | рынок закрывает функцию, но рушит композицию | own product (high-cost accommodation) |
| **custom-only demand** | редкий high-intent spec под конкретный drawer | premium custom |

Правило: **не каждый no_match → производить**; **не каждая успешная адаптация → отсутствие
дыры**. True gap определяется после classification + negotiation.

### 11.3. Четыре действия по DemandGap
1. **Catalog action** — найти существующий SKU / исправить каталог.
2. **Seller action** — договориться о размере/качестве/availability.
3. **Own product action** — массовая organizer family под частотную зону.
4. **Custom action** — изготовление под конкретный drawer/design spec.

### 11.4. ManufacturingSignal
```ts
ManufacturingSignal {
  family_key;                          // кластер ideal footprint (округление 2 см)
  occurrence_count; paid_count; intent_count;
  gap_severity; avg_accommodation_cost; avg_elegance_delta;
  best_available_realization; confidence;
  recommended: "mass_line" | "premium_custom" | "seller_deal" | "catalog_only";
}
```
Пороги/защита от false gaps `[ASSUMPTION, provisional]`: минимум `occurrence_count ≥ 50` и
`paid_count ≥ 10` за окно; `gap_type ∈ {true_size, internal_structure, aesthetic,
high_frequency_solved}`; `intent_count > 0`. **mass_line** — частотные true gaps с подтверждённым
intent; **premium_custom** — редкие high-intent specs (можно запускать **раньше** mass line).
Триггер пересмотра порогов — после первых N=500 оплаченных расчётов.

### 11.5. FutureOrganizerSpec (не сырой AssignedZone)
```ts
FutureOrganizerSpec {
  outer_size_family;                   // от частотных красивых зон
  functional_core;                     // где ядро секций (от need)
  reserve_band;                        // «ядро + резерв»
  division/section_schema; rigidity/quality_requirements; usage; aesthetic_role;
  repeatability; market_failures; user_intent;
}
```
Изделие проектируется **под наши колонки**: внешний габарит — от частотных зон,
функциональные данные определяют ядро+резерв, а не урезают спрос.

---

## 12. Публичный API и граница приватности

**Contract-first:** доки (`docs/api-contract.md`) → типы → сервер → фронт. Совместимость с
текущим статическим фронтом и PDF: имена `assigned_zones`, `assigned_w/d/h_cm`, `x/y_cm`
сохраняются (рендер `result-render.js` так читает; ремап ломал бы рабочий рендер).

### 12.1. Что публично (curated)
```ts
interface ResultResponse {            // расширение текущего контракта
  token; fit_status; created_at;
  input: { drawer, items, priority };                  // эхо ввода
  scheme: {
    drawer: { w_cm,d_cm,h_cm };
    assigned_zones: [{ zone_id, content_type, x_cm,y_cm, assigned_w_cm,assigned_d_cm,assigned_h_cm }];
    visual_division: [{ zone_id, kind:"cells"|"slots"|"open", cols?,rows?,lanes? }];  // VisualZone, BL-08
    free_edge?: [{ zone_id, x_cm,y_cm,w_cm,d_cm }];     // I9 «свободный край»
    reserve_zones: [...];
    content_warnings: [{ warning_code, content_type, zone_id }];  // текст на фронте
  };
  matches: [{                          // ОДНА выбранная реализация на зону
    zone_id; content_type; block_index;
    realization_kind: "single"|"repeated"|"tiled"|"composed"|"open";   // публичная грань
    modules_needed; packs_needed;      // «2 одинаковых модуля, 1 упаковка из 2»
    confidence: "exact"|"compatible"|"acceptable"|"workaround"|"none";  // RecommendationConfidence
    note_code?: string;                // предметный компромисс (код, текст на фронте)
    sku: { sku_id, product_title, product_url, image_url, width_cm, depth_cm, height_cm,
           capacity_units, rigidity, division_type, color_group? };
  }];
}
```

### 12.2. Что НЕ отдаём (security boundary, I12)
`engine_output`/debug целиком; `option_id`, `calculation_mode`, `variant_transform`,
`layout_plan`, `selected_calculated_zones`, `layout_rule_evaluations`; `unit_*`, `item_gap`,
`side_clear`, `fb_clear`, `h_clear`, `needs_item_gap`, `preferred_rigidity`, `access_frequency`;
**probes, nearest_fit_vectors, repair budgets, scores, fill ratios**; technical `match_status`
и fallback path; **IdealDesignSpec, rejected candidates, negotiation actions**; affiliate URL
напрямую (через `product_url`/redirect по политике); manufacturing analytics. (Расширяет
существующий список `docs/api-contract.md` «Что НЕ отдаём».)

### 12.3. Versioning контракта и миграция
Новые поля (`visual_division`, `free_edge`, `realization_kind`, `confidence`, `note_code`)
**аддитивны** — старый рендер игнорирует незнакомое. Порядок: обновить `docs/api-contract.md`
→ TS-интерфейс ответа → `server/api/result.ts` (срез intern-полей) → фронт-рендер. PDF
(Puppeteer по той же странице) наследует автоматически.

---

## 13. Пользовательский результат и ResultPromise

### 13.1. Принципы результата
Схема — **главный продукт**; внутри зон cells/slots/lanes как понятная visual language;
под схемой — **один** выбранный план на зону; количество — modules/упаковки, не дубли
карточек; альтернативы скрыты (не marketplace feed); confidence — **тихий** бейдж + одна
конкретная строка компромисса (без процентов и внутренностей); если надёжной реализации нет
— схема остаётся полезной, зона получает custom/future. Бренд: «Порядок. Уют. Спокойствие.»
Основную эстетическую схему **не** пересобираем под footprint найденных SKU без сильного
обоснования (только reconciliation I9 — свободный край, не переверстка).

### 13.2. Слои статуса (развести!)
| Слой | Значения | Публичность |
|---|---|---|
| technical match_status | `primary_match`/`repeated_module`/`composed_from_slots`/`alternative_division`/`divider_workaround`/`no_match` | internal |
| **recommendation_confidence** | `exact`/`compatible`/`acceptable`/`workaround`/`none` | **public** |
| realization_kind | `single`/`repeated`/`tiled`/`composed`/`open` | public (грань) |
| purchase_quantity | `modules_needed`, `packs_needed` | public |
| note_code | предметный компромисс (код) | public (текст на фронте) |
| market gap type | algorithmic/catalog/size/quality/availability/complexity/true | analytics only |

### 13.3. Примеры copy (тон: спокойный, без процентов)
| Уровень | Формулировка |
|---|---|
| exact | «Подойдёт точно. Вариант хорошо воплощает зону и подходит под ваши вещи.» |
| compatible | «Хорошо подойдёт. Задача хранения закрыта; есть небольшой допуск по размеру, оттенку или комплектации.» |
| acceptable | «Рабочий вариант. Схема собирается, совпадение с идеальной зоной не полное.» |
| workaround | «Можно собрать из одинаковых модулей. Поставьте их рядом, как в плане зоны.» |
| none | «Надёжного готового решения для этой зоны сейчас нет. Мы сохранили её как запрос для будущего подбора или изготовления.» |
| note (свободный край) | «Органайзер занимает основную часть; спереди остаётся ровный свободный край — он на схеме.» |

### 13.4. ResultPromise (I9)
Контракт «что видишь — то соберёшь»: финальная схема пересобрана под фактические товары;
недозаполнение — ровная полоса «свободный край» как осознанный элемент дизайна, подписанный.
Никаких расхождений «на экране колонка во всю глубину — товар на две трети».

---

## 14. MVP-архитектура

**Бизнес-цель:** убрать реальные ложные пустоты (overfill-кейсы), ввести минимальный диалог,
начать качественный сбор данных — **без** глобального solver.

**Последовательность:** `functional build → текущий layout (1 кандидат) → realization probe
→ один greedy-local negotiation pass → final layout validation → final SKU plan → confidence
→ Design Demand Ledger`.

| Аспект | MVP-решение |
|---|---|
| Компоненты | `engine/orchestrate/` (фасад над текущим `runUmestnoEngine`), `matcher.probe`/`matcher.final`, `negotiate.local`, `ledger.write` |
| Design candidates | текущий layout; опц. 1 compact-вариант (без агрессивной глубины) |
| Realization modes | single, repeated_same (ограниченные паттерны), текущий composed, open |
| Negotiation | один локальный pass; micro-snap 1–2 см за счёт явного slack/reserve |
| Matcher correctness | per-division gates, asymmetric tolerances, probe/final split, internal≠external |
| Входы/выходы | in: input+libs+catalogSnapshot; out: result + scheme_payload + analytics_events |
| Новые типы | `SkuMatchTarget`, `RealizationOption`, `NearestFitVector`, `NegotiationAction`, `RecommendationConfidence` |
| Новые таблицы | `design_demand_log` (1 шт, JSONB sidecar) |
| API impact | аддитивно: `realization_kind`, `modules_needed`, `confidence`, `note_code`, `visual_division`, `free_edge` |
| UX impact | confidence-бейдж, один план/зону, visual division summary, свободный край |
| Scope | **M** (не L: single-candidate, без solver) |
| Dependencies | merge слайвер-фикса D04b (C7); вынос `TOL` в библиотеку |
| Риски | регресс у 9 работающих категорий; over-snap; усложнение выдачи |
| Rollback | feature-flag `DIALOGUE_MVP`: off → текущий one-way pipeline 1:1 |
| Acceptance | носки/бра 31→32 решаются без overlap; open не режется cell-воротами; final SKU всегда ⊆ зоны; повтор детерминирован; ledger пишет ideal/options/negotiation/selected |
| Отложено | mixed composition, global optimizer, market-aware normalization, dividers, multi-candidate selector, availability parser |

---

## 15. Промежуточная архитектура

**Бизнес-цель:** красота воплощается чаще без компромисса; selection между несколькими
схемами; полноценные tiling/dividers.

| Аспект | Решение |
|---|---|
| Компоненты | `generateDesignCandidates` (2–5 детерминированных), `selectDesignSolution` (Pareto/lexicographic), `negotiate` (до 2 rounds), availability parser |
| Candidates | full columns, compact aligned, market-snapped, composition-friendly, core+reserve |
| Realization modes | + homogeneous tiling, + divider_set как полноценные |
| Новые типы | `DesignCandidate`/`CandidateZone` как первоклассные, `confidence_ceiling` от availability |
| Новые таблицы | нормализация ledger: `design_candidate_zones`, `sku_realization_options`, `layout_negotiation_events`; materialized views отчётов |
| API impact | без изменений контракта (внутренние кандидаты не публичны) |
| UX impact | выше доля exact/compatible; reconciliation полнее |
| Scope | **L** |
| Dependencies | стабильный MVP + накопленный ledger; parser наличия |
| Риски | комбинаторика кандидатов; рост БД |
| Rollback | flag `MULTI_CANDIDATE`: off → MVP single-candidate |
| Acceptance | selection детерминирован и не ниже MVP по worst-zone confidence; tiling/dividers проходят регрессы; availability понижает confidence корректно |
| Отложено | bounded global re-solve; market-size families; mixed composition по умолчанию |

---

## 16. Целевая архитектура

**Бизнес-цель:** market-aware дизайн + собственная линейка/custom; рынок перестаёт быть
потолком красоты.

| Аспект | Решение |
|---|---|
| Компоненты | bounded global re-solve (whole drawer, non-overlap + DesignIntent constraints); market-aware normalization; assortment intelligence pipeline; manufacturing loop |
| Realization modes | расширенные homogeneous/mixed **только** при сохранении scheme quality (I11) |
| Market-size families | библиотека устойчивых форматов вместо зависимости от случайного SKU |
| Новые типы | `ManufacturingSignal`, `FutureOrganizerSpec`, `MarketSizeFamily` |
| Новые таблицы | `market_hole_signals`, `manufacturing_signals`, `future_organizer_specs`; регулярные агрегаты |
| API impact | возможны новые confidence-нюансы; контракт остаётся curated |
| UX impact | высокая доля exact/compatible; собственные изделия в выдаче |
| Scope | **L+** |
| Dependencies | доказанный эффект local/candidate negotiation; объём данных; кластеры + intent |
| Риски | детерминизм global re-solve; производство на false gap |
| Rollback | flag `GLOBAL_RESOLVE`/`MARKET_AWARE_NORM`: off → промежуточная |
| Acceptance | global re-solve детерминирован и не хуже candidate-selection; ManufacturingSignal с защитой от false gaps; пилот первой own-product family |
| Отложено | — (это горизонт) |

---

## 17. План трансформации и нарезка на PR

Каждая фаза держит регрессы зелёными (`runCalibration`, `matchSkusSpec`) и проходит стенд
до/после. Фазы по убыванию отдача/риск.

### PHASE 0 — Документы и термины (entry: принят этот memo)
- **Business goal/User value:** общий язык; ноль кода — ноль риска для пользователя.
- **Arch:** обновить ARCHITECTURE.md (paywall-first C5, DesignIntent-first, server-only
  orchestration, ledger sidecar), SPEC.md (probe/final, per-division gates, asymm. tolerances,
  RealizationOptions, `exact→primary_match`), README_ENGINE.md (negotiation loop, D04b как
  механизм, deterministic limits). **Data/API:** —. **Tests:** добавить regression fixtures
  120×45 (socks 31/32, bras 31/32, panties 13/20, open-path). **Observability/Rollback/Flag:** —.
- **Scope S. Exit:** доки согласованы, fixtures краснеют ожидаемо (документируют целевое
  поведение до фикса).

### PHASE 1 — Matcher correctness (entry: PHASE 0)
- **Goal:** убрать структурные баги фильтра; **User value:** меньше ложных no_match/«не тот».
- **Arch:** per-division gates как раздельные функции; асимметричные cell tolerances из
  библиотеки (убрать глобальный `TOL` `matchSkus.ts:13`); разделить internal/external fit;
  `exact→primary_match`; quality flags ограничивают confidence; near-match logging.
- **Data:** расширить `configuration_skus.match_status` enum (миграция, CHECK +
  `primary_match`,`repeated_module`,`divider_workaround`); back-compat запись старых значений.
- **API:** technical status не наружу (уже так). **Tests:** open без cell-ворот; асимметрия;
  internal≠external; все текущие регрессы зелёные. **Observability:** killer-gate в debug.
- **Rollback/Flag:** `PER_DIVISION_GATES` (off → текущий funnel). **Scope M. Exit:** ни один
  final SKU не превышает зону; open не режется cell/capacity; regression suite зелёный.

### PHASE 2 — Probe mode (entry: PHASE 1)
- **Goal:** видеть repairable overfill; **User value:** кейс 31/32 перестаёт быть пустым.
- **Arch:** `matcher.probe` отдельно от `matcher.final`; `NearestFitVector`; single/repeated
  realizations как RealizationOptions. **Data:** writes в `design_demand_log` (options+vectors).
  **API:** без публичных изменений (пока). **Tests:** 31→32 = `repairable_overfill` в probe и
  **не** проходит final до re-layout; детерминизм. **Observability:** probe-метрики в debug.
- **Rollback/Flag:** `PROBE_MODE`. **Scope M. Exit:** probe возвращает required_box+deltas для
  top options; final по-прежнему строго влезает.

### PHASE 3 — MVP negotiation (entry: PHASE 2)
- **Goal:** реально решать +1 см; **User value:** красивая схема + влезающий товар.
- **Arch:** `negotiate.local` (greedy, один round, micro-snap), whole-drawer recheck (I5),
  re-probe, final validation; reconciliation I9 (свободный край). **Data:** `negotiation` JSONB
  в ledger; `selected/gap`. **API:** `free_edge`, `note_code` (аддитивно). **Tests:** non-overlap
  после negotiation; functional minimum соседей; детерминизм; повтор. **Observability:**
  repairable_overfill_resolution_rate. **Rollback/Flag:** `DIALOGUE_MVP` (off → one-way).
- **Scope M. Exit:** носки/бра +1 см решаются без overlap и без сжатия соседей.

### PHASE 4 — Public confidence + UX (entry: PHASE 3)
- **Goal:** честный уровень уверенности; **User value:** доверие, нет ложной точности.
- **Arch:** `RecommendationConfidence` маппинг; copy codes; VisualZone cells/slots/lanes (BL-08).
  **Data:** confidence/note в `final_outcome`. **API:** `confidence`, `realization_kind`,
  `modules_needed`, `visual_division` (аддитивно; обновить `docs/api-contract.md` первым).
  **Tests:** quality cap (хлипкий SKU не получает exact независимо от footprint); confidence ≠
  match_status; рендер result/PDF. **Rollback/Flag:** `PUBLIC_CONFIDENCE`. **Scope M. Exit:**
  публичный контракт расширен, фронт/PDF читают, internals не текут.

### PHASE 5 — Design Demand Ledger полно + отчёты (entry: PHASE 3, парал. 4)
- **Goal:** ассортиментная разведка; **User value:** косвенный (будущая линейка).
- **Arch:** полная запись ideal/options/negotiation/selected/gap + versions; базовые отчёты.
  **Data:** materialized views (market standard, true gap, quality, complexity). **API:** —.
  **Tests:** ledger completeness (каждая candidate-zone пишет ideal/options/negotiation/
  selected/gap/versions). **Scope M. Exit:** отчёты строятся из ledger.

### PHASE 6 — Candidate selection (intermediate)
- 2–5 DesignCandidates; Pareto/lexicographic selector; homogeneous tiling + dividers;
  availability parser+scoring; two-round bounded negotiation. **Flag** `MULTI_CANDIDATE`.
  **Scope L. Exit:** selection детерминирован, не ниже worst-zone confidence MVP.

### PHASE 7 — Assortment / manufacturing (target)
- Кластеризация IdealDesignSpec; ManufacturingSignal; seller pipeline; own line; custom.
  **Scope L. Exit:** пилот первой own-product family; защита от false gaps.

### Порядок PR (не только roadmap)
```
PR-0  docs: ARCHITECTURE/SPEC/README_ENGINE + regression fixtures 120×45         [PHASE 0]
PR-1  per-division gates + asymmetric tolerances (TOL→library) + tests           [PHASE 1]
PR-2  internal/external fit split + match_status rename (+migration enum)         [PHASE 1]
PR-3  probe/final split + NearestFitVector + repairable_overfill                  [PHASE 2]
PR-4  design_demand_log migration + ledger.write (options/vectors)               [PHASE 2/5]
PR-5  local negotiation + whole-drawer validation + reconciliation free_edge     [PHASE 3]
PR-6  RecommendationConfidence + public contract/copy (api-contract first)        [PHASE 4]
PR-7  VisualZone cells/slots/lanes (BL-08)                                        [PHASE 4]
PR-8  repeated_same_sku realization + complexity scoring                         [PHASE 3/6]
PR-9  ledger reports / materialized views                                        [PHASE 5]
── после трафика ──
PR-10 multi-candidate generator + selector                                       [PHASE 6]
PR-11 homogeneous tiling + dividers                                              [PHASE 6]
PR-12 availability parser + scoring                                             [PHASE 6]
PR-13 market-aware normalization (D04b replacement)                             [PHASE 6/7]
PR-14 assortment intelligence + ManufacturingSignal                             [PHASE 7]
```
Прекондиции: PR-1..PR-2 не зависят от данных (работают на снапшоте каталога); PR-4 разблокирует
сбор до сложного negotiation; PR-6 идёт **после** PR-3/PR-5 (есть что показывать как confidence).

---

## 18. Тесты, наблюдаемость, метрики

### 18.1. Обязательная test matrix
| # | Кейс | Что проверяет |
|---|---|---|
| 1 | regression текущих calibration cases | не сломали базу (`runCalibration`, `matchSkusSpec`) |
| 2 | D04b deep drawer | глубокий ящик не раздувает зону «в пустоту» (слайвер-потолок) |
| 3 | 31 см zone vs 32 см SKU | probe=repairable_overfill; negotiation решает; final влезает |
| 4 | 13 см depth vs 20 см SKU | micro не применим; landscape/none; MarketHoleSignal |
| 5 | cell internal suitability vs outer footprint | I3: ячейка ок ≠ зона растёт |
| 6 | asymmetric cell tolerance | глубже допустимо, мельче нет; per content_type |
| 7 | open without cell gates | регресс B2 не возвращается |
| 8 | lanes | per-lane footprint; units_needed=lanes |
| 9 | set_quantity | clean/dirty split; packs_needed |
| 10 | repeated modules | 2/4 одинаковых; combined box ≤ зона; один план в UX |
| 11 | homogeneous tiling | non-overlap внутри зоны |
| 12 | non-overlap after negotiation | I5 после каждой правки |
| 13 | drawer containment | все зоны ⊆ drawer |
| 14 | functional minimum preservation | сосед не сжат ниже минимума |
| 15 | deterministic result | повтор = тот же результат |
| 16 | catalog snapshot reproducibility | те же версии = тот же исход |
| 17 | confidence mapping | confidence ≠ match_status; compromise не повышает; quality cap |
| 18 | data ledger completeness | ideal/options/negotiation/selected/gap/versions записаны |
| 19 | public API no-internals | нет unit_*/scores/probes/ideal/negotiation в ответе |
| 20 | result rendering/PDF | новые поля рендерятся; старый рендер не падает |
| 21 | deformation_risk (бра) | I17: только exact или gap, никогда компромисс |

### 18.2. Метрики
`layout_fit_all_rate`; `market_coverage_rate` (зоны exact/compatible); `false_no_match_rate`
(regression-аудит); `repairable_overfill_resolution_rate`; `false_gap_rate`;
`avg_modules_per_zone`; `avg_different_skus_per_result`; `purchase_complexity`;
`quality_risk_recommendation_rate`; `worst_zone_confidence`; `product_click_rate` (per zone);
`save_pdf_rate`/`email_rate`; `custom_interest_rate`; `true_gap_rate` + распределение gap_types;
**% gaps classified as catalog/layout/true product** (защита от производства на false gap).

### 18.3. Наблюдаемость
Killer-gate воронка в `debug` (есть `explainSkuMatch.ts`); probe-метрики/vectors в
`engine_output` (не наружу); еженедельные отчёты из ledger (раздел 11); алерты на рост
`false_gap_rate`/`quality_risk_recommendation_rate`.

---

## 19. Сквозные примеры

### Пример A — repairable overfill (носки/бра, 120×45, зона 31 vs SKU 32)
```
DesignIntent → functional core носков + эстетическая полоса 31 см (зона ⊆ красивой колонки)

probe (matcher):
  ZoneRealizationOptions = [
    {kind:single_sku, sku:32×30, combined_outer_box:32×30,
     internal_suitability:{cell_ok:true,capacity_ok:true},
     external_fit_class:repairable_overfill, nearest_fit_vector:{w:+1,d:0,h:0}},
    {kind:repeated_same_sku, module_count:2, ...},            # альтернатива
  ]
  → single 32 НЕ становится final (I4), помечен repairable_overfill +1

negotiation (budget micro 0–2):
  action: reallocate_slack → assigned_w 31→32 (1 см косметического slack соседа/резерва)
  I5 whole-drawer recheck: non-overlap ok, сосед ≥ functional minimum → accepted

final (matcher): single 32×30 теперь ⊆ зоны 32 → SelectedRealization, confidence=compatible
reconcile (I9): зона ровно под товар, свободного края нет

Ledger:
  ideal_spec: box 31, functional core носков
  realization_options: [single 32 (+1), repeated×2]
  negotiation: reallocate_slack 31→32, cost low, accepted
  final_outcome: single_sku, compatible, note: market_standard_size
  gap_type: NULL (closed) → market_standard signal (частый дешёвый snap 31→32)
```
**Вывод аналитики:** это **не** дыра продукта «31 см», а **layout/market-standard сигнал**:
при наличии slack носочную зону выгоднее строить 32 см (обновить layout policy / size family).
Rejected realization (repeated×2) тоже записан — evidence «можно проще одним модулем».

### Пример B — потенциальная настоящая дыра (трусы, глубина ~13, cells от ~20)
```
DesignIntent → плоская мелкая ячейка трусов (unit ~10×3, soft), эстетическая зона глубина 13

probe (matcher):
  internal suitability: асимметричная tolerance может признать БОЛЬШУЮ ячейку пригодной
  external: рыночные cells начинаются ~20 см → outer footprint 20 в зоне 13 = +7 (hard_overfill)
  ZoneRealizationOptions = [
    {kind:single_sku, external_fit_class:hard_overfill, nearest_fit_vector:{d:+7}},   # не влезает
    {kind:repeated_same_sku, module_count:2/4, combined_outer_box ... всё равно d≥20}, # глубина не лечится числом модулей
    {kind:open_fallback, ...},                                                         # деградация деления
    {kind:custom_needed}
  ]

negotiation (budget):
  +7 см = major → micro-snap НЕ применим; пробуем другой DesignCandidate / realization mode
  open_fallback: функция деления теряется → ниже aesthetic/usability floor для трусов? (policy)
  если ни один кандидат не даёт ≥ floor → product-protection: лучший DesignIntent candidate,
  зона помечается no_reliable_market_match

final: none (или open как acceptable/workaround, если policy допускает) — НЕ компромисс по deformation
reconcile (I9): если открытая зона — честная подпись «открытое хранение»

Ledger:
  ideal_spec: shallow underwear cells, outer≈глубине зоны, бóльшая допустимая ячейка, semi-rigid
  realization_options: single(+7 hard), repeated(+7), open_fallback, custom
  negotiation: rejected (major, не локально)
  final_outcome: none / open(workaround)
  gap_type: true_size + internal_structure;  severity high;  recommended_action: own_product/custom
  desired_product_spec → NeededProductSpec
```
**NeededProductSpec / FutureOrganizerSpec:** «Shallow underwear cells organizer»: внешний
footprint близко к идеальной глубине зоны (~13–15), допустимая более крупная ячейка, нужная
capacity, предсказуемая semi-rigid конструкция, ядро+резерв. Это **чистая рыночная дыра**, а
не ошибка +1 см — отличается от примера A классификацией (true_size vs market_standard) и
тем, что negotiation её не закрыл.

**Что зафиксировано для производства (оба примера):** ideal vs selected, market options,
accommodation cost, rejected realizations, user intent. Именно сравнение
`Ideal → Options → Negotiation → Selected` (а не финальный no_match) питает решение о
собственной линейке.

---

## 20. Таблица решений

| Решение | Current state | MVP choice | Target choice | Почему | Tradeoff | Docs change | Code change | Data change |
|---|---|---|---|---|---|---|---|---|
| Продуктовый приоритет | неявно scheme-first | DesignIntent-first | то же | снимает спор calc/assigned | требует дисциплины слоёв | ARCHITECTURE.md | — | — |
| Engine↔Matcher flow | one-way (`index.ts:56`) | bounded local dialogue | multi-candidate + global re-solve | устраняет ложные пустоты | сложнее оркестрация | README_ENGINE | `engine/orchestrate/` | ledger |
| Ответ matcher | один SkuMatch/зону | RealizationOptions (subset) | полный landscape | одна зона ≠ один SKU | новый контракт | SPEC.md | `matchSkus.ts` | options в ledger |
| Цель матчинга | `assigned` (косметика) | probe=need+budget, final=assigned | market-aware assigned | C2 (LaDom 24 в need 19) | две проверки вместо одной | SPEC.md | `matchSkus.ts:47` | — |
| Overfill | no_match сразу | probe repairable; final fits | то же | реальные +1 см | probe-сложность | SPEC.md | matcher | vectors |
| Cell tolerance | глобальный `TOL` (`:13`) | асимметрия из библиотеки | per content/division калибр. | гибкость без хаоса | калибровка | SPEC.md | `matchSkus.ts` | — |
| Footprint fit | смешан с cell | отдельный hard layer (I3) | то же | overlap-защита | — | SPEC.md | matcher | — |
| Compositions | composed only | + repeated_same | + tiling/dividers/(mixed) | реализуемость | комбинаторика | SPEC.md | matcher | — |
| Capacity | от `count` (`:44`) | от assigned «до N» | то же | C8: место = ресурс | copy-нюанс | SPEC.md | matcher | — |
| Confidence | нет публичного | exact..none | то же | честность | маппинг | api-contract | result.ts | `final_outcome` |
| Technical status | `exact` (`:16`) | →`primary_match` | то же | омоним (C6) | миграция enum | SPEC.md | matcher | `configuration_skus` enum |
| D04b | безлимит (main) | слайвер-потолок + budget | market-aware norm | C7 | — | README_ENGINE | merge `normalizePlacement` | — |
| Adjustment loop | `null` (`index.ts:55`) | local negotiation | bounded re-solve | drift | — | README_ENGINE | wire negotiation | negotiation |
| Монетизация | affiliate (`ARCH:11`) | paywall-first | paywall + affiliate | C5 | — | **ARCHITECTURE.md** | — | — |
| Данные | only no_match | + design_demand_log | нормализ. + signals | не стереть idDeal | рост БД | data-model | ledger.write | new table(s) |
| Market gap | по no_match | после classification | ManufacturingSignal | I10 | сложнее | — | analytics | gap_type |
| Own line / custom | нет | сбор | mass + premium custom | рынок ≠ потолок | объём данных | — | — | signals |

---

## 21. Риски и режимы отказа

| Риск | Как проявляется | Митигирование |
|---|---|---|
| Рынок диктует дизайн | движок постоянно снапается к SKU | aesthetic/usability hard gate (I2); product-protection rule; rejected demand логируется (I10) |
| Диалог скрывает дыры | все gaps «лечатся» адаптацией | accommodation cost + MarketHoleSignal; анализ ideal vs selected, не только final |
| Большая ячейка → overlap | cell tolerance принят за zone tolerance | раздельные internal/external gates (I3); final whole-drawer non-overlap (I5) |
| Комбинаторный взрыв | слишком много SKU-композиций | MVP single+repeated+ограниченные паттерны; top-K; mixed penalized |
| Результат → маркетплейс | много вариантов/карточек | один план/зону; альтернативы скрыты; mixed penalized |
| Хлипкий SKU выигрывает по размеру | красивый fit, плохая функция | quality flags + confidence caps (I16) |
| Аналитика слишком сложна | 7 таблиц до трафика | один JSONB ledger на MVP, нормализация позже |
| Нестабильность результата | итерации дают разные схемы | bounded deterministic policies; versioned catalog/policy; regression fixtures (I8) |
| API раскрывает internals | фронт зависит от probes/scores | allowlist public contract; internal только в БД/debug (I12) |
| Производство на false gap | gap вызван каталогом/алгоритмом | classification (algorithm/catalog/quality/availability/true) + пороги ManufacturingSignal |
| Регресс у 9 работающих категорий | сломали то, что подбиралось | feature-flags пофазно; regression suite зелёный обязателен |
| `deformation_risk` пережат | бра сжаты в компромисс | I17: only-exact или gap, никогда компромисс |
| Drift доки↔код вернётся | правки кода без доков | contract-first; PR-0 правит доки первым |

---

## 22. Финальная рекомендация

Принять **DesignIntent-first архитектуру с bounded co-design и Design Demand Ledger** (базис
— `umestno_final_architecture_v5`, с `SkuMatchTarget` из memo как probe-контрактом и
reconciliation из v3_1 как инвариантом I9). Это **единственная** модель, которая
одновременно: защищает функциональную правду вещей; сохраняет продаваемую эстетику и бытовое
удобство; снимает ложные no_match на реальных +1 см кейсах; не превращает сервис в
подборщик готовых наборов; учитывает, что одна зона реализуется одним, двумя или четырьмя
модулями; не путает допустимый размер ячейки с внешним размером товара; собирает чистые
рыночные дыры, а не шум алгоритма и каталога; даёт достижимый путь к собственной линейке и
custom.

**Делать сейчас, в порядке:** (1) matcher correctness — per-division gates, асимметричные
допуски, разделение internal/external (PR-1, PR-2); (2) probe/final split + repairable
overfill (PR-3); (3) один greedy-local negotiation pass с whole-drawer validation (PR-5); (4)
RecommendationConfidence + публичный контракт (PR-6); (5) Design Demand Ledger с первого
расчёта (PR-4). Параллельно — **PR-0: привести ARCHITECTURE.md/SPEC.md/README_ENGINE.md** к
этому документу и закрыть drift (affiliate→paywall C5, D04b-фикс merge C7, `exact→primary_match`
C6, matcher-target C2).

**Не делать:** не начинать с глобального solver; не подгонять схему под первый SKU; не
считать каждый no_match дырой; не показывать наборы A/B/C; не расширять допуски ради match
rate; не выносить engine/каталог на фронт; не отдавать debug. После реальных данных —
расширять candidate space, market-aware normalization, realization modes и запускать
assortment intelligence.

Коротко: **движок проектирует, матчер описывает способы воплощения, данные хранят всё, чего
рынку не хватило.**

---

### Приложение — соответствие исходным документам
- `umestno_final_architecture_v5` → разделы 1, 5–9, 13–17 (базис).
- `UMESTNO_ARCHITECTURE_v3_1` → I9 reconciliation, D04b-как-механизм (C7), three-truths.
- `umestno_architectural_memo` → `SkuMatchTarget` (раздел 7.2), 5-truth онтология (раздел 5).
- `Zaklyuchenie_matching_SKU` → раздел 4.6 эмпирика, C2/C7/C8, примеры 19.A/B.
- Design-бриф → брендовый тон результата (раздел 13).
- Репозиторий (`ARCHITECTURE.md`, `README_ENGINE.md`, `SPEC.md`, `REDESIGN.md`,
  `api-contract.md`, `data-model.md`, `db/migrations/*`, код) → разделы 2 (drift), 3.2, 4, 10, 12.

