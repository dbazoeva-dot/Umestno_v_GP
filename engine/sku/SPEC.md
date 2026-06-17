# SKU Matching — спека

Источник правды для имплементации `matchSkus.ts`. Все правила
зафиксированы в обсуждении и не меняются без апдейта этого файла.

## Назначение

`matchSkus` получает на вход:
- `schemePayload` — результат расчёта движка с `assigned_zones` (что
  нарисовано в схеме), включая lane-разбиение для split slot-зон;
- `skuCatalog` — каталог SKU (`SkuCatalogRow[]`);
- `colorPreference` — пожелание клиента по цвету (`color_group`).

На выходе — для каждой зоны массив кандидатов SKU, отсортированных по
приоритету, с пометкой режима покупки (`match_kind`).

## Конвенция размеров

Зафиксирована везде в коде и форме клиента:
- `width` — левая стенка → правая (длинная сторона ящика, обычно
  больше);
- `depth` — передняя стенка → задняя;
- `height` — высота борта ящика.

Slot-органайзеры — предпочтительная ориентация: **слоты идут вдоль
depth** (удобнее доставать). Если по предпочтительной не лезет, а
`can_rotate=yes`, матчер пробует повёрнутую (slots вдоль width).

## Правило #1 — set_quantity

Поле `set_quantity` (число штук в одной упаковке) меняет, **сколько
упаковок** должен купить клиент и **как мы это рендерим**.

Для зоны c `units_needed = N`:

### Жёсткий фильтр
- Отбрасываем `set_quantity > N` (нельзя купить набор на 5, когда нужно
  3). Edge case, оставлен на будущее.

### Сортировка по приоритету
1. **`set_quantity == N`** — идеальный набор. 1 пачка. Рендер: «1 шт.»,
   плашки «× N» нет. `match_kind = 'set'`.
2. **`1 < set_quantity < N` и делит N нацело** — чистый multipack.
   `packs_needed = N / set_quantity`. Рендер: «× `packs_needed`
   упаковок». `match_kind = 'multipack'`.
3. **`set_quantity == 1`** — поштучно. `packs_needed = N`. Рендер:
   «× N». `match_kind = 'singles'`.

### Last resort
Если все три пусто — допускаем «грязный» набор (`1 < set_quantity < N`,
не делит нацело). `packs_needed = ceil(N / set_quantity)`. Будет
лишнее. Рендерится так же, как multipack. Используется только при
отсутствии чистых вариантов.

## Правило #2 — composed_from_slots fallback

Когда для `cells`-зоны нативный матчинг дал **0 кандидатов**, матчер
пробует собрать сетку из slot-органайзеров.

### Когда применяем
Только при `0` cells-кандидатов. Не применяем как параллельный путь.

### Условия slot-кандидата (предпочтительная ориентация)
Slot ставится так, что его слоты идут вдоль `depth` зоны; нужно
`zone.calculated_cols` штук бок-о-бок по `width`.

- `slot.cell_width_cm` в пределах `zone.unit_w_cm ± 3` см
- `slot.cell_depth_cm` в пределах `zone.unit_d_cm ± 1.5` см
- `slot.height_cm` в пределах `[zone.unit_h_cm − 3 ; zone.unit_h_cm + 5]` см
- `slot.cols ≥ zone.calculated_rows` (число слотов покрывает глубину)
- `slot.width_cm × zone.calculated_cols ≤ assigned_w_cm`
- `slot.depth_cm ≤ assigned_d_cm`

`units_needed = zone.calculated_cols`.

### Повёрнутая ориентация
Если по предпочтительной не лезет, а `slot.can_rotate = yes` — пробуем
поворот: слоты идут вдоль `width`, штабелируем `zone.calculated_rows`
штук в глубину.

- `slot.cell_width_cm` в пределах `zone.unit_d_cm ± 1.5` (depth-юнит)
- `slot.cell_depth_cm` в пределах `zone.unit_w_cm ± 3` (width-юнит)
- `slot.height_cm` — те же `−3 / +5` от `unit_h_cm`
- `slot.cols ≥ zone.calculated_cols`
- `slot.width_cm × zone.calculated_rows ≤ assigned_d_cm`
- `slot.depth_cm ≤ assigned_w_cm`

