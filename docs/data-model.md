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
размеров, фолдинг, подбор SKU — отдаются только после `orders.status='paid'`
(или эквивалентного `'sent_free'` на free-MVP, см. ниже).

**Переключатель `PAYMENT_REQUIRED` в .env:**
- `PAYMENT_REQUIRED=true` (Стадия 3 и далее) — настоящий гейт через YooKassa.
  После `/api/calculate` юзер с `fit_all` отправляется на оплату. До оплаты
  `/api/result/:token` возвращает 402 Payment Required.
- `PAYMENT_REQUIRED=false` (free-MVP, текущий режим) — сервер при создании
  заказа с `fit_all` сразу выставляет `status='sent_free'`. Юзер попадает
  прямо на `/result/`, проходит гейт «бесплатно». Архитектура та же, разница —
  одна ветвь в коде «выставляем paid или sent_free».

```
1. Юзер заполняет /configure/, жмёт «Получить расчёт»
   → POST /api/calculate
   → Сервер:
     a) выполняет движок → scheme_payload, fit_status
     b) INSERT configurations
     c) INSERT orders с FK на configuration:
        - token (URL-friendly), session_id, ip, user_agent
        - fit_status (копия из движка)
        - amount_kop = прайс при fit_all, 0 иначе
        - status:
          • fit_all + PAYMENT_REQUIRED=false → 'sent_free' (free MVP)
          • fit_all + PAYMENT_REQUIRED=true  → 'created' (ждём оплату)
          • не fit_all                       → 'created' (платить нечего)
     d) INSERT consents (consent_type='oferta', order_id=новый)
     e) INSERT configuration_skus (по каждой подобранной SKU)
   → Возвращает {token, fit_status, can_pay}
     - can_pay = (fit_status in ('fit_all','fit_all_after_adjustment') AND PAYMENT_REQUIRED)
     - на free MVP can_pay=false всегда (оплачивать нечего, уже sent_free)

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

2c. fit_all + PAYMENT_REQUIRED=false (free MVP, текущий режим):
    → can_pay=false, status='sent_free' уже выставлен в шаге 1
    → юзер сразу редиректится на /result/?t=TOKEN
    → GET /api/result/:token: status='sent_free' → ОК → отдаёт полный payload
    → юзер видит результат без всякой оплаты

3. fit_partial / fit_none / no_scheme:
   → can_pay=false (платить за неполный результат нельзя)
   → фронт редиректит на /no-fit/?t=TOKEN
   → orders.status остаётся 'created' навсегда, amount_kop=0
   → /no-fit/ показывает «не подобрали» + опц. форма email для follow-up
   → денег не берём ни в каком режиме

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
- На free-MVP гейт всегда пропускает (потому что `status='sent_free'`), но
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
  - `INSERT orders (configuration_id, token, fit_status, session_id, ip, user_agent, status, amount_kop) RETURNING id`
    где `status` зависит от `fit_status × PAYMENT_REQUIRED` (см. лайфсайкл выше)
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

## Открытые вопросы перед миграцией

1. **`orders.fit_status` enum:** в текущей CHECK стоит
   `'fit_all','fit_partial','fit_none','no_scheme'`. Добавляем
   `'fit_all_after_adjustment'` (движок такое тоже возвращает)?

2. **`orders.amount_kop` на free MVP:** ноль или прайс «как будто оплачено»?
   Логичнее ноль (юзер ничего не платил), но тогда метрика «средний чек»
   на ранних юзерах будет 0. Может писать прайс и помечать через `status='sent_free'`,
   чтобы из аналитики легко отделить?

3. **Источник прайса:**
   - (a) Хардкод в `.env` (`PRICE_KOP=14900`)
   - (b) Отдельная таблица `pricing` (более гибко, AB-тесты, скидки по регионам)
   - (c) В `pricing_rules` с условиями (промокоды, региональные)
   
   На MVP проще (a). Стадия 3 — (b). Когда подключаем промокоды (BL-10) — (c).

4. **Что возвращает `/api/result/:token` при `status='created'`** (paywall не пройден)?
   - 402 + `{error:'payment_required', payment_url:'...'}` — фронт сам решает что показать
   - Минимальные данные: только `fit_status`, размеры ящика, без схемы и SKU
   - Полный 403/404 «ничего нет» — жёстко, может быть запутывающе
   
   Моё мнение — (a) с `payment_url` который фронт открывает.

5. **Что показывает `/result/?t=TOKEN` если ещё не оплачено?**
   - Тизер схемы (размытая картинка, чтобы было понятно «там есть результат») + кнопка оплаты
   - Просто кнопка оплаты с текстом
   - Редирект на отдельную страницу `/pay/?t=TOKEN`
   
   Это UX-вопрос продакта.

6. **`subscribers.last_order_id` — обновлять при каждом новом заказе?**
   Если юзер делает 5 заказов с одним email, поле должно указывать
   на последний. Триггер на UPDATE orders.email или ручное в коде?

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
