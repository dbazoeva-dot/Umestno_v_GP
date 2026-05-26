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

```
Браузер
  ↓ HTTPS
Next.js (TimeWeb) — web/
  ├── Страницы (React)
  ├── /api/calculate    — движок + SKU matching + INSERT configurations
  ├── /api/order/create — INSERT orders + YooKassa createPayment
  ├── /api/payment/webhook — UPDATE status=paid + email + CRM
  ├── /api/result/[token]  — схема + органайзеры
  └── /api/pdf/[token]     — PDF через @react-pdf/renderer
        ↓
PostgreSQL (TimeWeb) — конфигурации, заказы, SKU каталог
```

- Движок (`runUmestnoEngine`) и SKU каталог — **только на сервере**, не выходят на фронт.
- Всё в одном Next.js приложении (`web/`).

## Структура репозитория

```
engine/          — движок расчёта схем хранения
  libraries/     — библиотеки A–E (volumeToCount, storageUnitProfile, skuCatalog…)
  sku/           — matchSkus
  scripts/       — buildSkuDb.py, exportSkuTs.py
  db/            — schema.sql, sku_catalog.db
web/             — Next.js приложение
  src/app/       — страницы и API routes
```

## Внешние сервисы

| Сервис | Назначение |
|--------|-----------|
| YooKassa | Приём платежей (требует ИП) |
| Unisender / SendPulse | Транзакционные письма (результат + PDF) и маркетинговые рассылки — **один сервис** |
| Airtable / Telegram-бот | CRM — уведомления о заказах |
| Notion | CMS для текстов лендинга (FAQ, отзывы) — подключать после запуска |

## Хостинг и домен

- **TimeWeb** — Next.js + PostgreSQL (~1000 ₽/месяц)
- **Домен** `umestno-home.ru` куплен на Nethouse → DNS направить на TimeWeb

## PDF

Генерация на бэкенде через `@react-pdf/renderer`.  
Отправляется автоматически на email после подтверждения оплаты.

## Разработка

```bash
# Движок — тесты и калибровка
npm test
npm run calibration:json
npm run calibration:json:four-item-stress

# Обновление SKU каталога
python3 engine/scripts/buildSkuDb.py   # Excel → engine/db/sku_catalog.db
python3 engine/scripts/exportSkuTs.py  # DB → skuCatalogData.ts (только для тестов)

# Next.js
cd web && npm run dev
```

Подробности по движку — в [README_ENGINE.md](./README_ENGINE.md).
