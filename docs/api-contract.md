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
  - кнопка «Купить» → ведёт на `/api/sku/click/:sku_id/:platform?config_id=...`

### `no-fit/index.html` → POST `/api/no-fit-email` (Стадия 2)
- email
- consent

### Кнопки на result-странице (Стадия 2)
- «Скачать схему PDF» → `GET /api/pdf/:token`
- «Отправить на почту» + форма → POST `/api/order/create`

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

  // Эхо ввода — для чипов и контекста на result-странице
  input: {
    drawer: { w_cm: number; d_cm: number; h_cm: number };
    storage_category: string;
    items: Array<{ content_type: string; volume_level: "small"|"medium"|"large" }>;
    priority: "convenient" | "capacity" | "budget";
  };

  // Схема ящика
  scheme: {
    drawer: { w_cm: number; d_cm: number };   // для пропорций (renderScheme)
    zones: Array<{
      zone_id: string;
      content_type: string;
      x_cm: number; y_cm: number;
      w_cm: number; d_cm: number; h_cm: number;
    }>;
    reserve_zones: Array<{
      x_cm: number; y_cm: number; w_cm: number; d_cm: number;
    }>;
  };

  // «Как сложить»
  folding: Array<{
    content_type: string;
    instruction?: string;       // fallback к foldTip из content-labels.js
  }>;

  // «Почему эта схема подходит» — УЖЕ ГОТОВЫЕ ТЕКСТЫ (без id правил)
  why_this_layout: Array<{
    text: string;               // главный bullet
    detail?: string;            // подзаголовок
  }>;

  // «Обратите внимание»
  content_warnings: Array<{
    warning_code: "compressed_storage" | "deformation_risk";
    message: string;            // готовый ru-текст
    content_type: string;
    zone_id: string;            // маркер «!» на схеме
  }>;

  // Подобранные SKU по блокам
  matches: Array<{
    zone_id: string;
    content_type: string;
    block_index: number;
    sku: {
      sku_id: string;           // нужен для ссылки на /api/sku/click
      product_title: string;
      image_url: string;        // собирается на сервере (IMAGE_BASE_URL + key + .webp)
      width_cm: number; depth_cm: number; height_cm: number;
      capacity_units: number;   // для строки «11 слотов»
      rigidity: "soft" | "semi_rigid" | "rigid";  // для строки «полужёсткий»
      division_type: "cells" | "slots" | "open" | "dividers";  // для подписи «органайзер со слотами»
      color_group?: string;
    };
  }>;
}
```

### GET `/api/sku/click/:sku_id/:platform?config_id=…`

Серверный редирект 302 на маркетплейс. Тело ответа клиенту неважно
(браузер сразу переходит по Location). На сервере пишем запись в
`affiliate_clicks`.

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
- Affiliate-URL'ы маркетплейсов (только через `/api/sku/click/`)
- Полный `engine_output` jsonb (он живёт только в БД для дебага)

---

## Открытые вопросы (НЕ финализированы)

### #1. `storage_category` — как маппится с UI?
В configure-форме сейчас доступна **одна кнопка** «Одежда для
взрослых» (Полка/Секция — disabled). Но engine принимает
`underwear | soft_clothes | accessories | mixed`. UI это явно не
спрашивает. Варианты:
- **Авто** — определять по списку `items[]` (если все категории
  underwear → underwear, и т.д.)
- **Скрытая кнопка** на форме — мы её показываем позже
- **`mixed` всегда** — если миксованный набор

**Нужно решить с тобой.**

### #2. `renderWhy` — мы НЕ должны отдавать id правил (D01, D02…)
Сейчас render читает `rules_applied: ["D01","D02"]` и сам через
`content-labels.js` превращает в текст. Это:
- Раскрывает наши id правил (мелкий, но IP-leak).
- Заставляет фронт **знать про систему правил** (плохо).

**Решение**: сервер **сам резолвит** id → текст и шлёт уже
готовые bullets:
```ts
why_this_layout: [
  { text: "Собрана под ваши индивидуальные данные" },
  { text: "Каждой категории — своё хранение",
    detail: "вещи не смешиваются, проще вернуть на место" },
  ...
]
```

Чтобы это сделать — тексты bullets должны жить **на сервере**
(в `server/content/why-rules.ts`), а не в `content-labels.js`.
Можно перенести существующие тексты из `content-labels.js`.

**Нужно решить — переносим bullets на сервер?**

### #3. Описание блока в SKU-секции
В статике каждый блок имеет описание:
> «Длинный верхний блок. Удобно видеть всё сразу и доставать
> без перекладывания.»

Это **не** из engine, это **редакторский текст**. Откуда брать:
- **Жёстко в `content-labels.js`** — таблица по
  `(content_type × division_type)` (мы уже планировали это раньше,
  в БЭКЛОГЕ был пункт `BLOCK_DESC`)
- **С сервера, отдельным полем `block_description`** в matches[]
- **Не показывать вовсе** в первой версии — оставим только
  название блока

**Нужно решить.**

### #4. `color_preference` — нужно ли спрашивать у клиента?
Сейчас в configure-форме **нет** поля «предпочтительный цвет».
Engine это умеет (через `colorPreference: string`), но UX не
собирает. Опции:
- Не собирать, отдавать пустую строку — matcher работает без
  цветовой приоритезации
- Добавить выбор «нейтральные / тёмные / яркие» в форму
- Записать в бэклог, на старте не показывать

**На MVP — пока не показываем, передаём пустое?**

### #5. Маппинг `items[]` в форме
В configure-форме блок `data-items` заполняется JavaScript-ом
(вероятно из `app.jsx` или `app.js`). Я ещё не прочла этот
файл, чтобы понять, какой именно `content_type` он шлёт.

**TODO для меня — дочитать app.js и подтвердить, какие
content_type фронт может прислать.**

### #6. consent в `/api/calculate`
Чекбокс «Я принимаю Оферту» обязателен. Если не отмечен —
кнопка submit (предполагаю) не активна. В API:
- `consent_oferta: true` обязательно
- сервер записывает в `consents` (consent_type='oferta',
  consent_version='oferta_v1', ip, ua)

**Подтвердить, что это норм.**

### #7. SKU-карточки: что показываем «под капотом»
В статике у карточки видны: картинка, name, sub («11 слотов ·
полужёсткий»), размер. Нужно решить, что ещё:
- **Кнопка «Купить»** — обязательна
- Цена? — **нет** (см. ARCHITECTURE.md: «цена для внутреннего
  ориентира, не показываем»)
- Цвет органайзера? — может быть
- Бренд? — может быть

**Нужно решить минимальный набор полей карточки.**

### #8. Что показываем для `fit_partial`?
Фронт сейчас на `fit_partial` отправляет на `/no-fit/`. Но
`fit_partial` означает «частично уложилось» — может, **показать
часть**? Нужна продуктовая политика:
- Жёстко: `fit_partial` → `/no-fit/` (как сейчас)
- Мягко: показать что есть, плюс предупреждение

**По умолчанию — жёстко, как сейчас.**

---

## Следующие шаги

1. Решить открытые вопросы #1–#8 (или зафиксировать «не сейчас»)
2. Создать TypeScript-интерфейсы из контракта в `server/api/types/`
3. Переписать `server/api/result.ts`, чтобы отдавать строго
   `ResultResponse`
4. Реализовать `server/content/why-rules.ts` (резолв правил → текст)
5. На фронте — `result/index.html` грузит `/api/result/:token` и
   вызывает `render(payload)` с новой структурой
6. Дописать `renderSkuCards(matches)` для динамических карточек
7. `/api/sku/click/:sku/:platform` — реализация эндпойнта-редиректа
