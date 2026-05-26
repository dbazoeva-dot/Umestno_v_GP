# Umestno Engine — заметки для Claude

## Архитектура
- Движок (`runUmestnoEngine`) работает **только на сервере** (Next.js API routes)
- SKU каталог — конфигурационные данные, **не выходят на фронт**
- База данных (PostgreSQL) живёт на сервере
- Всё в одном Next.js приложении (`web/`), статики отдельно нет

## Страницы
```
umestno-home.ru/               — лендинг
umestno-home.ru/configure      — форма конфигуратора
umestno-home.ru/no-fit         — страница ошибки (fit_partial / fit_none)
umestno-home.ru/result/[token] — результат после оплаты (динамический)
```

## Флоу пользователя
```
/configure → POST /api/calculate
  → fit_all → POST /api/order/create → YooKassa → webhook → email → /result/[token]
  → fit_partial / fit_none → /no-fit (собрать email)
```

## API routes
- `POST /api/calculate` — движок + matchSkus + INSERT configurations
- `POST /api/order/create` — INSERT orders + YooKassa createPayment
- `POST /api/payment/webhook` — UPDATE status=paid + email + CRM
- `GET /api/result/[token]` — схема + блоки + органайзеры
- `GET /api/pdf/[token]` — PDF через @react-pdf/renderer (не Puppeteer)

## Внешние сервисы
- **YooKassa** — платежи (требует ИП)
- **Один email-сервис на всё** — и транзакционные письма (результат+PDF), и маркетинговые рассылки. Например Unisender или SendPulse (русскоязычные)
- **CRM** — Airtable или Telegram-бот
- **Notion** — CMS для текстов лендинга (FAQ, отзывы, выгоды) — подключать после запуска

## Хостинг
- **TimeWeb** — Next.js + PostgreSQL (~1000 ₽/месяц)
- **Домен** umestno-home.ru куплен на Nethouse, DNS направить на TimeWeb

## PDF
- Генерация на бэкенде через `@react-pdf/renderer` (не Puppeteer — тяжёлый)
- Отправляется автоматически на email после оплаты

## Временные файлы (удалить при разработке /api/calculate)
- `engine/libraries/skuCatalogData.ts` — сгенерирован для тестов, **не для продакшена**
- `engine/scripts/exportSkuTs.py` — тоже только для тестов
- В `/api/calculate` каталог читается из PostgreSQL напрямую, не из TS-файла

## SKU matching — согласованные допуски
- `|cell_width_cm - unit_w_cm| ≤ 3`
- `|cell_depth_cm - unit_d_cm| ≤ 1.5` (симметрично, не одностороннее)
- `unit_h_cm - 3 ≤ height_cm ≤ unit_h_cm + 5`
- Footprint: вписывается в зону с учётом can_rotate
- Capacity: `capacity_units * set_quantity ≥ count`

## Обновление каталога
```bash
python3 engine/scripts/buildSkuDb.py   # Excel → engine/db/sku_catalog.db
python3 engine/scripts/exportSkuTs.py  # DB → skuCatalogData.ts (только для тестов)
git add engine/libraries/skuCatalogData.ts && git commit && git push
```
