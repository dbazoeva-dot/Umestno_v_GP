# Модель данных — целевая

Документ описывает **целевую** структуру данных проекта: какие сущности
есть, как они связаны, через какие поля. Текущая схема в
`db/migrations/0001_init_schema.sql` отличается от целевой — см. раздел
[«Что меняется» в конце](#что-меняется-от-текущей-схемы-к-целевой).

## Философия модели

**`orders` — центральная коммерческая сущность.** Создаётся **в момент
сабмита формы** («Получить расчёт»). Через неё считается воронка,
ведётся учёт согласий, тянутся ссылки на платежи, отправленные письма,
выбранные SKU. Заказ — это **факт обращения клиента к услуге**, не
обязательно оплаченный.

**`configurations` — технический след движка.** Создаётся 1:1 рядом с
`orders` в момент сабмита, но хранит **только** инженерные данные:
что юзер ввёл в форму, что выдал движок, какой `fit_status`. Используется
для дебага, рендера схемы, и аналитики работы алгоритма (например, «какие
комбинации параметров чаще всего дают `fit_none`»). На коммерческие
запросы (сколько заказов, сколько оплачено) не отвечает.

**Правило:** клиентские запросы → `orders`. Технические/движковые → 
`configurations`. Один заказ — одна конфигурация. Один к одному.

## Схема связей

```
                      ┌─────────────────┐
                      │   orders        │ ◄── центр всего
                      │   (заказ)       │
                      └────┬────────────┘
                           │
       ┌───────────────────┼───────────────────────────┐
       │                   │                           │
       ▼                   ▼                           ▼
┌──────────────┐   ┌──────────────┐         ┌────────────────┐
│configurations│   │  consents    │         │  payments      │
│(трейс движка)│   │(152-ФЗ)      │         │ (YooKassa)     │
└──────┬───────┘   └──────────────┘         └────────────────┘
       │
       ▼
┌──────────────────┐         ┌────────┐
│configuration_skus│────────►│  sku   │
│(подобранные)     │         │(каталог)│
└──────────────────┘         └────────┘

также к orders прицепляются:
- emails_outbox (письма, которые мы отправили этому заказу)
- subscribers (если юзер согласился на маркетинг — попадает сюда с FK на свой order)
- affiliate_clicks (клики по партнёрке этого заказа — будущее)
- promo_code_usages (применённый промокод — будущее)
```

## Жизненный цикл заказа (paywall-модель)

**Принцип:** `/result/` — это **платный контент**. Полная схема, таблица
размеров, фолдинг — отдаются только после `orders.status='paid'`.

**Фиксация терминологии (раз и навсегда):** на проде `PAYMENT_REQUIRED=true`
**всегда**. Paywall — это **единственная** боевая модель.
`PAYMENT_REQUIRED=false` и связанный статус `'sent_free'` существуют
**исключительно как dev-обход** для локальной разработки, чтобы инженер
мог гонять `/api/calculate` и `/result/` без поднятой YooKassa-интеграции.
Это **не продуктовая фича**, не «бесплатная раздача», не «free-MVP» — это
техническая возможность не подключать платёжный провайдер в dev-окружении.
После того как YooKassa-код будет написан и оттестирован, в проде значение
`PAYMENT_REQUIRED` будет жёстко `true` и никогда обратно не переключится.
В исторических заказах статус `sent_free` может остаться как след
dev-периода до публичного запуска (см. BL-13).

**Переключатель `PAYMENT_REQUIRED` в .env:**
- `PAYMENT_REQUIRED=true` (прод) — настоящий гейт через YooKassa.
  После `/api/calculate` юзер с `fit_all` отправляется на оплату. До оплаты
  `/api/result/:token` возвращает 402 Payment Required.
- `PAYMENT_REQUIRED=false` (dev-режим разработчика, **только локально**) — сервер
  при создании заказа с `fit_all` сразу выставляет `status='sent_free'`,
  юзер проходит гейт без оплаты. Архитектура та же, разница — одна ветвь
  в коде «выставляем paid или sent_free».

```
1. Юзер заполняет /configure/, жмёт «Получить расчёт»
   → POST /api/calculate
   → Сервер:
     a) выполняет движок → scheme_payload, fit_status
     b) INSERT configurations
     c) INSERT orders с FK на configuration:
        - token (URL-friendly), session_id, ip, user_agent
        - fit_status (копия из движка)
        - base_price_kop = PRICE_KOP из .env (всегда, snapshot оферты)
        - discount_kop:
          • PAYMENT_REQUIRED=false (dev) → = base_price_kop (полная скидка)
          • в проде                       → 0 (промокоды появятся в Стадии 4+)
        - amount_kop = base_price_kop - discount_kop
        - status:
          • fit_all + PAYMENT_REQUIRED=false → 'sent_free' (dev-режим)
          • fit_all + PAYMENT_REQUIRED=true  → 'created' (ждём оплату)
          • не fit_all                       → 'created' (платить нечего)
                                                amount_kop остаётся 14900
                                                для аналитики упущенного
                                                дохода (см. шаг 3)
     d) INSERT consents (consent_type='oferta', order_id=новый)
     e) INSERT configuration_skus (по каждой подобранной SKU)
   → Возвращает {token, fit_status, can_pay}
     - can_pay = (fit_status in ('fit_all','fit_all_after_adjustment') AND PAYMENT_REQUIRED)
     - в dev-режиме can_pay=false всегда (оплачивать нечего, уже sent_free)

2a. fit_all + PAYMENT_REQUIRED=true (paywall режим):
    → can_pay=true → фронт ведёт на платежную страницу (или сразу на YooKassa)
    → POST /api/order/pay → создаём платёж в YooKassa, status='pending', возвращаем payment_url
    → юзер платит → YooKassa webhook → INSERT payments + UPDATE orders SET status='paid', paid_at=now()
    → юзер редиректится на /result/?t=TOKEN
    → GET /api/result/:token проверяет status='paid' (или 'sent_free') → ОК → отдаёт полный payload
    → /result/ рендерится: схема, таблица, фолдинг, кнопки «Скачать PDF» и «Email»

2b. fit_all + PAYMENT_REQUIRED=true, юзер НЕ платит:
    → status остаётся 'created' (или 'pending' если начал но не закончил)
    → если кликает в /result/?t=TOKEN → GET /api/result/:token возвращает 402 Payment Required
    → фронт показывает payment-prompt вместо схемы («оплатите 149 ₽ чтобы увидеть результат»)

2c. fit_all + PAYMENT_REQUIRED=false (dev-режим разработчика, только локально):
    → can_pay=false, status='sent_free' уже выставлен в шаге 1
    → юзер сразу редиректится на /result/?t=TOKEN
    → GET /api/result/:token: status='sent_free' → ОК → отдаёт полный payload
    → юзер видит результат без всякой оплаты

3. fit_partial / fit_none / no_scheme:
   → can_pay=false (платить за неполный результат нельзя)
   → фронт редиректит на /no-fit/?t=TOKEN
   → orders.status остаётся 'created' навсегда
   → orders.base_price_kop=14900, discount_kop=0, amount_kop=14900
     (фиксируем «полную цену» для аналитики упущенного дохода:
     SUM(amount_kop) WHERE status='created' AND fit_status='fit_partial'
     показывает сколько потенциально потеряли. См. секцию orders ниже.)
   → YooKassa-платёж НЕ создаётся
   → /no-fit/ показывает «не подобрали» + опц. форма email для follow-up
   → реальных денег с юзера не берём ни в каком режиме (orders.status
     никогда не станет 'paid'); amount_kop здесь — только snapshot
     для аналитики

4. Email follow-up (любой сценарий, в т.ч. no-fit):
   → юзер вводит email на /result/ или /no-fit/
   → POST /api/order/email
   → INSERT consents (consent_type='pd', order_id=...)
   → UPDATE orders SET email=?
   → INSERT emails_outbox с шаблоном по сценарию ('result' / 'no-fit-followup')
   → воркер раз в минуту отправляет через Unisender

5. PDF (только если status in ('paid','sent_free')):
   → GET /api/pdf/:token
   → если status не в ('paid','sent_free') → 402 Payment Required
   → если да → рендерим PDF через Puppeteer
   → UPDATE orders SET sent_at=now() (для первого скачивания)
```

**Важное следствие для серверного кода:**

- `GET /api/result/:token` теперь не просто читает БД, а **гейтится**:
  ```ts
  if (!['paid', 'sent_free'].includes(orders.status)) {
    return res.status(402).json({ ok: false, error: 'payment_required' });
  }
  ```
- `GET /api/pdf/:token` — тот же гейт.
- В dev-режиме гейт всегда пропускает (потому что `status='sent_free'`), но
  **архитектурно код одинаковый для обоих режимов**. Переключение через
  `.env` без правок кода.

---

## Таблицы — целевая структура

### `orders` (центральная)

| колонка | тип | описание |
|---|---|---|
| `id` | uuid PK | внутренний идентификатор заказа |
| `token` | text UNIQUE NOT NULL | URL-friendly публичный токен (то что в `/result/?t=...`). 22 base64url-символа. |
| `created_at` | timestamptz NOT NULL DEFAULT now() | момент сабмита формы |
| `session_id` | text | анонимный куки/session-ID (UUID), для трекинга «один человек — несколько заказов» |
| `ip` | inet | IP клиента в момент сабмита (для 152-ФЗ + fraud) |
| `user_agent` | text | браузер клиента в момент сабмита |
| `configuration_id` | uuid NOT NULL REFERENCES configurations(id) | FK на технический трейс |
| `fit_status` | text NOT NULL CHECK (...) | копия из конфигурации: `fit_all` / `fit_partial` / `fit_none` / `no_scheme` / `fit_all_after_adjustment`. Денормализовано для быстрых выборок «сколько fit_all за неделю» без JOIN. |
| `email` | text | NULL пока юзер не оставил почту. После — заполняется. |
| `phone` | text | NULL. Зарезервировано на будущее (если когда-нибудь добавим). |
| `status` | text NOT NULL DEFAULT 'created' CHECK (...) | `created` / `pending` / `paid` / `failed` / `refunded` / `sent_free`. `sent_free` — статус **только для dev-обхода** (`PAYMENT_REQUIRED=false`, локальная разработка без YooKassa). В проде никогда не выставляется. После запуска переделывается, см. BL-13. |
| `base_price_kop` | int NOT NULL | цена по оферте на момент создания заказа (snapshot). Если оферта потом поменяет цену, в исторических заказах остаётся та что была при заказе. |
| `discount_kop` | int NOT NULL DEFAULT 0 | скидка в копейках (через `promo_code_id` сейчас, в будущем — другие механики). |
| `amount_kop` | int NOT NULL DEFAULT 0 | к оплате после скидки = `base_price_kop - discount_kop`. Сюда смотрит YooKassa-интеграция. Если 0 (full discount via free-промо) — YooKassa не дёргается, сразу `status='paid'`. |
| `promo_code_id` | uuid REFERENCES promo_codes(id) | NULL если без промокода. (Таблица появится в Стадии 3 — BL-10.) |
| `paid_at` | timestamptz | когда YooKassa подтвердила оплату (или сервер сам выставил при `amount_kop=0`) |
| `sent_at` | timestamptz | когда первый раз отправили PDF (на email или скачали) |
| `refunded_at` | timestamptz | если был возврат |

Индексы:
- `orders_token` (token) — поиск по URL
- `orders_status` (status) — воронка
- `orders_fit_status` (fit_status) — конверсия «дошли до результата»
- `orders_email` (email) — если юзер оставил почту, ищем его историю заказов
- `orders_session` (session_id) — «один человек, несколько попыток»
- `orders_created` (created_at DESC) — последние заказы

Лайфхак для воронки: вся аналитика делается по `orders` без JOIN'ов
(благодаря денормализованному `fit_status`).

**Модель ценообразования — сценарии:**

| Случай | `base_price_kop` | `discount_kop` | `amount_kop` | `status` | `promo_code_id` |
|---|---|---|---|---|---|
| dev (`PAYMENT_REQUIRED=false`), fit_all | 14900 | 14900 | 0 | `sent_free` | NULL |
| fit_all + оплачено без промо | 14900 | 0 | 14900 | `paid` | NULL |
| fit_all + промо -20% оплачено | 14900 | 2980 | 11920 | `paid` | uuid |
| fit_all + free-промо оплачено | 14900 | 14900 | 0 | `paid` | uuid |
| fit_all + юзер закрыл вкладку до оплаты | 14900 | 0 | 14900 | `created` навсегда | NULL |
| fit_partial / fit_none / no_scheme | 14900 | 0 | 14900 | `created` навсегда | NULL |

**Логика:**
- `base_price_kop` всегда фиксируется в момент создания заказа из `PRICE_KOP` в .env (соответствует оферте). **Записывается независимо от `fit_status`** — нужно для аналитики упущенного дохода.
- `discount_kop` — разница между «полной ценой» и «к оплате», независимо от причины. Промокод — одна из причин (`promo_code_id IS NOT NULL`), `sent_free` — другая (`promo_code_id IS NULL`, причина = dev-обход).
- `amount_kop = base_price_kop - discount_kop`. Сюда смотрит YooKassa.
- Для `fit_all`: сервер создаёт платёж в YooKassa **сразу при сабмите формы**, возвращает `payment_url` фронту. Висящие pending-платежи YooKassa чистит сама (24ч TTL).
- Для `fit_partial`/`fit_none`/`no_scheme`: сервер YooKassa **не дёргает**, `status='created'` остаётся навсегда. `amount_kop=14900` фиксируется чтобы вёрнуть аналитику «упущенный доход» (см. ниже).
- Если `amount_kop=0` (full discount via free-промо): YooKassa не дёргается, сразу `status='paid'`. Для `sent_free` тоже без YooKassa.

**Аналитика упущенного дохода (важно для бизнес-решений):**
```sql
-- Реальный доход за месяц
SELECT SUM(amount_kop)/100.0 AS revenue_rub FROM orders
WHERE status='paid' AND amount_kop > 0
  AND paid_at > now() - interval '30 days';

-- Потеряли из-за fit_partial (схема почти получилась — есть смысл докручивать движок)
SELECT SUM(amount_kop)/100.0 AS lost_partial FROM orders
WHERE status='created' AND fit_status='fit_partial';

-- Потеряли из-за fit_none/no_scheme (честно не смогли — нужен расширенный каталог)
SELECT SUM(amount_kop)/100.0 AS lost_no_fit FROM orders
WHERE status='created' AND fit_status IN ('fit_none','no_scheme');

-- Брошенные корзины (fit_all но юзер не заплатил — нужно UX/email-напоминалки)
SELECT SUM(amount_kop)/100.0 AS abandoned FROM orders
WHERE status='created' AND fit_status IN ('fit_all','fit_all_after_adjustment');
```

Бизнес-смысл разбивки:
- **Lost partial** → инвестиция в движок (улучшение алгоритма, частичные схемы по сниженной цене)
- **Lost no_fit** → инвестиция в каталог (партнёрства с маркетплейсами, расширение storage_unit_profile)
- **Abandoned** → UX-проблема (улучшать payment-flow, email-напоминалки)

**При retention-scrub через 3 года финансовые поля остаются** (`base_price_kop`, `discount_kop`, `amount_kop`, `status`, `paid_at`, `created_at`, `fit_status`). Историческая аналитика упущенного дохода доступна на любом горизонте.

**Аналитика разделяет «нулевые amount» по причине:**
```sql
-- Воспользовались free-промо (для своих)
WHERE status='paid' AND amount_kop=0 AND promo_code_id IS NOT NULL;

-- Pre-launch раздача (dev режим)
WHERE status='sent_free';

-- Реальные оплаты
WHERE status='paid' AND amount_kop > 0;
```

### `configurations` (технический след)

| колонка | тип | описание |
|---|---|---|
| `id` | uuid PK | внутренний |
| `created_at` | timestamptz NOT NULL DEFAULT now() | для сопоставления с orders.created_at |
| `input_payload` | jsonb NOT NULL | что юзер ввёл: drawer_*, items[], priority, consent_oferta |
| `engine_output` | jsonb NOT NULL | полный output движка (сырой). Внутренние поля типа `option_id`, `layout_plan` тут — на сервере, наружу не идут |
| `fit_status` | text NOT NULL CHECK (...) | дублируется в orders для быстрого фильтра |

Индексы:
- `configurations_fit` (fit_status) — аналитика «какие конфигурации чаще fit_none»
- `configurations_recent` (created_at DESC)

**Изменения от текущей схемы:**
- ❌ убираем `configurations.token` (переезжает в orders)
- ❌ убираем `configurations.session_id` (переезжает в orders)

### `consents` (журнал согласий, 152-ФЗ)

| колонка | тип | описание |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT | FK на заказ (раньше был на configuration). RESTRICT — заказ нельзя удалить пока есть его согласия. |
| `consent_type` | text NOT NULL CHECK (...) | `oferta` / `pd` / `marketing` |
| `consent_version` | text NOT NULL | `oferta_v1`, `privacy_v1`, … |
| `email` | text | snapshot email на момент согласия. Если юзер потом сменит email, это согласие остаётся за прежним. |
| `granted_at` | timestamptz NOT NULL DEFAULT now() | |
| `revoked_at` | timestamptz | NULL пока согласие активно. Заполняется когда юзер отзывает (по запросу). |
| `ip` | inet | snapshot |
| `user_agent` | text | snapshot |

Индексы:
- `consents_order` (order_id) — все согласия одного заказа
- `consents_type_email` (consent_type, email) — для аудита по email
- `consents_active` (consent_type) WHERE revoked_at IS NULL — активные согласия

**Изменения от текущей схемы:**
- `configuration_id` → `order_id` (переориентация на заказ).

### `configuration_skus` (что подобрал движок)

Без структурных изменений от текущей миграции. Связан с `configurations`,
не с `orders` — потому что это **результат движка**, не коммерческая
информация. Чтобы достать «какие SKU мы рекомендовали в этом заказе» —
JOIN: `orders → configurations → configuration_skus → sku`.

### `payments` (платежи через YooKassa)

Без изменений. Связан с `orders.id` (как и сейчас).

### `emails_outbox` (очередь писем)

Минимальная правка — добавить ссылку на заказ:

| колонка | тип | описание |
|---|---|---|
| `order_id` | uuid REFERENCES orders(id) | NULLABLE — могут быть письма не привязанные к заказу (рассылки маркетинга). NEW. |

Без этого поля сейчас нельзя ответить «какие письма мы отправили по этому
заказу» без парсинга `payload` jsonb.

### `subscribers` (маркетинг-лист)

**Изменение от текущей миграции:** **удаляем колонку `configuration_id`**
(в целевой модели мы её не используем). «Последний заказ подписчика» —
получаем подзапросом по индексу `orders_email` когда нужно, без
денормализации.

```sql
-- «дай последний заказ подписчика»
SELECT (SELECT id FROM orders WHERE email=s.email
        ORDER BY created_at DESC LIMIT 1) AS last_order_id
FROM subscribers s WHERE s.email = $1;
```

**ADR — Architecture Decision Record (subscribers.last_order_id):**

| | |
|---|---|
| Дата | 02.06.2026 |
| Решение | Не хранить денормализованное поле `last_order_id` в `subscribers`. Считать подзапросом из `orders` по индексу `email` когда нужно. |
| Альтернативы | (1) триггер в БД, (2) обновление в серверном коде на каждом `/api/order/email` |
| Контекст | Поле используется только в редких маркетинговых сценариях (рассылки, отписка, дашборд активных подписчиков). На текущих масштабах (десятки–сотни заказов в день, индексированный email) подзапрос ≪1 мс — практически бесплатно. |
| Аргументы за выбор | Простота: ноль кода и тригеров, ноль риска расхождения данных, ноль необходимости помнить «не забудь обновить subscribers если меняешь orders.email». Источник правды один — таблица `orders`. |
| **Триггер для пересмотра** | Когда (а) подписчиков > 100 000 И/ИЛИ (б) появится hot-path (страница админки, дашборд который обновляется в реальном времени), где этот подзапрос становится узким местом по latency. Тогда: вернуть колонку и выбрать (1) или (2) исходя из частоты обновления. |
| Метрика для отслеживания | `pg_stat_statements` по запросу `SELECT id FROM orders WHERE email=$1 ORDER BY...` — если суммарное время этого запроса превысит 1% от общей нагрузки БД, пересмотреть. |

### `affiliate_clicks` (клики по партнёркам)

Сейчас `configuration_id` (soft FK). **Изменение:** заменить на
`order_id` (soft FK). По заказу естественнее анализировать «во сколько
кликов конвертится заказ» и «сколько кликов оплаченных заказов».

### Прочие таблицы (без изменений)

`sku`, `sku_marketplace_links`, `sku_availability_log`, `sku_price_log`,
`sku_candidates`, `sku_no_match_log` — каталог и его обвес. Не трогаем.

`promo_codes`, `promo_code_usages` — будущее (BL-10), под Стадию 3.

---

## Что меняется от текущей схемы к целевой

Сводно, в порядке выполнения:

### Миграция `0003_orders_central.sql` (пишется после согласования)

1. **`orders`** дополняется новыми колонками:
   - `token text UNIQUE NOT NULL` — переезжает из `configurations`
   - `session_id text` — переезжает из `configurations`
   - `ip inet`, `user_agent text` — новые, для 152-ФЗ
   - `fit_status text CHECK (...)` — денормализация из `configurations`
   - `phone text` — задел на будущее
   - `promo_code_id uuid` — задел (FK добавится миграцией 0004 вместе с таблицей promo_codes)
   - `discount_kop int NOT NULL DEFAULT 0` — задел
   - `refunded_at timestamptz` — задел
   - `email` — `DROP NOT NULL` (теперь может быть NULL до email-сабмита)

2. **`configurations`** обедняется:
   - `DROP COLUMN token`
   - `DROP COLUMN session_id` (после копирования в orders)

3. **`consents`**:
   - `ADD COLUMN order_id uuid REFERENCES orders(id)`
   - бэкфилл: для каждой существующей `consents.configuration_id` найти соответствующий `orders.configuration_id` и заполнить `order_id`. После — `DROP COLUMN configuration_id`.

4. **`emails_outbox`**:
   - `ADD COLUMN order_id uuid REFERENCES orders(id)` (nullable, потому что маркетинговые письма могут не быть привязаны к заказу)

5. **`subscribers`**:
   - `DROP COLUMN configuration_id` — денормализация снимается, см. ADR в секции `subscribers` выше.

6. **`affiliate_clicks`**:
   - `RENAME COLUMN configuration_id TO order_id` + ребэкфилл (через JOIN на orders).

7. **Бэкфилл существующих данных:**
   - Сейчас в БД ~6 строк `configurations` (тестовые расчёты), 0 строк `orders`, 1+ строк `consents`.
   - Для каждой конфигурации создать соответствующий `orders` (status='created', email=NULL, token из configurations.token).
   - Для существующих `consents` подменить FK через lookup.

### Изменения серверного кода (`server/api/...`):

- **`calculate.ts`**: вместо `INSERT configurations + INSERT consents (configuration_id)` теперь:
  - `INSERT configurations RETURNING id`
  - `INSERT orders (configuration_id, token, fit_status, session_id, ip, user_agent, status, base_price_kop, discount_kop, amount_kop) RETURNING id`
    где `status` и `discount_kop` зависят от `fit_status × PAYMENT_REQUIRED` (см. лайфсайкл выше)
  - `INSERT consents (order_id, ...)`
  - `INSERT configuration_skus (configuration_id, ...)` — без изменений
  - Возвращать `{token, fit_status, can_pay, amount_kop}` (фронту нужно решать куда вести: result / pay / no-fit)

- **`result.ts`**: лукапить через `orders.token`, не `configurations.token`.
  **Новое — payment gate:** если `orders.status NOT IN ('paid','sent_free')` → 402 Payment Required
  с телом `{ok:false, error:'payment_required', payment_url:'/pay/?t=TOKEN', amount_kop:14900}`.
  Иначе — JOIN'ом получаем `engine_output`, `input_payload`, рендерим как сейчас.

- **новый `/api/order/pay`** (Стадия 3, paywall): создаёт платёж в YooKassa,
  UPDATE orders SET status='pending', возвращает `{payment_url}` для редиректа.

- **новый `/api/yookassa/webhook`** (Стадия 3): принимает webhook от YooKassa,
  INSERT payments, UPDATE orders SET status='paid', paid_at=now(),
  триггерит INSERT emails_outbox с PDF.

- **новый `/api/order/email`** (Стадия 2): UPDATE orders SET email=?,
  INSERT consents (consent_type='pd'), INSERT emails_outbox.

- **новый `/api/pdf/:token`** (Стадия 2): тот же payment gate что у /api/result/:token.
  Если прошёл — рендерит PDF через Puppeteer, UPDATE orders SET sent_at=now()
  (если первое скачивание).

### Изменения фронта:

- В принципе ничего: URL по-прежнему `/result/?t=TOKEN`, фронт продолжает дёргать `/api/result/:token`. Серверу всё равно где он хранит token — главное чтобы по token из URL находил данные.

---

## Retention и анонимизация (решено)

Через **3 года после `created_at`** ежемесячный cron анонимизирует
данные, **не удаляя строк**. Это сохраняет ссылочную целостность (FK не
ломаются), воронку и аналитику работают на любом горизонте, а PII
утекает из «холодных» данных.

**Что чистится в `configurations`** (через 3 года):
```sql
UPDATE configurations
SET input_payload = '{}'::jsonb,
    engine_output  = '{}'::jsonb
WHERE created_at < now() - interval '3 years'
  AND input_payload != '{}'::jsonb;  -- идемпотентность
```
Остаются: `id`, `created_at`, `fit_status` — для воронки и FK.

**Что чистится в `orders`** (через 3 года):
```sql
UPDATE orders
SET email = NULL,
    ip = NULL,
    user_agent = NULL,
    session_id = NULL,
    phone = NULL
WHERE created_at < now() - interval '3 years'
  AND email IS NOT NULL;
```
Остаются: `id`, `token`, `created_at`, `configuration_id`, `fit_status`,
`status`, `amount_kop`, `paid_at`, `sent_at`, `discount_kop`, `promo_code_id`
— для воронки, бухучёта (НК РФ 5 лет — мы перекрываем 3 годами PII +
структура остаётся ещё долго) и FK.

**Что чистится в `consents`** (через 3 года, симметрично с orders):
```sql
UPDATE consents
SET email = NULL,
    ip = NULL,
    user_agent = NULL
WHERE granted_at < now() - interval '3 years'
  AND email IS NOT NULL;
```
Остаются: `id`, `order_id`, `consent_type`, `consent_version`,
`granted_at`, `revoked_at` — аудит-цепочка «такой-то заказ имел такое-то
согласие версии v1 в такой-то момент» остаётся, но без личной привязки.
Можно отвечать на проверки 152-ФЗ, можно собирать статистику «сколько
народу подписало oferta_v1».

**Что делает `/api/result/:token` и `/api/pdf/:token` на скрабнутом
расчёте:**
```
HTTP 410 Gone
{
  "ok": false,
  "error": "expired",
  "message": "Извините, срок хранения расчёта составляет 3 года. Пожалуйста, сделайте новый."
}
```
Фронт показывает соответствующий текст + кнопку «Новый расчёт» на главную.
Это симметрично для прямого визита `/result/?t=OLD_TOKEN` и для попытки
скачать PDF по старому токену.

**`/result/` остаётся живой страницей** (не уходим на model «PDF only via
email»). UX-аргументы: моментальное подтверждение в браузере после оплаты,
backup-доступ если письмо ушло в спам, возможность поделиться URL.
Стоимость рендера копеечная (одна SQL-выборка на просмотр).

**Реализация:**
- cron-job: `db/jobs/anonymize_retired.sql` (TBD), вызывается раз в месяц
  через `pg_cron` или внешний планировщик
- на MVP не нужен (нет данных старше 3 лет). За 6 месяцев до момента
  когда первые записи достигнут 3 лет — настроить, см. напоминалку в
  `README.md` → «Через 2.5 года от первого реального юзера…»

---

## Закрытые вопросы (решения зафиксированы)

- **Q1. `orders.fit_status` enum** — пять значений: `'fit_all', 'fit_all_after_adjustment', 'fit_partial', 'fit_none', 'no_scheme'`. В воронке `fit_all` и `fit_all_after_adjustment` группируются как «успех» (юзеру предлагаем оплату), остальные — на /no-fit/.
- **Q2. Ценообразование** — три поля: `base_price_kop` (snapshot из оферты на момент заказа, **всегда фиксируется независимо от fit_status** для аналитики упущенного дохода), `discount_kop`, `amount_kop = base - discount`. См. таблицу сценариев в секции `orders` выше.
- **Q3. Источник прайса** — на MVP `PRICE_KOP` в `.env` синхронно с текстом оферты. При изменении цены — правится оба места + перезапуск Node. Будущая таблица `pricing` с эффективными датами — Стадия 4+.
- **Q4. Гонка между browser-redirect и webhook от YooKassa** — фронт `/result/` поллит `/api/result/:token` после возврата с YooKassa (раз в 2 сек, до 10 попыток), сервер на 3-й попытке активно ходит в YooKassa API проверить статус (подстраховка от медленного webhook'а). При `status='pending'` — лоадер «подтверждаем оплату»; при `status='paid'` — рендер.
- **Q5. UX `/result/` без оплаты** — единая страница `/result/?t=TOKEN`. Лоадер «подтверждаем оплату» в первые 5-20 сек после возврата с YooKassa; «оплата не дошла, повторите» если поллинг исчерпался. Отдельной страницы `/pay/` нет — после `POST /api/calculate` фронт редиректит сразу на YooKassa.
- **Q6 (retention)** — см. секцию «Retention и анонимизация» выше (3 года, monthly cron, scrub без DELETE).
- **Q7. `subscribers.last_order_id` денормализация** — поле удаляем из схемы (`DROP COLUMN`), вычисляем подзапросом по индексу `email` когда нужно. ADR в секции `subscribers` выше — там же триггер для пересмотра.

## Открытые вопросы перед миграцией

Все архитектурные вопросы закрыты. Осталась одна UX-деталь для фронта `/result/`:

1. **Лоадер «подтверждаем оплату» — какой текст и анимация?**
   - Чистый спиннер + «Подтверждаем оплату…»
   - Прогресс-бар «Шаг 2 из 2»
   - Что-то «успокаивающее» в духе «Ваши деньги в безопасности, схема готова»
   
   UX-копирайтное решение, откладывается до написания фронта.

---

## Сценарии аналитики, которые должен покрывать этот дизайн

Эти запросы должны работать «из коробки» по новой модели:

```sql
-- Полная воронка за неделю
SELECT
  COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') AS total_orders,
  COUNT(*) FILTER (WHERE fit_status IN ('fit_all','fit_all_after_adjustment')) AS got_full_result,
  COUNT(*) FILTER (WHERE fit_status = 'fit_partial') AS partial_fit,
  COUNT(*) FILTER (WHERE fit_status IN ('fit_none','no_scheme')) AS no_result,
  COUNT(*) FILTER (WHERE email IS NOT NULL) AS gave_email,
  COUNT(*) FILTER (WHERE status = 'pending') AS started_payment,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid,
  COUNT(*) FILTER (WHERE status = 'sent_free') AS sent_free
FROM orders
WHERE created_at > now() - interval '7 days';

-- Конверсия по этапам воронки (для дашборда)
WITH funnel AS (
  SELECT
    COUNT(*) AS submitted,
    COUNT(*) FILTER (WHERE fit_status IN ('fit_all','fit_all_after_adjustment')) AS got_result,
    COUNT(*) FILTER (WHERE status IN ('pending','paid')) AS started_pay,
    COUNT(*) FILTER (WHERE status = 'paid') AS paid
  FROM orders
  WHERE created_at > now() - interval '30 days'
)
SELECT
  submitted,
  ROUND(got_result::numeric / submitted * 100, 1) AS pct_got_result,
  ROUND(started_pay::numeric / NULLIF(got_result, 0) * 100, 1) AS pct_started_payment,
  ROUND(paid::numeric / NULLIF(started_pay, 0) * 100, 1) AS pct_paid_of_started
FROM funnel;

-- Какие конфигурации чаще всего дают fit_none (для расширения каталога)
SELECT input_payload->>'storage_category', COUNT(*)
FROM orders o
JOIN configurations c ON c.id = o.configuration_id
WHERE o.fit_status = 'fit_none'
GROUP BY 1 ORDER BY 2 DESC;

-- По SKU: сколько раз рекомендовали и сколько раз кликнули
SELECT cs.sku_id, COUNT(DISTINCT o.id) AS orders_recommended, COUNT(ac.id) AS clicks
FROM orders o
JOIN configuration_skus cs ON cs.configuration_id = o.configuration_id
LEFT JOIN affiliate_clicks ac ON ac.order_id = o.id AND ac.sku_id = cs.sku_id
GROUP BY 1 ORDER BY orders_recommended DESC;

-- Найти заказ по email или по последним 8 символам токена (для поддержки)
SELECT * FROM orders WHERE email = 'kli@example.com'
   OR token LIKE 'abc12345%';

-- Журнал согласий конкретного клиента (по email) для 152-ФЗ
SELECT c.* FROM consents c
JOIN orders o ON o.id = c.order_id
WHERE c.email = 'kli@example.com' OR o.email = 'kli@example.com'
ORDER BY c.granted_at;
```

Если какой-то реалистичный запрос не выполняется из текущей структуры —
значит модель плохая, давай дорабатывать.
