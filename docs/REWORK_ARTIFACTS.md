# Уместно — свод артефактов переделки движка и подбора

> Систематизация трёх аналитических memo (`UNIFIED_ARCHITECTURE`, `memo`, `v2`)
> под продуктовую модель основателя. Это рабочий source-of-truth: берём отсюда,
> что нужно, по шагам. Код здесь **не** трогается — только систематизация.
>
> Метки: 🟢 уже в коде (по memo, требует сверки) · 🔵 предлагают аналитики ·
> 🟡 решение за основателем · ❌ не берём (мимо модели).
> Привязка к принципам: **П1** влезло · **П2** логично · **П3** красиво-и-реально ·
> **П4** зафиксирована потребность.

---

## 0. Север продукта (решения основателя)

Хороший результат держит **4 принципа**:

1. **П1 — влезло.** Все вещи поместились.
2. **П2 — логично.** Размещено осмысленно (группы, частота).
3. **П3 — красиво и реально.** Ровно, без рваных зазоров, и **реально собирается
   из настоящих органайзеров** (никаких «фейковых пустот, названных бонусом»).
4. **П4 — зафиксирована потребность.** Идеал считается и хранится **как есть, до
   подстройки под рынок**. Любой компромисс ради существующих товаров = **рыночная
   дыра**, её пишем; частые дыры → закрываем **своими** товарами.

**Механизм (как принято):**

1. Есть **первичная assigned_zone** (считаем, что движок построил её оптимально —
   пока это не анализируем). Её надо заполнить органайзером.
2. Не заполняется напрямую → **диалог мэтчера с движком**: движок пробует другие
   конфигурации, пока не выйдет вариант, который и удовлетворителен, и **реально
   заполняется** органайзерами. Правила подбора чиним **отдельно**, внутри мэтчера.
3. **Разница «первичная → итоговая assigned_zone» = компромисс = рыночная дыра.**
4. При закупке/производстве ищем/делаем органайзер под **первичную** assigned_zone,
   **если она часто встречается**.

**Что из memo принято / отвергнуто:**

| | Решение | Статус |
|---|---|---|
| Косметический раздув `assigned` | это **by design**, не баг — зона должна быть красивой и заполненной | ✅ принято |
| Мерить подбор «под `need`, остаток = бонус-ёмкость до N» | ❌ **отвергнуто** — нарушает П3 (фейковый зазор) | ✅ решено |
| Заполнять зону **набором** одинаковых органайзеров (tiling/composed) | ✅ берём — так зона заполняется целиком | ✅ решено |
| Диалог движок↔мэтчер (пере-solve при неудаче) | ✅ **включаем** (бережно, только при провале). Сторона v5, а не «отложить solver» из UNIFIED | ✅ решено |
| Design Demand Ledger (идеал → рынок → компромисс → дыра) | ✅ спайн П4 | ✅ решено |

**Открытые решения (см. §5).**

---

## 1. Артефакты по доменам

### A. Доменные сущности (онтология)

