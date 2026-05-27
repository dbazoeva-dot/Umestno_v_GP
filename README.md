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

## Бэклог

Идеи и сложные случаи, отложенные на потом (чтобы не забыть):

- **Один набор (set) закрывает потребность нескольких зон сразу** — сложно и по расчёту, и по визуализации (как показать, что одна покупка относится к разным блокам).
- **Наборы из разных органайзеров** (mixed sets) — когда SKU-набор состоит из неодинаковых изделий.

Подробности по движку — в [README_ENGINE.md](./README_ENGINE.md).
