# Operations / Customer Support

Заметки для работы с заказами, клиентами и саппортом. Запросы к проду — через `sudo -u postgres psql umestno`.

---

## Найти заказ по короткому коду из PDF (`№ XXXXXXXX`)

Юзер в PDF и в письме видит **«Номер заказа: № 379B3757»** — это первые 8 hex-знаков UUID заказа (`orders.id`), в верхнем регистре. Полный UUID в письме не показываем (визуально шумит), поэтому юзер цитирует короткий код.

**Поиск:**

```sql
SELECT id, email, status, fit_status, amount_kop, created_at, paid_at
  FROM orders
 WHERE id::text LIKE '379b3757-%'
 ORDER BY created_at DESC;
```

Лимит `LIKE '...-%'` сужает до одного-двух заказов (теоретическая коллизия первых 8 hex-знаков на текущем объёме практически нулевая). Если их несколько — уточняем у клиента email или дату.

## Найти заказ по email

```sql
SELECT id, status, fit_status, amount_kop, created_at, paid_at
  FROM orders
 WHERE email = 'client@example.com'
 ORDER BY created_at DESC;
```

## Найти заказ по токену из URL (`/result/?t=TOKEN`)

```sql
SELECT id, email, status, fit_status, amount_kop, created_at
  FROM orders
 WHERE token = 'vV3DQYpGrq5Fzc7ZG4ieUQ';
```

## Найти заказ по коду платежа ЮКассы (с фискального чека)

На чеке у клиента есть «Код платежа» вида `31b2391b-000f-5001-...` — это `payments.yookassa_id`.

```sql
SELECT o.id AS order_id, o.email, o.status, o.amount_kop, o.created_at
  FROM payments p
  JOIN orders   o ON o.id = p.order_id
 WHERE p.yookassa_id = '31b2391b-000f-5001-8000-195c44651d2c';
```

---

## Статусы заказа

| Статус | Что значит |
|---|---|
| `created` | Заказ оформлен, оплаты ждём. Не показываем результат. |
| `pending` | Создан платёж ЮКассы, юзер в процессе оплаты. |
| `paid` | Оплата прошла (или была применена 100% промо-скидка). Результат доступен. |
| `sent_free` | Dev-режим обхода оплаты (только при `PAYMENT_REQUIRED=false`). На проде в норме не появляется. |
| `failed` | Платёж не прошёл (отказ банка, expired и т.п.) |
| `refunded` | Был возврат, доступ к результату закрыт. |

## Активные заказы за последний час (мониторинг)

```sql
SELECT id, email, status, fit_status, amount_kop, created_at
  FROM orders
 WHERE created_at > now() - interval '1 hour'
 ORDER BY created_at DESC;
```

## Воронка: сколько заказов на каком этапе сегодня

```sql
SELECT status, COUNT(*) AS n, SUM(amount_kop) / 100.0 AS sum_rub
  FROM orders
 WHERE created_at >= current_date
 GROUP BY status
 ORDER BY n DESC;
```

---

## Админки внешних сервисов

Где залогиниться, чтобы попасть в админ-панели внешних сервисов. Сами пароли — не здесь (в Bitwarden / диспетчере паролей).

| Сервис | URL админки | Под какой учёткой | Что там делать |
|---|---|---|---|
| **VK Workspace / Mail.ru для бизнеса** (домен umestno-home.ru) | https://biz.mail.ru/ | `dzerissimo@gmail.com` | Управление ящиками домена (info@, help@), редирект, DNS-подсказки |
| Mail.ru почта info@ (сам ящик) | https://e.mail.ru/ | `info@umestno-home.ru` | Чтение/отправка писем, SMTP-пароли приложений |
| YooKassa | https://yookassa.ru/my/ | ? | Платежи, чеки 54-ФЗ, профиль ИП |
| Unisender (legacy, выпиливаем) | https://cp.unisender.com/ | ? | На этапе миграции на SMTP mail.ru |
| Yandex Metrika | https://metrika.yandex.ru/ | ? | Счётчик 105180427, цели, воронки |
| Pinterest Business | https://business.pinterest.com/ | ? | Домен верифицирован, пины |
| Регистратор домена umestno-home.ru | (уточнить) | ? | NS, MX, TXT-записи (SPF/DKIM/DMARC) |