| Артефакт | Что это | Ключевые поля | Где | Метка · Принцип |
|---|---|---|---|---|
| **FunctionalNeed** | Потребность вещей (count, метод, секции, height, rigidity). Рынок не участвует. | `contentType, itemCount, storageMethod, minOuterBox, sectionNeed(cells/slots/open/dividers), rigidityNeed, deformationSensitive` | рантайм/БД, internal | 🔵 П1 |
| **CalculatedZone** | Минимальное функциональное ядро зоны (пол). | `functionalBox{w,d,h}, sectionSchema`; в коде `zone_w/d/h_cm` | 🟢 рантайм | 🟢 П1 |
| **AssignedZone (первичная)** | Красивая раскладка зоны = **IdealDesignSpec** для П4. Заполняется целиком. | `box{w,d,h}, x,y, modulePlacements[], reserveAreas[]` | рантайм/БД | 🟢/🔵 П3·П4 |
| **AssignedZone (итоговая)** | Зона после диалога-пере-solve (реально заполнимая). Дельта с первичной = компромисс. | те же + ссылка на первичную | 🔵 П3·П4 |
| **VisualZone** | Рендер-модель зоны (разлиновка cells/slots/lanes, модули, «свободный край»). Без внутренностей. | `label, box, division{kind,cols,rows,lanes}, realizationPreview{modules,reserveAreas}, noteCodes[]` | 🔵 публично | 🔵 П3 |
| **RealizationOption** | Один способ собрать зону из реальных модулей. «single = частный случай». | см. блок B | 🔵 рантайм/аналитика | 🔵 П3 |
| **DesignSolution** | Выбранная итоговая схема + доказательство валидности. | `assignedZones[], selectedRealizations[], validation{nonOverlap,containment,finalSkuFit}, deterministicHash` | 🔵 рантайм/БД | 🔵 П1·П3 |
| **DesignCandidate** | Один допустимый вариант всей схемы (для диалога-пере-solve). | `zones[], aestheticScore, candidateRank` | 🔵 рантайм | 🔵 механизм |
| **DemandGap / MarketHoleSignal** | Повтор. footprint без нормального матча = дыра рынка. | `gap_type, severity, ideal_spec, functional_core, nearest_market, family_key` | 🔵 аналитика | 🔵 **П4** |
| **ManufacturingSignal / FutureOrganizerSpec** | Агрегат частота+intent+severity → что производить. | `family_key, occurrence_count, paid_count, gap_severity, recommended: mass/custom/seller` | 🔵 аналитика (target) | 🔵 **П4** |

### B. Мэтчер (правила подбора — чиним отдельно)

| Артефакт | Что это | Ключевые поля / значения | Метка |
|---|---|---|---|
| **SkuMatchTarget** | Запрос движка матчеру по зоне. Разводит `functional_min` ↔ `visual_assigned` (фикс отсчёта). | `functional_min_box{unit,item_gap,cols,rows,rigidity,deformation_risk}`, `visual_assigned_box`, `negotiationEnvelope{overfill/underfill}`, `allowedRealizationKinds[]`, `mode: probe/final` | 🔵 · тонкий (тяжёлый 4-box из memo — ❌ в рантайм, → в Ledger) |
| **match_kind (алгебра реализаций)** | Как собрана зона. | `single · repeated_module · homogeneous_tiling · composed_from_slots · divider · open_fallback · mixed_composition · custom_needed` | 🔵 частично 🟢 (`composed_from_slots`, `alternative_division` уже в enum) |
| **Per-division gates** | Раздельные проверки по типу деления, **до** cell-фильтров. | маршрут по `division_type: cells/slots/open/dividers/adjustable`; **open — без cell_* и без capacity_units** | 🔵 (as-is: общая AND-воронка) |
| **Cell-tolerance профили** | Асимметричные допуски ячейки per content/division. | as-is `TOL{cellW:3, cellDUnder:1.5, cellDOver:3, hUnder:3, hOver:5}` (matchSkus.ts:13) → вынести в policy | 🟢→🔵 |
| **MarketProbe** | Probe-прогон: survivors, killer_gate, nearest-fit, repairable overfill. Видит overfill, финал не выбирает. | `verdict: direct_fit/repairable_overfill/tileable/fallback_only/unrealizable, options[], gateCounts` | 🔵 |
| **NearestFitVector** | Signed-вектор промаха (internal + external) для срезанных кандидатов. | `outer{overW,overD,underW,underD}, internal{cellWDelta,cellDDelta,capacityShortfall}` | 🔵 internal · **П4** (сырьё для дыры) |
| **NegotiationAction / Budget** | Одно переговорное действие в пределах бюджета + перепроверка (I5). | actions `micro_snap/reallocate_slack/shift_neighbor/switch_pattern/switch_candidate`; классы `micro ≤2см / moderate ≤5см / new_candidate` | 🔵 механизм · частично 🟢 (`runAdjustmentLoop` написан, в бою выключен) |