`units_needed = zone.calculated_rows`.

### Выдача
- `match_kind = 'composed_from_slots'`
- Правило #1 (`set_quantity`) применяется поверх — на полученном
  `units_needed`.

## Правило #3 — rigidity (мягкая иерархия)

У зоны есть `preferred_rigidity` (`soft | semi_rigid | rigid`).
Никакого жёсткого фильтра, никаких плашек о «не идеально по
жёсткости». Только сортировка:

| preferred_rigidity | Порядок предпочтения |
|--------------------|----------------------|
| `soft`             | soft → semi_rigid → rigid |
| `semi_rigid`       | semi_rigid → rigid → soft |
| `rigid`            | rigid → semi_rigid → soft |

## Правило #4 — alternative_division fallback

У `content_type` есть `primary_division` и опционально
`alternative_division` (обычно `open`). К моменту `matchSkus` зона уже
содержит один `division_type` — движок решил на этапе расчёта.

Если по текущему `division_type` всё пусто — матчер пробует
`alternative_division`. Полный порядок попыток:

1. **Primary** (`zone.division_type`) — нативный матчинг.
2. Если primary = cells и пусто → **composed_from_slots** (см. #2).
3. Если всё ещё пусто → **alternative_division** (нативный матчинг
   с тем же division_type, что прописан в `content_type.alternative_division`).
4. Иначе → `no_match`.

`match_status` отражает путь:
- `'exact'` — нашёлся по primary;
- `'composed_from_slots'` — собрали из slots;
- `'alternative_division'` — отдали alternative (обычно open);
- `'no_match'` — пусто, зона не закрыта.

## Правило #5 — multiunit (lanes → set / singles)

Геометрия и количество — **разные слои**.

### Геометрия
Для split slot-зон (`split_used = true`, `lanes_needed > 1`) матчер
считает per-lane footprint:

```
lane_w_cm = (assigned_w_cm − gap × (lanes_needed − 1)) / lanes_needed
lane_d_cm = assigned_d_cm
lane_h_cm = assigned_h_cm
cap_per_lane = max(items_per_lane)   // самый загруженный lane
```

Любой кандидат должен влезать в эту lane-геометрию.

`units_needed = lanes_needed`.

Для не-split зон: `units_needed = 1`, lane-footprint = assigned-footprint.

### Количество
Правило #1 (`set_quantity`) выбирает, **набором или поштучно** купить
эти `units_needed` штук. Никакого отдельного «lane-match как пути»
нет — lanes_needed просто транслируется в units_needed.

## Общий фильтр (применяется к каждому кандидату)

Перед сортировкой по правилам #1–#5 — базовый отбор:

- `availability_status !== 'out_of_stock'` (статусы `available` и
  `unknown` допускаются; `unknown` означает «не успели проверить»,
  фильтровать его жёстко — терять часть каталога)
- `division_type` совпадает с тем, что пробуем
  (primary / alternative / 'slots' для composed-fallback)
- `cell_width_cm` (или `width_cm`, если пусто) в пределах
  `(zone.unit_w_cm + item_gap) ± 3`
- `cell_depth_cm` (или `depth_cm`) в пределах
  `(zone.unit_d_cm + item_gap) ± 1.5`
- `height_cm` в пределах `[zone.unit_h_cm − 3 ; zone.unit_h_cm + 5]`

Точка отсчёта — **эффективный размер ячейки** = `unit + item_gap`
(где `item_gap` берётся из профиля content_type, 0 если
`needs_item_gap=false`). Допуски ±3 / ±1.5 заложены **уже с учётом
рыночного finger-room**: эффективная ячейка ~6.5 см + 1.5 см
допуск = 8 см — это и есть распространённый размер cells-органайзера.
Сравнение с сырым `unit` теряло поправку на gap и резало валидных
кандидатов.
- `capacity_units × set_quantity ≥ items_needed_in_zone`
  (зона требует столько-то контента, упаковка должна это закрыть)
- геометрия: `sku.width_cm ≤ lane_w_cm` и `sku.depth_cm ≤ lane_d_cm`,
  либо при `can_rotate=yes` — повёрнутая (`d ≤ lane_w` и `w ≤ lane_d`)

## Сортировка кандидатов (в одной зоне)

В порядке убывания приоритета:

1. **set_quantity-приоритет** (#1): set > multipack > singles > dirty
2. **rigidity-приоритет** (#3): preferred → один шаг вниз → второй шаг
3. **color** (бинарный): `color_group == colorPreference` сверху
4. **footprint** (плотность): большая площадь `width × depth` — лучше
   заполняет lane

## Логирование no_match

Каждый `no_match` пишется в таблицу `sku_no_match_log`:

```sql
CREATE TABLE sku_no_match_log (
  id                bigserial PRIMARY KEY,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  configuration_id  uuid,
  zone_id           text,
  content_type      text,
  division_type     text,
  zone_w_cm         numeric(6,2),
  zone_d_cm         numeric(6,2),
  zone_h_cm         numeric(6,2),
  unit_w_cm         numeric(6,2),
  unit_d_cm         numeric(6,2),
  unit_h_cm         numeric(6,2),
  units_needed      int,
  preferred_rigidity text
);
```

Раз в неделю — отчёт: какие `content_type` + размерности дают
`no_match` чаще всего. Сигналы:
1. Брешь в каталоге → добавить SKU.
2. Сбой в расчёте зон → проверить движок.
3. Пустая рыночная ниша → отметить для контентной/продуктовой
   стратегии.

## Диагностика подбора («воронка отсева»)

`engine/sku/explainSkuMatch.ts` — чистая функция `explainZone(zone, catalog)`.
Переиспользует те же `baseFilterGates`, что и боевой матчер (без дрейфа
логики), и показывает, сколько SKU отсеивается на каждом этапе фильтра.
Отвечает на «почему мало подбирается» (какой gate — узкое место) и «почему
не тот органайзер» (что реально пережило фильтр).

Важно: воронка считает только **базовые ворота**. Пост-фильтр `set_quantity`
(правило #1) идёт после — если база пропустила N, а `matchSkus` отдал 0
кандидатов, отсев именно там (набор больше N либо не делит нацело).

Два запуска:

```bash
# Локально, на каталоге из xlsx (без БД) — прогон по сценариям:
python3 engine/scripts/extractSkuCatalog.py E_SKU_catalog_v0106.xlsx > /tmp/catalog.json
npm run build
CATALOG=/tmp/catalog.json node dist/engine/test/diagSkuFunnel.js

# На VPS, реплей конкретного заказа по токену из result-страницы (t=...):
PGPASSWORD=... node dist/server/test/replaySkuMatch.js <token>
```

`replaySkuMatch` дополнительно ловит **рассинхрон**: размеры кандидата в
снапшоте `engine_output` vs текущая таблица `sku` (result-страница рисует
живые размеры, а `configuration_skus` хранит только `sku_id`).

## Структура выдачи (на одну зону)

```ts
{
  zone_id: string,
  content_type: string,
  match_status: 'exact' | 'composed_from_slots'
              | 'alternative_division' | 'no_match',
  match_kind:   'set' | 'multipack' | 'singles' | null,   // null если no_match
  units_needed: number,    // сколько штук закрывает зону
  packs_needed: number,    // сколько упаковок к покупке
  lane_footprint_cm: { w: number; d: number; h: number; capacity: number },
  candidates: SkuCatalogRow[]   // отсортированные, лучший первый
}
```

`runSkuFitCheck` суммирует по всем зонам:
- `sku_fit_status`: `'fit_all'` если все `match_status !== 'no_match'`,
  иначе `'no_sku_matches'`;
- `matched_skus_final`: для каждой зоны топ-1 candidate с
  `units_needed`, `packs_needed`, `match_kind`;
- `failed_skus`: список зон с `no_match` (плюс лог в БД).

## Адаптивные ячейки — `adjustable` (соты)

Соты/настраиваемые ячейки — это **`division_type = cells` + `adjustable = "yes"`**,
а НЕ отдельный division. Визуально и функционально это ячейки; отличие —
**раскладка `cols×rows` свободна** (фиксирован только размер ячейки и общее
число ячеек = `capacity_units`).

### Модель в каталоге
Одна строка, не три. Поля:
- `division_type = cells`, `adjustable = yes`;
- `cell_width_cm` / `cell_depth_cm` — номинальная ячейка (напр. 7.5×8.3);
- `capacity_units` — общее число ячеек в наборе (потолок);
- `cols`/`rows` — не фиксируем (раскладка эмёрджентна).

> `adjustable` — **существующий** столбец каталога (булев), у сот уже `yes`;
> новый столбец заводить НЕ нужно. Нужна только дата-правка: соты
> (UM-SKU-009/011/012/013, у которых есть ячейка) перевести `dividers → cells`
> и схлопнуть 3 фикс-конфига (6×3 / 9×2 / 18×1) в **одну** строку. Прямые
> разделители без ячейки (UM-SKU-015 «Арникс») остаются `dividers` —
> отдельный механизм, см. ниже.
>
> SQL для прода:
> `UPDATE sku SET division_type='cells' WHERE sku_id IN ('UM-SKU-009');`
> (после схлопывания дублей оставить один sku_id; loader уже читает `adjustable`.)

### Матчинг
Все cell-ворота как обычно (cell size — с асимметричным `cell_depth`), но
**footprint заменяется** на «∃ раскладка влезает» (`adaptiveCellsFit`):
```
colsFit = floor(lane_w / cell_w)
rowsFit = floor(lane_d / cell_d)
realizable = min(colsFit × rowsFit, capacity_units)
pass if realizable ≥ cap_per_lane
```
Зона **не двигается** (footprint-locked) — соты подстраиваются внутри неё.

### Известное ограничение
Зона посчитана под идеальную ячейку. Если ячейка сот больше идеала, в
зоне помещается меньше ячеек (носки medium: зона 25 под 6.5-ячейки →
соты 7.5 дают 3×5=15 < 16). Полная доставка сот требует **zone-negotiation**
(дорастить зону под реальную ячейку) — вне matcher.

## cell_depth — НЕсимметричный допуск

Ячейка **глубже** вещи допустима (вещь лежит свободнее), **мельче** — нет.
Поэтому `cellDOver (3) > cellDUnder (1.5)`:
```
cell_depth ∈ [eff_d − cellDUnder ; eff_d + cellDOver]
```
Прежний симметричный `±1.5` ошибочно резал флагман для тонких вещей (трусы:
ячейка 5.3 при идеале 3.5) и соты для носков (8.3 при 6.5). Ширина — по-прежнему
симметрична (`cellW = 3`).

### Поворот ячейки (только `cells`)
Для `cells` ячейка и вещь поворачиваются вместе — вещь влезает в любой
ориентации (ляжет перпендикулярно ящику, это допустимо). Поэтому ячейка
матчится в **обеих** ориентациях: `{cell_w, cell_d}` к `{eff_w, eff_d}` в любом
порядке (при повороте допуски меняются ролями width↔depth). Это admit-more.
Для `slots` поворот **направленный** (слоты вдоль depth/width — UX), нативно
своп не делаем — поворот слотов идёт через composed-from-slots.

## Dividers — механика (PROPOSAL, не реализовано)

Прямые разделители (напр. UM-SKU-015 «Арникс», без `cell_*`) — **не cells**:
ячейки нет, пользователь строит **любую сетку** сам. Это универсальный
конструктор и **последний fallback** «всегда что-то отдать».

### Нужные поля каталога (сейчас отсутствуют)
- `divider_length_cm` — длина одной планки (или «cuttable»);
- `divider_count` — сколько планок в наборе;
- `divider_height_cm`.

### Гейт «can-construct» (отдельный режим, после cells/slots/open/composed)
Зона требует сетку `cols×rows` (`calculated_cols × calculated_rows`):
```
1. count:  divider_count ≥ (cols − 1) + (rows − 1)
2. length: divider_length ≥ нужный пролёт (или cuttable=yes)
3. cell:   зона/(cols,rows) попадает в unit ± допуск (тот же асимметричный)
4. height: divider_height ≥ unit_h и ≤ drawer_h
```
Размер ячейки **эмёрджентный** (ставим планки где надо) → дивайдеры могут
закрыть почти любую зону, но требуют ручной сборки → `match_status =
'divider_workaround'`, `confidence = workaround`.

### Роль
Запускать **последним** (после всех фиксированных/адаптивных), как
страховку доставки. Высокий охват, низкий confidence.
