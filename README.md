# Umestno — помощник по организации хранения

Сервис подбирает органайзеры для выдвижных ящиков на основе размеров ящика и содержимого.

## Страницы

| URL | Описание |
|-----|----------|
| `umestno-home.ru/` | Лендинг |
| `umestno-home.ru/configure` | Форма конфигуратора |
| `umestno-home.ru/no-fit` | Страница «не подошло» (fit_partial / fit_none) |
| `umestno-home.ru/result/[token]` | Результат после оплаты |

## Флоу пользователя

```
/configure → POST /api/calculate
  → fit_all      → POST /api/order/create → YooKassa → webhook → email → /result/[token]
  → fit_partial
  → fit_none     → /no-fit (собрать email)
```

## Архитектура

Фронт — **статические страницы (HTML/CSS/JS)**, уже готовые в этом репозитории.
Бэкенд — лёгкий сервер на **Node** (чтобы запускать TS-движок `runUmestnoEngine`
напрямую, без переписывания). **React/Next.js для MVP не нужны.**

```
Браузер
  ↓ HTTPS
Статический фронт (этот репозиторий: /, /configure, /no-fit, /result)
  ↓ fetch
Node API (сервер)
  ├── /api/calculate       — движок + SKU matching + INSERT configurations
  ├── /api/order/create    — INSERT orders + YooKassa createPayment
  ├── /api/payment/webhook — UPDATE status=paid + email + CRM
  ├── /api/result/[token]  — схема + органайзеры
  └── /api/pdf/[token]     — PDF на бэке
        ↓
PostgreSQL — конфигурации, заказы, SKU каталог
```

- Движок (`runUmestnoEngine`) и SKU каталог — **только на сервере**, не выходят на фронт.
- Сервер на Node — потому что движок на TypeScript.
- Серверная часть (API, БД, платежи, письма, PDF) — **этап 2**; сейчас в репозитории только фронт + движок.

## Структура репозитория

```
engine/            — движок расчёта схем хранения (TypeScript)
  libraries/       — библиотеки A–E (volumeToCount, storageUnitProfile, skuCatalog…)
  sku/             — matchSkus
  scripts/         — buildSkuDb.py, exportSkuTs.py
  db/              — schema.sql, sku_catalog.db
index.html         — лендинг
landing_design/    — стили и скрипты витрины (result.css, result-render.js…)
result/            — страница результата (статическая)
configure/, no-fit/ — конфигуратор и страница «не подошло»
(server/           — Node API: планируется, этап 2)
```

## Внешние сервисы

| Сервис | Назначение |
|--------|-----------|
| YooKassa | Приём платежей (требует ИП) |
| Unisender / SendPulse | Транзакционные письма (результат + PDF) и маркетинговые рассылки — **один сервис** |
| Airtable / Telegram-бот | CRM — уведомления о заказах |
| Notion | CMS для текстов лендинга (FAQ, отзывы) — подключать после запуска |

## Хостинг и домен

- **TimeWeb** — Node + PostgreSQL (~1000 ₽/месяц)
- **Домен** `umestno-home.ru` куплен на Nethouse → DNS направить на TimeWeb

## PDF

Генерируется на бэке (Node) после подтверждения оплаты и отправляется на email.
Конкретная библиотека — на этапе серверной разработки.

## Разработка

```bash
# Движок — тесты и калибровка
npm test
npm run calibration:json
npm run calibration:json:four-item-stress

# Обновление SKU каталога
python3 engine/scripts/buildSkuDb.py   # Excel → engine/db/sku_catalog.db
python3 engine/scripts/exportSkuTs.py  # DB → skuCatalogData.ts (только для тестов)

# Фронт — статические страницы: открыть напрямую или поднять любой статик-сервер
python3 -m http.server   # затем http://localhost:8000/result/
```

## Журнал — как добавить статью

Блог живёт в папке `blog/`. Каждая статья — отдельная подпапка с `index.html` внутри.
Никаких сборок и фреймворков: чистый HTML, который сразу публикуется.

```
blog/
  index.html                       — листинг (главная блога)
  _template/index.html             — шаблон-пример для новой статьи
  kak-organizovat-yashik/index.html — пример готовой статьи
```

### Добавить новую статью

1. Скопируй папку `blog/_template/` и переименуй её в slug статьи (латиница, цифры, дефисы — это и станет URL: `umestno-home.ru/blog/<slug>/`).
2. Открой `index.html` в новой папке. Все места, которые нужно заменить, помечены `[…]` — пройдись по ним и подставь:
   - `<title>`, `<meta description>`, Open Graph (превью при шеринге);
   - категория (kicker), заголовок, лид, дата, время чтения;
   - обложка `<figure class="u-article__hero">` — путь к webp в `assets/images/blog/`;
   - тело статьи между `<article class="u-article__body">`;
   - в блоке `<script type="application/ld+json">` — те же `headline`, `description`, `image`, `datePublished` (для Яндекса/Google).
3. Добавь карточку в листинг `blog/index.html`: либо как **featured** (если это новая главная статья — заменяешь существующий блок `u-blog-featured`), либо в **сетку** `u-blog-grid` (раскомментируй пример-карточку, подставь свои поля).
4. Положи обложку в `assets/images/blog/<имя-файла>.webp`. Внутристатейные картинки — туда же.
5. Закоммить → задеплоится.

### Что есть в шаблоне «из коробки»

- Сериф-заголовки (Cormorant Garamond), узкая колонка текста, дроп-капс на первом абзаце.
- Стили для `h2`, `h3`, `blockquote` (цитата), `figure` с подписями, списков.
- В конце статьи — декоративный орнамент.
- Open Graph + JSON-LD `Article` для соцсетей и поиска.
- Общий хедер/футер сайта, ссылка «← Все статьи».

Хочешь подкрутить стиль — всё в `landing_design/blog.css`.

## Бэклог

Идеи и сложные случаи, отложенные на потом (чтобы не забыть):

- **Один набор (set) закрывает потребность нескольких зон сразу** — сложно и по расчёту, и по визуализации (как показать, что одна покупка относится к разным блокам).
- **Наборы из разных органайзеров** (mixed sets) — когда SKU-набор состоит из неодинаковых изделий.
- **Точная причина отказа на странице `no-fit/`** — движок отдаёт структурную причину (какая категория не влезла и по какому измерению, напр. «джинсы: нужен ряд 60 см, в ящике 45»), страница показывает её вместо общего текста извинения. Сейчас оставлен общий текст.
- **FAQ — один источник правды.** Тексты FAQ сейчас дублируются в `app.js` (массив `FAQS` для аккордеона) и в JSON-LD `<script>` в `<head>` лендинга (для индексации Яндексом/Google). Свести к одному источнику — либо build-шагом (`faqs.json` → генерация обоих), либо на сервере после поднятия бэка.

Подробности по движку — в [README_ENGINE.md](./README_ENGINE.md).