### C. Ёмкость и раскладка

| Поле | Смысл | Правило | Метка |
|---|---|---|---|
| `capacity_units` | вместимость ячейки | `capacity_units × set_quantity ≥ items_needed`, от counted_items; open — без него | 🟢 |
| `set_quantity` | упаковка | `packs_needed = ceil(N/q)`; dirty-multipack → потолок confidence `acceptable` | 🟢 |
| `practical_capacity` | ёмкость open-лотка | отдельно от cell-логики | 🔵 |
| `module_count / placements` | 1–N модулей в зоне | MVP ≤ 4 одинаковых; паттерны `2×1,1×2,2×2,row,column` | 🔵 🟡 (потолок) |
| `reserve / slack / D04b` | косметический излишек | **договороспособный бюджет** (не пустота, не цель); слайверы < 8 см поглощаются, `alignColumns` выравнивает | 🟢→🔵 · П3 |
| `can_split` | деление **родительской** зоны | НЕ внутренняя композиция модулей — семантику не менять | 🟢 |
| `adjustable` (соты) | сколько ячеек влезает | считать от **need**-anchored зоны, не от раздутой | 🟢→🔵 |

### D. Статусы и честность (П3 — не врать)

| Артефакт | Значения | Правило | Метка |
|---|---|---|---|
| **match_status** (техн.) | `primary_match`(было `exact`) · `repeated_module` · `composed_from_slots` · `alternative_division` · `divider_workaround` · `open_fallback` · `no_match` | только в БД `configuration_skus`, **не** в API | 🟢 (enum есть, переименовать `exact`) |
| **confidence** (публичный) | `exact · compatible · acceptable · workaround · none` | = минимум всех caps; компромисс только **понижает** | 🔵 |
| **quality_risk_flags** | мягкость / нет дна / слабые стенки | ограничивают confidence ≤ `acceptable` независимо от геометрии | 🔵 (завести в каталог) |
| **deformation_risk** | бра/деликатные | **только точный матч или дыра, никогда компромисс** | 🔵 |
| **note_code** (публичный) | `SMALL_LAYOUT_ADJUSTMENT · FREE_EDGE_SHOWN · REPEATED_IDENTICAL_MODULES · OPEN_INSTEAD_OF_CELLS · COLOR_MAY_DIFFER · QUALITY_COMPROMISE · CUSTOM_RECOMMENDED · …` | код → курируемый текст на фронте | 🔵 |

### E. Данные о спросе — Design Demand Ledger [**П4**]

Сердце принципа 4. Пишется **с первого расчёта**. Четыре состояния:

```
IdealDesignSpec   → RealizationOptions → SelectedRealization+Negotiation → MarketHoleSignal
(идеал, неизменен)  (что дал рынок)      (что выбрали + компромисс)        (чего не хватило)
```

| Артефакт | Что | Ключевые поля | Метка |
|---|---|---|---|
| **sku_no_match_log** | as-is зачаток: пишет только провалы | `zone_*, unit_*, units_needed, preferred_rigidity` (пишется в `calculate.ts`) | 🟢 **есть** |
| **design_demand_log** | одна JSONB-таблица, строка на candidate-zone | `configuration_id, candidate/zone_id, selected, engine/policy/catalog_ver, ideal_spec, realization_options, negotiation, final_outcome, gap_type, gap_severity, recommended_action` | 🔵 (MVP-форма) |
| **gap_type** | классификация дыры | `algorithmic · catalog · size · internal_structure · quality · availability · packaging · complexity · aesthetic · true_product · custom_only` | 🔵 |
| **user_intent_events** | клик/PDF/email/оплата | `order_id, zone_key, event_type` — вес дыры | 🔵 |
| **footprint_families (MV)** | агрегат частоты | `fam_w, fam_d (округл. 2см), occurrences, low_conf, hole_cnt; priority = demand_weight × elegance_delta` | 🔵 → карта производства |

