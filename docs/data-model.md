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

## Жизненный цикл заказа

```
1. Юзер заполняет /configure/, жмёт «Получить расчёт»
   → POST /api/calculate
   → Сервер:
     a) выполняет движок → результат
     b) INSERT configurations (input_payload, engine_output, fit_status)
     c) INSERT orders с FK на configuration:
        status='created', email=NULL, amount_kop=0
        token (URL-friendly), fit_status (копия из движка для аналитики)
     d) INSERT consents (consent_type='oferta', order_id=новый)
     e) INSERT configuration_skus по каждой подобранной SKU
   → Возвращает {token, fit_status}
   → Фронт редиректит на /result/?t=TOKEN (если fit_all) или /no-fit/?t=TOKEN

2. Юзер на /result/:
   ── а) ничего не делает / закрывает вкладку
     → orders.status='created' навсегда. Висит в воронке как «дошёл до результата».
   ── б) скачивает PDF (бесплатно)
     → GET /api/pdf/:token
     → Сервер UPDATE orders SET status='sent_free', sent_at=now()
        (если уже sent_free — оставляем, повторное скачивание норма)
   ── в) вводит email и жмёт «Отправить»
     → POST /api/order/email
     → INSERT consents (consent_type='pd', order_id=...)
     → UPDATE orders SET email=?, status='sent_free' (на free-MVP)
     → INSERT emails_outbox (template='result', payload содержит token)
     → Воркер раз в минуту берёт emails_outbox, шлёт через Unisender
   ── г) (Стадия 3) жмёт «Оплатить»
     → POST /api/order/pay
     → UPDATE orders SET status='pending', amount_kop=149_00
     → Создаём платёж в YooKassa
     → По вебхуку YooKassa: INSERT payments, UPDATE orders SET status='paid', paid_at=now()
     → Триггер: INSERT emails_outbox с PDF

3. Юзер на /no-fit/ (fit_partial/fit_none/no_scheme):
   → orders.status='created', orders.fit_status показывает что именно случилось
   → если оставил email — UPDATE orders SET email=?, INSERT consents (pd)
     INSERT emails_outbox (template='no-fit-followup')
```

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
| `status` | text NOT NULL DEFAULT 'created' CHECK (...) | `created` / `sent_free` / `pending` / `paid` / `failed` / `refunded` |
| `amount_kop` | int NOT NULL DEFAULT 0 | цена для этого конкретного заказа в копейках (после применения промокода) |
| `promo_code_id` | uuid REFERENCES promo_codes(id) | NULL если без промокода. (Таблица появится в Стадии 3 — BL-10.) |
| `discount_kop` | int NOT NULL DEFAULT 0 | сколько скостили промокодом (для исторической точности) |
| `paid_at` | timestamptz | когда YooKassa подтвердила оплату |
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

Минимальная правка:

| колонка | тип | описание |
|---|---|---|
| `last_order_id` | uuid REFERENCES orders(id) | переименовать из `configuration_id`. Семантически правильнее. |

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
   - `RENAME COLUMN configuration_id TO last_order_id`
   - бэкфилл: переписать значения через `orders.configuration_id` (если строки есть; сейчас пусто).

6. **`affiliate_clicks`**:
   - `RENAME COLUMN configuration_id TO order_id` + ребэкфилл (через JOIN на orders).

7. **Бэкфилл существующих данных:**
   - Сейчас в БД ~6 строк `configurations` (тестовые расчёты), 0 строк `orders`, 1+ строк `consents`.
   - Для каждой конфигурации создать соответствующий `orders` (status='created', email=NULL, token из configurations.token).
   - Для существующих `consents` подменить FK через lookup.

### Изменения серверного кода (`server/api/...`):

- **`calculate.ts`**: вместо `INSERT configurations + INSERT consents (configuration_id)` теперь:
  - `INSERT configurations RETURNING id`
  - `INSERT orders (configuration_id, token, fit_status, session_id, ip, user_agent) RETURNING id`
  - `INSERT consents (order_id, ...)`
  - `INSERT configuration_skus (configuration_id, ...)` — без изменений
  - Возвращать `{token, fit_status, order_id}` (новое поле order_id опционально, но возможно понадобится фронту)

- **`result.ts`**: лукапить через `orders.token`, не `configurations.token`. JOIN'ом получать `engine_output`, `input_payload`, `assigned_zones`, итд.

- **новый `/api/order/email`** (Стадия 2): UPDATE orders SET email=?, INSERT consents (consent_type='pd'), INSERT emails_outbox.

- **новый `/api/pdf/:token`** (Стадия 2): UPDATE orders SET status='sent_free', sent_at=now() при первом скачивании.

### Изменения фронта:

- В принципе ничего: URL по-прежнему `/result/?t=TOKEN`, фронт продолжает дёргать `/api/result/:token`. Серверу всё равно где он хранит token — главное чтобы по token из URL находил данные.

---

## Открытые вопросы перед миграцией

1. **`orders.fit_status` — что писать при `no_scheme`?** В текущей CHECK
   стоит `'fit_all','fit_partial','fit_none','no_scheme'`. Добавим
   `'fit_all_after_adjustment'` (engine может это вернуть)?

2. **`orders.amount_kop` — какая стоимость на free MVP?** Сейчас 0.
   Когда включаем оплату (Стадия 3) — куда писать прайс? В новую таблицу
   `pricing` или хардкодить в коде?

3. **Можно ли удалять старые `orders`?** Через год после `created_at`,
   например, без оплаты. Скорее всего да, но это политика хранения PII —
   нужно подумать вместе с юридическим (152-ФЗ).

4. **`subscribers.last_order_id` — обновлять при каждом новом заказе?**
   Если юзер делает 5 заказов с одним email, `last_order_id` должен
   указывать на последний. Триггер на orders.email или ручное UPDATE в
   код /api/order/email?

---

## Сценарии аналитики, которые должен покрывать этот дизайн

Эти запросы должны работать «из коробки» по новой модели:

```sql
-- Воронка за неделю
SELECT
  COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') AS total_orders,
  COUNT(*) FILTER (WHERE fit_status = 'fit_all') AS got_result,
  COUNT(*) FILTER (WHERE fit_status IN ('fit_none','no_scheme','fit_partial')) AS no_result,
  COUNT(*) FILTER (WHERE email IS NOT NULL) AS gave_email,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid
FROM orders;

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
