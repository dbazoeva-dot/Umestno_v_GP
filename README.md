# Umestno — помощник по организации хранения

Сервис подбирает органайзеры для выдвижных ящиков на основе размеров ящика и содержимого.

> - **Архитектура и стадии** → [ARCHITECTURE.md](./ARCHITECTURE.md). Перед любым
>   архитектурным решением сверяйся с этим документом.
> - **Что стоит на VPS** → [docs/vps-state.md](./docs/vps-state.md). Список установленного
>   софта, версий, путей, портов. Обновляется при каждом изменении.

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
  ├── fit_all          → POST создаёт YooKassa-платёж → редирект на YooKassa
  │                      → юзер оплачивает → /result/?t=TOKEN
  │                      → /result/ поллит /api/result/:token (раз в 2 сек)
  │                      → webhook от YooKassa → /api/yookassa/webhook → orders.status='paid'
  │                      → /result/ рендерит схему
  │
  ├── fit_partial      → /no-fit/?t=TOKEN  (оплату не предлагаем)
  ├── fit_none         → /no-fit/?t=TOKEN  (оплату не предлагаем)
  └── no_scheme        → /no-fit/?t=TOKEN  (оплату не предлагаем)

dev-режим разработчика (PAYMENT_REQUIRED=false):
  fit_all → orders.status='sent_free' сразу → редирект на /result/?t=TOKEN
  (без YooKassa)
```

Подробности модели данных и lifecycle заказа — в [docs/data-model.md](./docs/data-model.md).

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
  ├── /api/healthz          — GET: проверка живости (status, env, catalog_size)
  ├── /api/calculate        — POST: движок + SKU match + INSERT configurations + orders
  │                           + INSERT consents (oferta) + при fit_all создаёт YooKassa-платёж
  │                           → {token, fit_status, can_pay, payment_url}
  ├── /api/result/:token    — GET: схема + органайзеры. ГЕЙТИТСЯ по orders.status:
  │                           paid/sent_free → 200 с данными; иначе → 402 payment_required
  ├── /api/pdf/:token       — GET: PDF на бэке через Puppeteer. Тот же гейт что у /api/result
  ├── /api/order/email      — POST: дополняет orders.email + INSERT consents (pd)
  │                           + INSERT emails_outbox (отправка через Unisender, асинк)
  └── /api/yookassa/webhook — POST: подтверждение от YooKassa → INSERT payments
                                + UPDATE orders.status='paid'
        ↓
PostgreSQL — конфигурации, заказы, согласия, платежи, SKU каталог
```

- Движок (`runUmestnoEngine`) и SKU каталог — **только на сервере**, не выходят на фронт.
- Сервер на Node — потому что движок на TypeScript.
**Состояние реализации:**
- **Стадия 1** (расчёт + сохранение в БД) — ✓ готово, на VPS под systemd
  (calculate, result, healthz, security-middleware).
- **Стадия 2** (email + PDF + согласия) — в работе. На сервере есть
  `INSERT consents` в `/api/calculate`; остальное (PDF-рендер,
  `/api/order/email`, emails-worker) ещё не написано.
- **Стадия 3** (YooKassa) — после Стадии 2. Согласована модель данных
  (см. [docs/data-model.md](./docs/data-model.md)), реализации ещё нет.
- Подмодули `server/integrations/` (yookassa, unisender, pdf) появятся
  по мере того как будем писать.

## Структура репозитория

```
engine/                — движок расчёта схем хранения (TypeScript)
  libraries/           — библиотеки A–E (volumeToCount, storageUnitProfile, skuCatalog…)
  sku/                 — matchSkus
  scripts/             — buildSkuDb.py, exportSkuTs.py, loadSkuToPostgres.py
  db/                  — schema.sql, sku_catalog.db

server/                — Node API (Express + pg, TypeScript)
  index.ts             — entry-point + GET /api/healthz
  api/                 — endpoint handlers (calculate, result, ...)
  catalog/             — loadCatalogFromDb
  config/              — env-парсинг (dotenv)
  db/                  — pg pool
  middleware/          — security (rate-limit, Origin check)
  test/                — manual smoke tests
  (integrations/       — yookassa, unisender, pdf-рендер — Стадии 2/3, ещё не написано)

db/migrations/         — SQL миграции (0001 init, 0002 sku affiliate; 0003 orders_central — в плане)
deploy/                — systemd unit + инструкция по обновлению API

index.html             — лендинг
landing_design/        — стили и скрипты витрины (result.css, result-render.js, content-labels.js, calc.css...)
result/                — страница результата (статическая, рендерится из API + Puppeteer для PDF)
configure/, no-fit/    — конфигуратор и страница «не подошло»
oferta/, privacy/      — юридические документы (статика)
blog/                  — журнал статей
docs/                  — внутренние документы (data-model.md, api-contract.md, vps-state.md, ...)
```