### F. Коммерция и готовность

| Артефакт | Значения / правило | Метка · Принцип |
|---|---|---|
| **ResultReadiness** | `sellable · preview_only · no_result` | 🔵🟡 |
| **can_pay-gate** | выводится из **готовности результата** (SKU реально подобран), **не** из геометрии `fit_all`. Незакрытая обязательная зона блокирует оплату | 🟡 **ключевое решение** (см. §5) |
| Разделение calculate/payment | `POST /api/calculate` (расчёт+заказ) отдельно от `POST /api/order/:token/payment` (ЮKassa, idempotent) | 🔵 (as-is: платёж внутри calculate) |
| Монетизация | paywall 149 ₽ первично, affiliate — добавка | 🟢 |

### G. Каталог SKU — какие поля завести/использовать

- 🟢 есть: `width/depth/height_cm, adjustable, availability_status, price_kop, source_confidence, last_checked_at, set_quantity`.
- 🔵 завести: `quality_risk_flags`, `deformation_risk`, verified `outer dimensions` (не восстанавливать из cell×rows), `offerId/platform` (мультиплатформенность), divider-поля (target).

### H. Воспроизводимость / политика

- 🔵 **VersionContext**: `engineVersion, policyVersion, layoutLibraryVersion, catalogSnapshotId, catalogContentHash` → в каждой строке ledger и в `deterministicHash`.
- 🔵 **FitPolicy sandbox**: допуски/лимиты вынесены в **версионируемую политику**, калибруются по данным (`≤2 rounds, ≤5 кандидатов, top-K options`).
- 🔵 **catalog_snapshot**: неизменяемый снимок каталога; движок получает как вход, **не читает БД** напрямую.

### I. Граница приватности

- **Публично:** зоны (x/y/w/d/h), товары (публичный срез SKU), `realization_kind`, `confidence`, `note_code`, «свободный край», `summary`, `resultPromiseCode`.
- **Только сервер/БД:** `SkuMatchTarget`, `fill`, техн. `match_status`, `unit_*/item_gap`, probes, `nearest_fit_vector`, scores, `IdealDesignSpec`, negotiation-внутренности, `MarketHoleSignal`, аффилейт-URL напрямую.

---

## 2. Что берём / темперим / не берём (под модель основателя)

| Из memo | Решение | Причина |
|---|---|---|
| Заполнять зону набором модулей (tiling/composed) | ✅ **берём** | П3, самый дешёвый крупный выигрыш (composed написан, спасает 0) |
| Per-division gates + асимметричные допуски + repairable overfill | ✅ **берём** | меньше ложных «нет», прямой рост подбора |
| Диалог движок↔мэтчер (пере-solve при неудаче) | ✅ **берём** (бережно) | твой механизм; `runAdjustmentLoop` уже есть, выключен |
| Design Demand Ledger (4 состояния) | ✅ **берём** | П4 — карта производства |
| Публичный confidence + note_code | ✅ **берём** | П3 (честность) |
| «Бонус-ёмкость до N» вместо заполнения | ❌ **не берём** | нарушает П3 (фейковый зазор) |
| Тяжёлый 4-box `SkuMatchTarget` в рантайме | 🟡 темперим | `market_target/future` → в Ledger, не в горячий путь |
| Мультикандидатный генератор / global solver как штатная фаза | 🟡 темперим | включаем как часть **бережного** диалога, не всегда; без unbounded solver |

---

## 3. Инварианты (сведённые, дедуп из трёх наборов)

Незыблемые правила. Номера — сводные; в скобках источники.

