# БД Umestno

Postgres 16, единая база `umestno` на VPS. Пользователь приложения —
`umestno_app`. Миграции — обычные SQL-файлы, накатываются по очереди.

## Начальная установка (один раз на VPS)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Создание БД и пользователя:

```bash
sudo -u postgres psql
```

В psql:
```sql
CREATE DATABASE umestno;
CREATE USER umestno_app WITH PASSWORD 'СЛУЧАЙНЫЙ_24+_СИМВОЛ';
GRANT ALL PRIVILEGES ON DATABASE umestno TO umestno_app;
\q
```

Затем grant на схему public:
```bash
sudo -u postgres psql -d umestno -c "GRANT ALL ON SCHEMA public TO umestno_app;"
```

Проверка коннекта:
```bash
psql -U umestno_app -d umestno -h localhost -W
```

## Первый накат миграции

На VPS (после установки Postgres и создания пользователя `umestno_app`):

```bash
cd /путь/к/репо
psql -U umestno_app -d umestno -h localhost -f db/migrations/0001_init_schema.sql
```

Если попросит пароль — введи пароль `umestno_app`.

Должно ответить `COMMIT` в конце. Никаких ошибок до этого.

## Проверка

```bash
psql -U umestno_app -d umestno -h localhost -W -c "\dt"
```

Должны быть таблицы:

- `sku`, `sku_marketplace_links`, `sku_availability_log`, `sku_price_log`,
  `sku_candidates`, `sku_no_match_log`, `affiliate_clicks`
- `configurations`, `configuration_skus`
- `orders`, `payments`
- `consents`, `emails_outbox`, `subscribers`

Всего **14 таблиц**.

## Дальнейшие миграции

Каждое изменение схемы — новый SQL-файл в `db/migrations/` с префиксом
`NNNN_*.sql` по порядку (0002, 0003…). Накатываются по одной:

```bash
psql -U umestno_app -d umestno -h localhost -f db/migrations/000N_что_делает.sql
```

Журнал применённых миграций потом подключим (когда таблиц
станет больше). На MVP — руками.

## Разделение зон

| Домен | Что | Кто меняет |
|-------|-----|------------|
| SKU-каталог | `sku*`, `affiliate_clicks` | этот чат |
| Бизнес-флоу | `configurations`, `configuration_skus`, `orders`, `payments`, `consents`, `emails_outbox`, `subscribers` | соседний чат |

Boundary — `configuration_skus.sku_id REFERENCES sku(sku_id)`. Это
единственная точка стыка между доменами.
