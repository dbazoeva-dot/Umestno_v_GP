# API контракт Umestno

Что отдаёт каждый эндпойнт наружу, какие поля использует фронт,
что **не отдаём** по правилам безопасности (см. ARCHITECTURE.md
«Правила API»).

Документ — источник правды. Перед правкой эндпойнта **сначала
обновляется этот файл**, потом TypeScript-интерфейс, потом код.

## Аудит фронт-потребителей

Прошлись по всем местам, где фронт читает данные API. Ниже —
исчерпывающий список.

### `configure/index.html` → POST `/api/calculate`

Шлёт **на сервер**. Поля собираются из формы:

| Поле | Источник в форме |
|------|-------------------|
| `drawer_width_cm` | `<input data-dim="w">` |
| `drawer_depth_cm` | `<input data-dim="d">` |
| `drawer_height_cm` | `<input data-dim="h">` |
| `storage_category` | (см. **открытый вопрос #1**) |
| `items[].content_type` | выбранные категории (UI — `data-items`) |
| `items[].volume_level` | объёмы для каждой категории |
| `priority` | выбранный приоритет (`convenient` / `capacity` / `budget`) |
| `consent_oferta` | `<input id="u-consent-oferta">` |
| `session_id` | от куки/анонимного ID |

В ответ ждёт `{ token, fit_status }`.

### `result/index.html` + `result-render.js` ← GET `/api/result/:token`

Читает **с сервера**. Раскладка по функциям рендера:

#### `renderScheme(scheme, drawer)`
- `drawer.w_cm`, `drawer.d_cm` — пропорции схемы
- `scheme.assigned_zones[]`:
  - `x_cm`, `y_cm` — позиция блока
  - `assigned_w_cm`, `assigned_d_cm` — размер блока
  - `content_type` — подпись (через `LABEL[contentType]`)
  - `zone_id` — связать с warning'ом
- `scheme.reserve_zones[]` (только один — самый большой):
  - `x_cm`, `y_cm`, `w_cm`, `d_cm`

#### `renderSizesTable(scheme)`
- то же, что у `renderScheme`, **плюс** `assigned_h_cm`

#### `renderFolding(payload)`
- `payload.what_to_store_where[]`:
  - `content_type`
  - `instruction` (fallback, основной текст из `content-labels.js → foldTip()`)

#### `renderWhy(payload)`
- сейчас: `payload.why_this_layout[]` **или** `scheme.layout_plan.rules_applied[]`
- формат: массив id правил `["D01","D02"…]`
- 🚫 **Раскрывает алгоритм** — см. **открытый вопрос #2**

#### `renderWarnings(payload)`
- `payload.content_warnings[]` **или** `scheme.content_warnings[]`:
  - `warning_code` (фильтр на `'compressed_storage' | 'deformation_risk'`)
  - `message` — готовый текст
  - `content_type` — подстановка ru-названия
  - `zone_id` — маркер «!» на блоке

#### Чипы сверху страницы (Hero summary)
Сейчас захардкожены, нужно заполнять из:
- `payload.input.drawer_*` — «80 × 45 × 15 см»
- `payload.input.items[].content_type` — список через запятую (через `LABEL`)
- `payload.input.priority` — «удобно» / «вместительно» / «бюджетно»

#### SKU-карточки (раздел «Подходящие органайзеры»)
Сейчас **статика**, надо переписать на динамический рендер.

Для каждого блока нужны:
- блок info (номер, content_type label, описание блока — см. **открытый вопрос #3**)
- список карточек, по карточке:
  - `sku.image_url`
  - `sku.product_title`
  - количество ячеек/слотов (`capacity_units`) и rigidity (через label) → строка «11 слотов · полужёсткий»
  - размер «32 × 30 × 12 см»
  - вся карточка — `<a href={sku.product_url} target="_blank" rel="noopener nofollow sponsored">` (если product_url не null); без отдельной кнопки «Купить»

### `no-fit/index.html` → POST `/api/no-fit-email` (Стадия 2)
- email
- consent

### Кнопки на result-странице (Стадия 2)
- «Скачать схему PDF» → `GET /api/pdf/:token`
- «Отправить на почту» + форма → POST `/api/order/create`

---

## Решения (зафиксированы)

### №1. `rules_applied` / `why_this_layout` — РЕШЕНО ✓

**Не отправляем с сервера.** Тексты «почему эта схема подходит» —
продуктовый копирайт, уже статически лежит на фронте в
`content-labels.js`. Логика рендера упрощается:

- 4 фиксированных bullet'а (всегда)
- 1 условный про резерв (если `scheme.reserve_zones.length > 0`)
- 1 условный про деликатные (если в `zones[]` есть категория из
  DELICATE = {bras, swimwear, sport_tops})

В `renderWhy` убирается цикл по правилам, заменяется на простую
условную логику. `RULE_TEXT` в `content-labels.js` можно удалить
после правки фронта — больше не зовётся.

### №2. `what_to_store_where` / `renderFolding` — РЕШЕНО ✓

**Не отправляем с сервера.** Тексты «как сложить» — тоже
статический копирайт (`FOLD_TIP` в `content-labels.js`).

`renderFolding` итерируется по `scheme.zones[].content_type` (с
дедупом) и берёт текст/иконку из `content-labels.js`.

### №3. Эхо `input` для чипов — РЕШЕНО ✓

Чипы сверху страницы показывают то, что пользователь ввёл. Это
**эхо ввода**, не движковая логика. Раскрытием алгоритма не
является.

Сервер отправляет в ответе `/api/result/:token` блок `input`:

```ts
input: {
  drawer: { w_cm: number; d_cm: number; h_cm: number };
  items: Array<{ content_type: string; volume_level: "small"|"medium"|"large" }>;
  priority: "convenient" | "capacity" | "budget";
}
```

`storage_category` сюда **не идёт** (на чипах не показывают).

Фронт собирает чипы:
- размеры — формат «80 × 45 × 15 см»
- что хранить — список через запятую с `LABEL[content_type]`
- приоритет — `PRIORITY_RU[priority]`

---

## Принцип, сложившийся из решений

**Сервер шлёт только данные расчёта и эхо ввода.**
**Тексты, копирайт, метки, иконки — всё на фронте.**

Это:
- Защищает алгоритм (нет id правил, внутренних терминов)
- Упрощает контракт (меньше полей)
- Облегчает редакторские правки (поменять «удобно» → «комфортно»
  — правка одного места на фронте, без пересборки сервера)

---

## Контракты по эндпойнтам (MVP, Стадия 1)

### POST `/api/calculate`

**Request:**
```ts
interface CalculateRequest {
  drawer_width_cm: number;     // > 0
  drawer_depth_cm: number;     // > 0
  drawer_height_cm: number;    // > 0
  storage_category: "underwear" | "soft_clothes" | "accessories" | "mixed";
  items: Array<{               // 1–4 элементов
    content_type: string;      // 'panties', 'socks_regular', 'jeans', …
    volume_level: "small" | "medium" | "large";
  }>;
  priority: "convenient" | "capacity" | "budget";
  color_preference?: string;   // опционально, см. открытый вопрос #4
  session_id?: string;         // куки/анонимный ID
  consent_oferta: true;        // должен быть true; иначе 400
}
```

**Response:**
```ts
interface CalculateResponse {
  token: string;
  fit_status: "fit_all" | "fit_partial" | "fit_none" | "no_scheme";
}
```

Если `fit_status === "fit_all"` — фронт делает редирект на `/result/[token]`.
Если иначе — на `/no-fit/`.

### GET `/api/result/:token`

**Response (предлагаемая форма):**
```ts
interface ResultResponse {
  token: string;
  fit_status: "fit_all" | "fit_partial" | "fit_none" | "no_scheme";
  created_at: string;          // ISO

  // Эхо ввода — для чипов и контекста на result-странице.
  // storage_category на чипах не показывается → не шлём.
  input: {
    drawer: { w_cm: number; d_cm: number; h_cm: number };
    items: Array<{ content_type: string; volume_level: "small"|"medium"|"large" }>;
    priority: "convenient" | "capacity" | "budget";
  };

  // Схема ящика. Имена полей сохраняем как у движка (assigned_zones,
  // assigned_w_cm/...) — отрисовщик landing_design/result-render.js так
  // читает; ремап ради косметики ломал бы рабочий рендер. Сырые внутренние
  // поля (option_id, calculation_mode, layout_plan, layout_rule_evaluations,
  // selected_calculated_zones, …) сюда НЕ попадают.
  scheme: {
    drawer: { w_cm: number; d_cm: number; h_cm: number };  // для пропорций renderScheme
    assigned_zones: Array<{
      zone_id: string;
      content_type: string;
      x_cm: number; y_cm: number;
      assigned_w_cm: number; assigned_d_cm: number; assigned_h_cm: number;
    }>;
    // Сырые свободные прямоугольники из движка. Отрисовщик сам выбирает
    // «полезный» (короткая сторона ≥ 8см, max площадь) через bestReserve.
    reserve_zones: Array<{
      x_cm: number; y_cm: number; w_cm: number; d_cm: number; h_cm: number;
    }>;
  };

  // «Как сложить» — НЕ шлём. У фронта есть FOLD_TIP в content-labels.js
  // на 21 категорию; renderFolding строит список из уникальных
  // assigned_zones[].content_type и берёт текст оттуда.

  // «Почему эта схема подходит» — НЕ шлём (см. Решение №1).

  // «Обратите внимание» (content_warnings) — пока НЕ шлём.
  // Движок их строит (SchemePayload.content_warnings), отрисовщик
  // (renderWarnings) умеет читать. Wiring отложен — см. BL-07 в
  // README_ENGINE.md.

  // Подобранные SKU по блокам
  matches: Array<{
    zone_id: string;
    content_type: string;
    block_index: number;
    sku: {
      sku_id: string;
      product_title: string;
      product_url: string | null; // ссылка на товар (может быть партнёрской); фронт оборачивает карточку в <a>
      image_url: string;          // собирается на сервере (IMAGE_BASE_URL + key + .webp)
      width_cm: number; depth_cm: number; height_cm: number;
      capacity_units: number;     // для строки «11 слотов»
      rigidity: "soft" | "semi_rigid" | "rigid";  // для строки «полужёсткий»
      division_type: "cells" | "slots" | "open" | "dividers";  // для подписи «органайзер со слотами»
      color_group?: string;
    };
  }>;
}
```

Что **не** передаётся в `matches[].sku` (специально):
- `match_status`, `match_kind`, `units_needed`, `packs_needed`,
  `set_quantity` — внутренние результаты матчера; фронту для рендера
  карточки не нужны

### ~~GET `/api/sku/click/:sku_id/:platform?config_id=…`~~ — снято

Изначально планировался серверный редирект для click-логирования и
подстановки subid. Решение пересмотрено: на MVP отдаём `product_url`
прямо в `matches[].sku`, фронт делает обычный `<a target="_blank">`,
без сервера в цепочке. Часть ссылок в каталоге уже партнёрские
(monetization идёт через них), часть — публичные (без monetization).
Аудит/долив партнёрских URL — задача каталога, не серверная: см.
`BL-09` (TODO: завести в README_ENGINE.md или отдельном backlog'е).

---

## Что НЕ отдаём (security boundary)

Никогда **не попадают** в ответы API:

- `option_id`, `variant_transform`, `calculation_mode` (зон)
- `available_layout_options[]`
- `alternative_division`, `original_division_type`, `open_fallback_*`
- `layout_rule_evaluations[]` (D01–D06 сырыми)
- `layout_plan` / `selected_calculated_zones` (внутренние)
- `access_frequency`, `preferred_rigidity`, `item_gap`, `side_clear`, `fb_clear`, `h_clear`, `needs_item_gap`
- `unit_w_cm`, `unit_d_cm`, `unit_h_cm` (внутренние)
- `scheme_id`, любые внутренние ID
- Полный `engine_output` jsonb (он живёт только в БД для дебага)

---

## Открытые вопросы — статус

### #1. `storage_category` — РЕШЕНО ✓ (в бэклог)

**Сервер всегда подставляет `mixed`** при вызове engine. Поле
влияет только на защитную валидацию под несуществующий UI-сценарий
«пользователь декларирует категорию». На наш флоу не влияет.

Связанные правки записаны в README → Бэклог (`soft_clothes` vs
`clothing`, расхождение `swimwear`, возможное удаление поля из
engine). До прода не трогаем.

### #2. `renderWhy` — РЕШЕНО ✓ (фронт-only, см. выше)

См. секцию «Решения» — bullets «почему» лежат в `content-labels.js`,
сервер ничего не передаёт.

### #3. Описание блока в SKU-секции — РЕШЕНО ✓

Заполнен `BLOCK_DESC` в `content-labels.js` (21 категория × 2 =
42 строки). При рендере динамической SKU-секции описания подтянутся
автоматически. В контракт API не входит.

### #4. `color_preference` — РЕШЕНО ✓ (в бэклог)

UI цвет не спрашивает, сервер передаёт пустое — engine работает
без цветовой приоритезации, ничего не ломает. В будущем планируется
**пост-матчинговый фильтр** на выдачу SKU (не вход engine).

### #5. Маппинг `items[]` в форме — РЕШЕНО ✓ (но требует переделки формы, см. ниже)

В продакшен-`calc.js` сейчас:
- Только 6 категорий ('Носки', 'Трусы', 'Майки', 'Футболки',
  'Ремни', 'Аксессуары') — нужно 21
- 4 уровня объёма (включая «Очень много (30+)») — engine
  понимает только 3 (small/medium/large)
- Все значения — ru-строки, не коды
- **Submit-обработчика нет** (кнопка — обычная `<a>` ссылка)

**Контракт от API:** `items: Array<{content_type, volume_level}>`,
с коды (`socks_regular`, не «Носки») и уровни
(`"small"|"medium"|"large"`).

Реализация — часть **1.5a**: переписать `calc.js`, добавить
21 категорию с подгруппами-разделителями (Бельё / Одежда /
Аксессуары как заголовки), динамические подписи объёма
(«Средне (9–16 пар)» — диапазоны из библиотеки A), маппинг
ru→code при submit.

### #6. consent в `/api/calculate` — РЕШЕНО ✓

Запрос обязан содержать `consent_oferta: true`. Сервер при
сохранении configurations пишет одну запись в `consents`
(consent_type='oferta', consent_version='oferta_v1', ip,
user_agent). Без этого — 400 Bad Request.

### #7. SKU-карточки: минимальный набор полей — РЕШЕНО ✓

Включаем в карточку:
- `sku.image_url` (картинка)
- `sku.product_title` (название)
- Строка-сабтайтл: `${capacity_units} ${slot|cells label} · ${rigidity ru}`
  — например, «11 слотов · полужёсткий»
- Размер: `${w}×${d}×${h} см`
- Кнопка «Купить» → `/api/sku/click/:sku_id/:platform?config_id=…`

Не включаем (по ARCHITECTURE.md):
- Цена (внутренний ориентир, не показываем)
- Бренд (на старте не нужен)
- Цвет (можно добавить через post-match фильтр позже)

### #8. `fit_partial` поведение — РЕШЕНО ✓ (как сейчас)

Жёстко: `fit_partial` → редирект на `/no-fit/`. Пользователь
оставляет email для follow-up'а. Мягкое «показать частично» —
в бэклог.

---

## Следующие шаги (по факту)

После закрытия всех 8 открытых вопросов, осталась реализация.
План из ARCHITECTURE.md, Стадия 1:

| Шаг | Что | Статус |
|-----|-----|--------|
| 1.1 | `loadCatalogFromDb()` — engine читает из Postgres | ✓ ГОТОВО |
| 1.2 | Базовый Express API + `/api/healthz` | ✓ ГОТОВО |
| 1.3 | `POST /api/calculate` — расчёт + сохранение | ✓ ГОТОВО |
| 1.4 | `GET /api/result/:token` — чтение сохранённого | ✓ ГОТОВО (но отдаёт полный engine_output — см. ниже) |
| 1.4.5 | Привести `/api/result/:token` к контракту (срезать внутренние поля) | ✓ ГОТОВО |
| 1.5a | configure-форма: 21 категория, динамические объёмы | ✓ ГОТОВО |
| 1.5a-submit | configure-форма: submit-обработчик → POST /api/calculate | ✓ ГОТОВО |
| 1.5b | result.html → fetch → render через `result-render.js` (упрощённый renderWhy/renderFolding) | ✓ ГОТОВО |
| 1.5c | `GET /api/sku/click/:sku/:platform` + кнопки «Купить» | ✗ СНЯТО (см. ниже) |
| 1.5d | nginx-config: проксировать `/api/*` на Node | ✓ ГОТОВО |
| 1.5e | systemd-unit для Node, чтобы сервер пережил перезапуск VPS | ⏳ ПЛАН |

После 1.5 — переход к Стадии 2 (email + PDF).