- **Пол функции.** `functional_min ⊆ assigned ⊆ drawer`; вместимость/пригодность/высоту/доступ нельзя ухудшить ради товара. (I1/I1/I1,I9)
- **Красота — тоже пол.** Нельзя выбрать хаотичную схему только из-за наличия товара. (I2/–/I14) → П3
- **Идеал неизменен.** `IdealDesignSpec` пишется до подстройки и не перезаписывается. (–/I7/I4,I24) → **П4**
- **Внутреннее ≠ внешнее.** Пригодность ячейки (от `need`) и внешний footprint (от зоны/ящика) — раздельно. (I3/I11/I6,I11)
- **Probe может, финал — нет.** Probe видит «почти влезает»; финал обязан физически помещаться и не налезать на соседа. (I4/I10/I10)
- **Экран = реальность.** Схема пересобирается под факт. товары; недозаполнение = ровный «свободный край», не фейк-колонка. (I9/I9/I27) → П3
- **Резерв договороспособен.** Косметический излишек = бюджет в пределах лимита; `need` неприкосновенен. (I7/I7/I12)
- **Матчер ≠ дизайнер.** Отдаёт ландшафт вариантов, геометрию меняет только layout/negotiation. (I6/I13,I14/I12,I16)
- **Модули ≠ split зоны.** Несколько модулей в родительской зоне не ломают `can_split`. (I13/–/I15)
- **Confidence ≠ match_status**; компромисс только понижает confidence. (I14,I15/I15,I6/I18,I19)
- **Качество ограничивает confidence**; `deformation_risk` — только точный матч или дыра. (I16,I17/I16/I20)
- **Нет тихого фолбэка.** Любой компромисс оставляет внутреннюю причину + публичный note_code. (–/–/I29)
- **Дыра не стирается.** Даже при успешном фолбэке `MarketHoleSignal` сохраняется. (–/–/I25) → **П4**
- **Готовность ≠ геометрия.** `fit_all` по геометрии ≠ можно продавать; нужна реальная реализация каждой обязательной зоны. (–/–/I31)
- **Оплата за готовность.** Платёж только после неизменной `ResultReadiness`. (–/–/I32) → §5
- **Детерминизм.** `input + версии + снимок каталога → тот же результат и hash`. (I8/I17/I28)
- **Приватность.** Ideal/probes/scores/negotiation/deltas — не в публичном API. (I12/I8/I26)

---

## 4. Порядок работ (фазы)

**Шаг 0 — стенд (без трафика).** Прогон корпуса сценариев через движок офлайн →
метрика «список покупок собрался / пустой». База отсчёта (`replaySkuMatch.ts` — уже есть).

**Фаза 1 — «что купить» заработало (дёшево + много):**
1. Завести **composed/tiling** (написан, спасает 0 → 7 344 зоны).
2. Развести **внутреннее/внешнее** мерило подбора.
3. **Repairable overfill** (+1–2 см → не отказ).
4. **Per-division gates** + асимметричные допуски (open без cell-фильтров).

**Фаза 1.5 — честность:**
5. Публичный **confidence** + note_code.
6. **Оплата от готовности** результата (§5).

**Фаза 1.7 — диалог:**
7. Включить/докрутить **пере-solve** (`runAdjustmentLoop`) + запись компромисса.

**Фаза 2 — данные и рост:**
8. **Design Demand Ledger** (4 состояния) с первого расчёта.
9. Карты дыр → своя линейка / custom.

---

## 5. Открытые решения (за основателем)

| # | Развилка | Рекомендация |
|---|---|---|
| 1 | **Оплата от готовности:** брать 149 ₽ только когда список покупок реально собран (не за пустую геометрию)? | **Да** — перестаём продавать пустое; главный рычаг доверия/конверсии |
| 2 | **Scope:** чинить подбор сразу на 21 категории или сузить MVP до ~9 рабочих? | Узкий честный MVP (9), остальное параллельно |
| 3 | **Потолок модулей на зону** (порог элегантности) | Однородный tiling ≤ 4 (2×2), смешанные — позже |

---

## Источники
`UNIFIED_ARCHITECTURE` [1], `memo` [2], `v2` [3] — architectural memo, 22.06.2026.
Метки 🟢 «есть в коде» проставлены **по указаниям memo** (file:line внутри), требуют
сверки с фактическим `engine/` перед реализацией шага.
