# Состояние VPS

Что **реально установлено** на боевой VPS, версии, пути. Обновляется
каждый раз, когда что-то добавляем или обновляем. Источник правды
для операционных вопросов «а это уже стоит?».

## VPS

| Параметр | Значение |
|----------|----------|
| Провайдер | TimeWeb |
| OS | Ubuntu 24.04 |
| IP | 5.129.253.188 |
| Домен | umestno-home.ru → этот IP |
| SSH | `ssh umestno` (alias в ~/.ssh/config) или `ssh root@5.129.253.188` |

## Установленное ПО

| Что | Версия | Назначение | Установлено |
|-----|--------|-------------|--------------|
| nginx | (по умолчанию apt) | static + reverse proxy под /api/* | да |
| certbot | (apt) | SSL Let's Encrypt, автообновление | да |
| PostgreSQL | 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1) | основная БД | да |
| python3 | (системный) | загрузчик каталога, парсер xlsx | да |
| python3-psycopg2 | (apt) | драйвер Postgres для loadSkuToPostgres.py | да |
| Node.js | 20.x (NodeSource) | runtime сервера и движка | **да** |
| npm | 10.x (с Node) | менеджер пакетов | **да** |
| pg (npm-пакет) | 8.13 | драйвер Postgres для Node | да (`npm install`) |
| express | 4.21 | веб-сервер | да |
| dotenv | 16.4 | чтение .env | да |
| typescript | 5.6 | компилятор TS | да (devDep) |
| ~/.pgpass | — | пароль `umestno_app`, chmod 600 | да |
| (далее по мере наката) | | | |

## БД — состояние

| Что | Состояние |
|-----|-----------|
| База `umestno` | создана |
| Пользователь `umestno_app` | создан, пароль в парольном менеджере |
| Миграция `0001_init_schema.sql` | накатана, 14 таблиц |
| Каталог SKU в `sku` | загружен (53 строки, из 54 в xlsx — 1 дубль) |

## Node API — состояние

| Эндпойнт | Статус |
|----------|--------|
| `GET /api/healthz` | работает, отвечает OK |
| `POST /api/calculate` | работает, сохраняет в БД, возвращает токен |
| `GET /api/result/:token` | работает, отдаёт сохранённый расчёт + matches |
| `GET /api/sku/click/...` | не реализован (1.5c) |
| nginx proxy `/api/*` → Node | **настроен** (`location /api/` → `http://127.0.0.1:3000`, см. `docs/nginx-api-snippet.conf`). Проверка: `curl -sS https://umestno-home.ru/api/healthz`. |
| systemd unit для Node API | **не настроен** (после первого деплоя добавить) |

## Файлы и пути

| Что | Путь |
|-----|------|
| Репо | `/var/www/umestno` |
| nginx config | `/etc/nginx/sites-available/default` (symlink: `sites-enabled/default`). Содержит несколько `server {}` блоков: HTTP-fallback `listen 80 default_server, server_name _`, HTTPS-production `listen 443 ssl, server_name www.umestno-home.ru umestno-home.ru` (managed by Certbot), HTTP→HTTPS redirect `listen 80; server_name umestno-home.ru`. Прод-трафик идёт в HTTPS-блок. |
| nginx SSL cert | `/etc/letsencrypt/live/umestno-home.ru/` |
| Postgres data | `/var/lib/postgresql/16/main/` (стандарт) |

## Учётные данные (НЕ в репо)

| Что | Где |
|-----|-----|
| Пароль root для VPS | парольный менеджер |
| Пароль `umestno_app` Postgres | парольный менеджер |
| API-ключи YooKassa, Unisender, S3, … | по мере добавления — в `.env` на VPS и парольный менеджер |

## Сетевые порты

| Порт | Что | Доступ |
|------|-----|--------|
| 22 | SSH | внешний |
| 80, 443 | nginx | внешний |
| 5432 | Postgres | **только localhost** (не открыт наружу) |
| 3000 | Node API (systemd `umestno-api.service`, см. `deploy/`) | только localhost, наружу через nginx /api/ |

## Бэкапы

TODO: после первого реального заказа поставить `pg_dump` в cron
(см. README.md «Бэкап»).

## Как обновлять этот документ

Каждый раз, когда:

- ставим новый софт на VPS (apt, snap, docker, …)
- меняем версию (обновили Postgres, перешли на новый Node, …)
- открываем/закрываем порт
- меняем пути ключевых файлов
- получаем новый API-ключ (его — в парольный менеджер, факт получения — сюда)

→ **сразу правим этот файл** и коммитим.
