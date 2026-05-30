# Архитектура Umestno

Согласованный документ. Источник правды по тому, как устроена
система. Любое решение, противоречащее этому файлу, требует
обсуждения и явного обновления документа.

## Продукт

Калькулятор схем хранения для ящиков. Пользователь вводит размеры
ящика, состав вещей и приоритет → получает схему + конкретные
SKU-органайзеры с маркетплейсов. Доход — affiliate-комиссия с
переходов на маркетплейсы (после прода — плюс платный PDF через
ЮКассу).

## Стадии релиза

```
СТАДИЯ 1 — ЖИВОЙ КАЛЬКУЛЯТОР С СОХРАНЕНИЕМ
  Сайт принимает форму, сохраняет расчёт в БД, отдаёт схему +
  matched SKU на странице результата. Affiliate-клики
  трекаются.

СТАДИЯ 2 — EMAIL + PDF + СОГЛАСИЯ
  После расчёта пользователь оставляет email — приходит PDF.
  Согласия на ПД и оферту журналируются.
  Этого достаточно для бесплатной раздачи MVP.

СТАДИЯ 3 — YOOKASSA
  Подключается createPayment + webhook. orders.status =
  created → pending → paid. После одобрения от ЮКассы.
```

## Финальная архитектура

```
                           ┌──────────────────────────────┐
                           │   S3 + CDN                   │
                           │   картинки SKU, готовые PDF  │
                           └──────────────────────────────┘
                                          ▲
       ┌─────────┐         HTTPS          │
       │ Браузер │──────────────────┐     │
       └─────────┘                  ▼     │
                          ┌─────────────────────┐
                          │   nginx (SSL)       │
                          │   static / proxy    │
                          └──────────┬──────────┘
                                     │ /api/*
                                     ▼
                          ┌─────────────────────┐
                          │   Node API          │
                          │   (Express + pg)    │
                          └──────────┬──────────┘
                                     │ Unix-socket
                                     ▼
                          ┌─────────────────────┐
                          │   Postgres          │
                          │  (catalog + flow)   │
                          └──┬──────────────────┘
                             │
                  ┌──────────┴────────────┐
                  ▼                       ▼
        ┌─────────────────┐    ┌──────────────────────┐
        │ Cron: парсер    │    │ Админка каталога     │
        │ наличия, цен,   │    │ (NocoDB или своя)    │
        │ новинок         │    │ — после прода        │
        └─────────────────┘    └──────────────────────┘

Внешние:  YooKassa  ·  Unisender  ·  Admitad/WB/Ozon
```

## Слои кода (раз и навсегда)

```
engine/        чистая функция, ноль I/O — runUmestnoEngine(input, libs)
server/        HTTP, БД, интеграции
  api/         endpoints
  db/          pool + repository
  catalog/     loadCatalogFromDb()
  integrations/ yookassa, unisender, pdf, s3
db/
  migrations/  .sql файлы (до прода — голые, потом инструмент)
  seed/        excel→postgres, одноразовые
frontend/      static — то, что лежит в корне
```

## API surface

Определён сразу, реализуется поэтапно.

| Endpoint | Стадия |
|----------|--------|
| `POST /api/calculate` | 1 |
| `GET /api/result/:token` | 1 |
| `GET /api/sku/click/:sku/:platform` | 1 |
| `POST /api/order/create` (free) | 2 |
| `GET /api/pdf/:token` | 2 |
| `POST /api/no-fit-email` | 2 |
| `POST /api/payment/webhook` | 3 |

## База данных

14 таблиц, накатываются одной миграцией `db/migrations/0001_init_schema.sql`.

**SKU-домен** (catalog):
`sku`, `sku_marketplace_links`, `sku_availability_log`, `sku_price_log`,
`sku_candidates`, `sku_no_match_log`, `affiliate_clicks`.

**App-домен** (business flow):
`configurations`, `configuration_skus`, `orders`, `payments`,
`consents`, `emails_outbox`, `subscribers`.

**Boundary** — единственный жёсткий FK между доменами:
`configuration_skus.sku_id REFERENCES sku(sku_id)`.

Подробности по таблицам и колонкам — в самой миграции.

## SKU и каталог

### Источник правды

**Postgres**, таблица `sku`. Всё, что используется на проде, читается
оттуда. Excel — только инструмент бакового редактирования каталога
до появления админки.

### Цикл редактирования (MVP)

```
Excel (E_SKU_catalog_vNNNN.xlsx)
  │
  │ python3 engine/scripts/loadSkuToPostgres.py
  ▼
Postgres.sku
  │
  ▼
Node API (loadCatalogFromDb на старте + кеш)
  │
  ▼
Engine.matchSkus
```

После прода — Excel заменяется на админку (NocoDB или своя), таблица
не меняется.

### Картинки SKU

**Сейчас и в MVP** — статика в репо, раздаёт nginx:

```
/var/www/umestno/assets/images/sku/<image_s3_key>.webp
```

**После MVP** — переезжают в S3, схема не меняется. Меняется только
`IMAGE_BASE_URL` в `.env` приложения.

Колонка `sku.image_s3_key` называется так заранее (forward-naming):
сейчас она хранит ключ-имя-файла, после S3 будет хранить тот же
ключ, но интерпретироваться как S3-object-key.

## Что MVP отрезает

- ЮКасса (ждём одобрения)
- Парсер наличия / цен / новинок (после прода)
- Админка каталога (Excel хватит на 54 SKU; NocoDB — после прода)
- Migration tooling (1 миграция, голый psql; node-pg-migrate потом)
- S3 (картинки на VPS; миграция — одна правка env)
- Мониторинг, GA4, очереди — после прода

Эти решения **архитектурно заложены** (таблицы под YooKassa,
парсер, S3-ключи, consent-журнал), **в код не реализуются** до
прода.

## Что в MVP уже финальное

Не переделываем потом:
- Схема БД (14 таблиц)
- API контракт (эндпойнты добавляются по очереди)
- engine ↔ DB интеграция (`loadCatalogFromDb()`)
- affiliate-click трекинг
- consent журналирование

## Хостинг

Всё на одной TimeWeb VPS (Ubuntu 24.04, 5.129.253.188):
nginx + Node + Postgres.

Репо: `/var/www/umestno`. Деплой через `git pull origin main`.

SSL — Let's Encrypt + certbot, автообновление.

## Изменения этой архитектуры

Если что-то меняется (новая таблица, новый эндпойнт, переезд
SKU в S3, замена Excel на NocoDB и т.д.) — **сначала правится
этот документ**, потом код. Не наоборот.
