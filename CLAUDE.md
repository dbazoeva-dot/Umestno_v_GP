# Umestno Engine — заметки для Claude

## Архитектура
- Движок (`runUmestnoEngine`) работает **только на сервере** (Next.js API routes)
- SKU каталог — конфигурационные данные, **не выходят на фронт**
- База данных (PostgreSQL) живёт на сервере

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
