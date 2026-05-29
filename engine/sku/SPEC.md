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
