# PDF «Ваша схема хранения» — дизайн-бриф

Handoff от Claude Design (v3 «техническая плита ателье»). Здесь — сокращённая
версия для отсылки при будущих правках; полная версия handoff'а есть
в архиве разговора.

## Назначение

Post-purchase PDF — главный артефакт после оплаты 149 ₽. Документ
должен ощущаться как **премиальный гайд от заботливого сервиса**,
не как принт веб-страницы. Юзер скачает и/или распечатает.

Рендерится Puppeteer'ом (без JS на момент снятия — данные подтягивает
`pdf-render.js` ДО того как ставит `data-pdf-ready=1`).

## Жёсткие технические ограничения

1. **A4 portrait, 1–2 страницы** (`<section class="sheet">` × 2).
2. **Никаких cqw/cqh** — Chrome print-mode мисхэндлит контейнер-юниты,
   вёрстка плывёт в реальном PDF. Только `mm`, `pt`, `%`.
3. **`print-color-adjust:exact`** — без этого фоны теряются при печати.
4. **Шрифты**: Cormorant Garamond (display), Manrope (body), JetBrains
   Mono (eyebrows/labels) — как на сайте. На MVP подгружаются через
   Google Fonts `<link>`. Для надёжности Puppeteer-рендера можно
   потом захостить локально.

## Структура страниц (НЕ менять порядок)

### Страница 1
1. **Masthead** — логотип + meta (заказ, дата) + eyebrow «Результаты
   расчёта» + lede-абзац.
2. **Схема** — eyebrow «Ваша схема хранения» + плита `.scheme__plate`
   с реальным `.u-res-scheme` (через `renderScheme` из result-render.js)
   + caption «Илл. 1».
3. **Спек-таблица** — eyebrow «Размеры зон» + панель с шапкой (внутренние
   размеры ящика) + строки блоков с цветными номерами + (опц.) резерв.

### Страница 2
4. **Warnings** (только если есть) — eyebrow `.seclbl--warn` «Будьте
   внимательны» + .warn-блоки (compressed_storage / deformation_risk).
5. **Складывание** — eyebrow «Как правильно сложить вещи» + .fold
   grid 2×2: head (номер + заголовок) сверху, картинка снизу. Без рамок.
6. **Коммерческий подвал** — «Спасибо, что выбрали Уместно» + соцсети
   + блог-ссылка + номер заказа.

Сквозной **левый спайн 17мм** на обеих страницах: вертикальный wordmark
+ tick-line + номер страницы. **Running footer** «umestno-home.ru» внизу
обеих. Страница 2 имеет **running head** (мелкий wordmark + номер заказа).

## Eyebrow-система (ВАЖНО)

**Нет крупных H2**. Каждая секция вводится только мелким моноширинным
капсом-eyebrow с трейлинг-хейрлайном (`.seclbl`). Тексты ровно такие:
- «Ваша схема хранения»
- «Размеры зон»
- «Будьте внимательны» (вариант `.seclbl--warn`)
- «Как правильно сложить вещи»

Единственный «крупный» заголовок — eyebrow `.masthead__kick`
«Результаты расчёта» (тоже мелкий моноширинный, но в акцентном цвете).

## Цвета зон (b1..b4) — синхронизированы

```
--b1: #EBDFC4   (бежевый)
--b2: #A6B38C   (sage green)
--b3: #EDEAE1   (light)
--b4: #DDC59B   (sand)
```

Используются:
- В схеме (через градиенты `.blk--1..4`) — но в проде это лежит на
  `.u-res-scheme` через `renderScheme`, который сам красит свои `.b1..b4`.
- В таблице блоков (`.brow__num` inline `style="background:var(--bN)"`).
- В карточках складывания (`.fold-card__n` inline `style`).

JS подставляет цвет из массива `BLOCK_COLORS` (тот же что в
`result-render.js`).

## Динамические данные (что подтягивает pdf-render.js)

| Слот | data-pdf | Источник |
|---|---|---|
| Номер заказа (masthead) | `order-num` | `payload.order_id` (первые 8 hex, uppercase) |
| Дата (masthead) | `date` | `payload.created_at` (формат `DD.MM.YYYY`) |
| Размеры ящика | `drawer` | `payload.scheme.drawer.{w,d,h}_cm` |
| Схема | `scheme` (контейнер `.u-res-scheme__inner`) | `UMESTNO.renderScheme(scheme, drawer)` |
| Строки таблицы | `blocks-rows` | `payload.scheme.assigned_zones` + `bestReserve(reserve_zones)` |
| Секция warnings | `warnings-section` (hidden если пусто) | фильтр по `content_warnings` |
| Список warnings | `warnings` | `UMESTNO_CONTENT.warningText(code, content_type)` |
| Карточки складывания | `folding` | уникальные `content_type` из зон + `FOLDING_IMAGES` |
| Номер заказа (runhead) | `runhead-order` | то же что `order-num`, формат «ЗАКАЗ № …» |
| Номер заказа (ftband) | `ftband-order` | то же, формат «Заказ № …» |

## Ассеты

- `landing_design/assets/logo-wordmark-tagline.svg` — masthead (height: 12mm)
- `landing_design/assets/logo-wordmark.svg` — runhead страница 2 (height: 5mm)
- `landing_design/assets/folding/{boxers,panties,socks,sport_tops}.webp` —
  иллюстрации фолдинга для 4 категорий. Для остальных категорий
  карточка рендерится без картинки.

## Backlog для будущей итерации

1. Захостить шрифты локально (вместо Google Fonts) — Puppeteer надёжнее
2. Добавить иллюстрации фолдинга для остальных категорий
3. Возможный 3-й лист если warnings очень много или блоков > 4
4. Печатный CMYK-вариант (если будут реально печатать в типографии)