## Внешние сервисы

| Сервис | Назначение |
|--------|-----------|
| YooKassa | Приём платежей (требует ИП) |
| Unisender / SendPulse | Транзакционные письма (результат + PDF) и маркетинговые рассылки — **один сервис** |
| Airtable / Telegram-бот | CRM — уведомления о заказах |
| Notion | CMS для текстов лендинга (FAQ, отзывы) — подключать после запуска |

## Хостинг и домен

- **TimeWeb VPS** (5.129.253.188, Ubuntu 24.04) — nginx, Node, PostgreSQL на одной машине
- **Репо на VPS:** `/var/www/umestno` (`git pull origin main` из этой папки)
- **Домен** `umestno-home.ru` куплен на Nethouse → DNS направлен на TimeWeb VPS
- **SSL** — Let's Encrypt через certbot, автообновление

## БД (Postgres 16 на VPS)

База — на той же VPS, не managed. Подключение через Unix-socket / localhost.

| Параметр | Значение |
|----------|----------|
| Database | `umestno` |
| User | `umestno_app` |
| Host | `localhost` |
| Port | `5432` (дефолт) |
| Пароль | в парольном менеджере (НЕ в репо) |

### Накат миграций

Миграции — обычные SQL-файлы в `db/migrations/`. Накатываются вручную в порядке номеров:

```bash
cd /var/www/umestno
psql -U umestno_app -d umestno -h localhost -f db/migrations/000N_*.sql
```

После каждого наката проверь через `\dt` в psql, что таблицы появились.

### Бэкап (TODO: добавить в cron)

```bash
sudo -u postgres pg_dump -Fc umestno > /var/backups/umestno-$(date +%F).dump
```

Делать раз в сутки в cron'е после того, как пойдут реальные заказы.

### Восстановление

```bash
sudo -u postgres pg_restore -d umestno --clean /var/backups/umestno-YYYY-MM-DD.dump
```

## PDF

Генерируется на бэке через **Puppeteer** (headless Chromium): сервер
открывает `/result/?t=TOKEN&print=1`, снимает PDF, отдаёт файлом.

Доставка — два пути:
1. **Прямое скачивание** с `/result/` через кнопку «Скачать схему PDF».
   Эндпоинт `GET /api/pdf/:token` гейтится по `orders.status`:
   `paid` / `sent_free` → 200 + PDF; иначе → 402 `payment_required`.
2. **На email** — через форму на `/result/` («Отправить на почту»).
   `POST /api/order/email` дополняет `orders.email`, кладёт письмо
   в `emails_outbox` с шаблоном `result` + ссылкой на PDF; воркер
   раз в минуту отправляет через Unisender.

PDF в письме отдаётся **ссылкой** на `/api/pdf/:token`, а не вложением —
так юзер всегда получает свежий рендер из актуального `engine_output`,
а не «снимок» на момент письма.

Реализация — Стадия 2 (планируется, ещё не написано). После того как
PDF-рендер будет готов, обновим эту секцию финальными деталями
(структура страниц PDF, шрифты, стиль, размер итогового файла).

## Разработка

```bash
# Движок — тесты и калибровка
npm test
npm run calibration:json
npm run calibration:json:four-item-stress

# Обновление SKU каталога — Excel → JSON для тестов / загрузки в БД
python3 engine/scripts/extractSkuCatalog.py E_SKU_catalog_vNNNN.xlsx > /tmp/catalog.json

# Бенчмарк раскладок (10 эталонных сценариев)
CATALOG=/tmp/catalog.json node dist/engine/test/benchmark10.js
# A/B сравнение column-first вкл/выкл
CATALOG=/tmp/catalog.json node dist/engine/test/benchmark10Compare.js

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

- **Через 2.5 года от первого реального юзера — РЕВИЗИЯ retention-механизма.**
  В `docs/data-model.md` зафиксирована политика хранения: через 3 года
  после `created_at` ежемесячный cron анонимизирует `configurations.input_payload`,
  `configurations.engine_output`, `orders.email/ip/user_agent/session_id` и
  `consents.email/ip/user_agent` (id/fit_status/granted_at/order_id и
  финансовые поля остаются для воронки и бухучёта). На MVP cron не нужен
  (нет данных старше 3 лет). За 6 месяцев до того, как первые записи
  достигнут возраста 3 года — **проверить и включить cron-job**. Сценарий
  на 2028: посмотреть БД, сравнить с ожиданиями, написать
  `db/jobs/anonymize_retired.sql` под `pg_cron` или внешний планировщик.

- **Поле `storage_category` в engine — разобраться, нужно ли вообще.** Сейчас на расчёт никак не влияет (только защитная валидация под несуществующий UI-сценарий «пользователь декларирует категорию»). Сервер всегда подставляет `mixed`. Связанные правки тоже сюда (не делать до прода):
  - `soft_clothes` в engine vs `clothing` в библиотеке A — переименовать ради консистентности
  - `swimwear` — расхождение классификации (в библиотеке A → accessories, в engine + content-labels.js → underwear)
  - Возможно совсем убрать `storage_category` из сигнатуры `runUmestnoEngine`

- **Каталог SKU — актуализация и монетизация (критично, сразу после запуска MVP).**
  - **Парсер наличия** — суточный cron по всем SKU маркетплейсов; движок скипает out-of-stock и предлагает замены. Главный блокер: уже сегодня в каталоге есть отсутствующие позиции, схема ведёт в пустоту.
  - **Поиск новых позиций** — еженедельный обход маркетплейсов по списку категорийных запросов (~30 штук: «органайзер для ящика», «разделитель для белья», «контейнер 30 см» и т.п.). Парсим габариты, фото, бренд, артикул; дедуп против существующего каталога; новинки → таблица `sku_candidates` с пометкой `source_query`. Финальное одобрение — вручную (присвоить `content_types` и `slot_type`), автомат на это не годится. Без этого каталог не растёт и быстро устаревает (IKEA-замены, новые коллекции).
  - **Цена** — парсим для внутреннего ориентира (пригодится для будущего режима «Бюджетно»), но не показываем: цена индивидуальна (регион, статус покупателя, способ оплаты), единой «правильной» цены не существует.
  - **Affiliate-ссылки** — дополнительный источник дохода поверх paywall. Поля `affiliate_url_*` по площадкам, subid с `orders.id` для трекинга конверсии. В каталоге сейчас часть ссылок уже партнёрские (см. BL-09 в README_ENGINE.md), часть — обычные публичные.

    **История решения:** изначально была идея A/B-теста «affiliate как основной доход (PDF бесплатно)» vs «paywall (PDF платный)». Отказались от первой модели **в пользу paywall** из-за фактического отсутствия на российском рынке нормальных автоматизированных affiliate-программ маркетплейсов — WB Партнёры / Ozon Партнёры / Admitad на сегодня не дают рабочей механики «зарегистрировался → выгружай ссылки → получай комиссию». Возможный путь — **прямые договорённости с отдельными селлерами** (one-on-one деалы), но это не автоматизируется и не масштабируется как основной источник дохода. Решение **обратимое** — если рынок появится, можно вернуться к A/B-тесту.
- **Второй прогон движка под каталог (после запуска MVP).** Текущий поток: движок строит зону → матчер ищет SKU → если не нашёл, отдаёт `no_match`. Идея: после первого прохода матчер возвращает в движок «ближайший подходящий SKU по геометрии» (даже если не прошёл по жёстким фильтрам), движок перестраивает зону под форму этого SKU и матчер пробует ещё раз. Должен закрыть случаи, где зона по расчёту 25 см, а на рынке стандарт 32 см: движок «дотягивает» зону до рыночной формы. Не делать до прода — стабильное поведение важнее «идеального» матчинга.
- **Один набор (set) закрывает потребность нескольких зон сразу** — сложно и по расчёту, и по визуализации (как показать, что одна покупка относится к разным блокам).
- **Наборы из разных органайзеров** (mixed sets) — когда SKU-набор состоит из неодинаковых изделий.
- **Точная причина отказа на странице `no-fit/`** — движок отдаёт структурную причину (какая категория не влезла и по какому измерению, напр. «джинсы: нужен ряд 60 см, в ящике 45»), страница показывает её вместо общего текста извинения. Сейчас оставлен общий текст.
- **FAQ — один источник правды.** Тексты FAQ сейчас дублируются в `app.js` (массив `FAQS` для аккордеона) и в JSON-LD `<script>` в `<head>` лендинга (для индексации Яндексом/Google). Свести к одному источнику — либо build-шагом (`faqs.json` → генерация обоих), либо на сервере после поднятия бэка.
- **Uptime-мониторинг.** Внешний пинг сайта с алертами при падении. На MVP не критично (отслеживаем по YooKassa-webhook'ам, Вебмастеру, Метрике). Варианты на выбор: Ping-Admin (с их кнопкой или платно), Site24x7, Telegram-бот, или GitHub Actions cron — определимся, когда пойдут реальные заказы.
- **Google Analytics 4.** Подключать, если появится потребность: англоязычная версия сайта, Google Ads (сейчас в РФ не работают), глобальная аудитория. На MVP покрывается Метрикой.

Подробности по движку — в [README_ENGINE.md](./README_ENGINE.md).
