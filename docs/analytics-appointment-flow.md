# Аналитика и создание appointment: код, схемы, запросы

## 1. Где создаётся appointment при переходе в финальный state

**Файл:** `packages/router/src/db/owner-ingest.ts`

**Функция:** `ingestOwnerEvent`. Appointment создаётся не «при переходе в state» отдельно, а при **любом** ingest-событии (message или callback), когда по тексту сообщения/кнопки выводится тип `appointment`. Переход в финальный state при нажатии кнопки приходит как `callback_query`, Router вызывает `ingestOwnerEvent` с `messageText = update.callback_query?.data` — это **ключ следующего state** (например `thanks`, `booking_confirm`). По этому ключу срабатывает `inferOperationalType` и при совпадении с «финальными» словами возвращается `'appointment'`, после чего в той же функции создаётся запись в `appointments`.

**Фрагмент кода создания appointment:**

```ts
// packages/router/src/db/owner-ingest.ts

export async function ingestOwnerEvent(params: IngestParams): Promise<void> {
  const isFresh = await ensureDedup(params.botId, params.sourceId);
  if (!isFresh) return;
  // ...
  const inferred = inferOperationalType(params.messageText);
  // ...
  } else if (inferred === 'appointment') {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const appointment = await client.query<{ id: string }>(
      `INSERT INTO appointments (bot_id, customer_id, status, starts_at, ends_at, payload_json)
       VALUES ($1, $2::uuid, 'new', $3::timestamptz, $4::timestamptz, $5)
       RETURNING id::text as id`,
      [params.botId, customerId, startsAt, endsAt, params.payload ?? null]
    );
    entityType = 'appointment';
    entityId = appointment.rows[0]?.id ?? null;
    eventType = 'appointment_created';
  }
```

**Функция определения типа (финальные ключи state):**

```ts
// packages/router/src/db/owner-ingest.ts

function inferOperationalType(messageText?: string | null): 'lead' | 'order' | 'appointment' | null {
  const value = (messageText || '').toLowerCase();
  if (!value) return null;
  if (value.includes('заказ') || value.includes('доставка') || value.includes('оплат')) return 'order';
  if (
    value.includes('запис') ||
    value.includes('время') ||
    value.includes('мастер') ||
    value.includes('thanks') ||
    value.includes('thank') ||
    value.includes('spasibo') ||
    value.includes('confirm') ||
    value.includes('podtverd') ||
    value.includes('blagodar') ||
    value.includes('record') ||
    value.includes('booking')
  )
    return 'appointment';
  if (value.includes('заявк') || value.includes('хочу') || value.includes('интерес')) return 'lead';
  return null;
}
```

**Diff (добавление финальных ключей для appointment):**

```diff
 function inferOperationalType(messageText?: string | null): 'lead' | 'order' | 'appointment' | null {
   const value = (messageText || '').toLowerCase();
   if (!value) return null;
   if (value.includes('заказ') || value.includes('доставка') || value.includes('оплат')) return 'order';
-  if (value.includes('запис') || value.includes('время') || value.includes('мастер')) return 'appointment';
+  if (
+    value.includes('запис') ||
+    value.includes('время') ||
+    value.includes('мастер') ||
+    value.includes('thanks') ||
+    value.includes('thank') ||
+    value.includes('spasibo') ||
+    value.includes('confirm') ||
+    value.includes('podtverd') ||
+    value.includes('blagodar') ||
+    value.includes('record') ||
+    value.includes('booking')
+  )
+    return 'appointment';
   if (value.includes('заявк') || value.includes('хочу') || value.includes('интерес')) return 'lead';
   return null;
 }
```

**Как предотвращаются дубли:**  
Дубликаты **на уровне одного Telegram-апдейта** предотвращаются таблицей **event_dedup**: перед обработкой вызывается `ensureDedup(botId, sourceId)`. `sourceId` в Router задаётся как `tg:${update.update_id}:${updateType}` (один раз на один входящий update). Если для этой пары `(bot_id, source_id)` запись уже есть, `INSERT ... ON CONFLICT DO NOTHING` не вставит новую строку, `ensureDedup` вернёт `false`, и `ingestOwnerEvent` сразу выходит — ни lead, ни appointment для этого апдейта не создаются.  
**На уровне «один пользователь — одна запись» дубли не предотвращаются:** каждое новое нажатие кнопки (новый `update_id`) даёт новый вызов ingest и при подходящем `messageText` — новую строку в `appointments`. В таблицах `appointments` и `leads` нет уникального ограничения по (bot_id, customer_id, время/тип).

---

## 2. Схема таблиц `appointments` и `leads`

**Источник:** `packages/core/src/db/bots.ts`

```sql
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'new',
    assignee BIGINT,
    title TEXT,
    message TEXT,
    source TEXT,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_bot_status_created_at
  ON leads(bot_id, status, created_at DESC);
```

```sql
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'new',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_bot_starts_at
  ON appointments(bot_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_bot_status_starts_at
  ON appointments(bot_id, status, starts_at);
```

**Уникальность:**  
В обеих таблицах единственная уникальность — первичный ключ `id`. Отдельных UNIQUE по (bot_id, customer_id, …) или по слоту времени нет. Один и тот же пользователь может породить несколько записей в `leads` и `appointments` за счёт разных апдейтов (разные `sourceId` в event_dedup).

---

## 3. Как Router сопоставляет событие с пользователем

**Откуда берётся `telegram_user_id`:**  
В webhook-обработчике (`packages/router/src/index.ts`) один раз из апдейта:

```ts
const userId = update.message?.from?.id ?? update.callback_query?.from?.id ?? null;
```

Для обычного сообщения — `update.message.from.id`, для нажатия inline-кнопки — `update.callback_query.from.id`. Этот `userId` передаётся в `ingestOwnerEvent` как `telegramUserId`, используется при upsert в `customers` и при вставке в `bot_events.payload_json`.

**Вызов ingest в Router:**

```ts
await ingestOwnerEvent({
  botId,
  sourceId: `tg:${update.update_id}:${updateType}`,
  type: 'message_received',
  telegramUserId: userId ?? null,
  customerName: [ profileFromUpdate?.first_name, profileFromUpdate?.last_name ].filter(Boolean).join(' ') || null,
  messageText: update.message?.text || update.callback_query?.data || null,
  payload: { updateType, updateId: update.update_id },
  profile: profileFromUpdate,
});
```

При callback `messageText` = `update.callback_query.data` — это значение `callback_data` в Telegram, в нашем коде оно совпадает с `nextState` кнопки (см. `packages/router/src/services/telegram.ts`: `callback_data: btn.nextState ?? ''`).

**Что попадает в `bot_events.payload_json` (пример одной записи):**

После вставки в `ingestOwnerEvent` в payload пишется:

```ts
{
  text: params.messageText ?? null,
  telegram_user_id: params.telegramUserId ?? null,
  ...params.payload,
}
```

Типичный пример одной записи в `bot_events` для созданного appointment (после перехода в финальный state):

```json
{
  "text": "booking_confirm",
  "telegram_user_id": 123456789,
  "updateType": "callback_query",
  "updateId": 987654321
}
```

`telegram_user_id` — число (Telegram user id); в JSONБД оно хранится как число. Для метрики «пользователей написало» Core считает уникальные `payload_json->>'telegram_user_id'`.

---

## 4. SQL-запросы Core для новых метрик

**Файл:** `packages/core/src/db/owner.ts`, функция `getBotAnalyticsDashboard`.

**usersWroteCount (за сегодня):**

```sql
SELECT COUNT(DISTINCT (payload_json->>'telegram_user_id'))::text as count
FROM bot_events
WHERE bot_id = $1
  AND created_at >= date_trunc('day', now())
  AND created_at < date_trunc('day', now()) + interval '1 day'
  AND (payload_json->>'telegram_user_id') IS NOT NULL
  AND (payload_json->>'telegram_user_id') != '';
```

**usersWroteCount (за 7 дней):**

```sql
SELECT COUNT(DISTINCT (payload_json->>'telegram_user_id'))::text as count
FROM bot_events
WHERE bot_id = $1
  AND created_at >= now() - interval '7 days'
  AND (payload_json->>'telegram_user_id') IS NOT NULL
  AND (payload_json->>'telegram_user_id') != '';
```

**newUsersCount (за сегодня):**

```sql
SELECT COUNT(*)::text as count
FROM customers
WHERE bot_id = $1
  AND created_at >= date_trunc('day', now())
  AND created_at < date_trunc('day', now()) + interval '1 day';
```

**newUsersCount (за 7 дней):**

```sql
SELECT COUNT(*)::text as count
FROM customers
WHERE bot_id = $1
  AND created_at >= now() - interval '7 days';
```

**appointmentsCount (за сегодня):**

```sql
SELECT COUNT(*)::text as count
FROM appointments
WHERE bot_id = $1
  AND created_at >= date_trunc('day', now())
  AND created_at < date_trunc('day', now()) + interval '1 day';
```

**appointmentsCount (за 7 дней):**

```sql
SELECT COUNT(*)::text as count
FROM appointments
WHERE bot_id = $1
  AND created_at >= now() - interval '7 days';
```

---

## 5. Пример реального bot schema с финальным state (thanks/confirm)

**Шаблон:** `packages/mini-app/src/templates/booking.json` (фрагмент).

Два состояния: ввод контакта и финальный экран «Спасибо».

**State 1 — ввод контакта (ключ `booking_contact`):**

```json
"booking_contact": {
  "message": "Нажмите кнопку ниже, чтобы поделиться номером телефона.",
  "buttons": [
    { "type": "request_contact", "text": "Поделиться номером", "nextState": "booking_confirm" }
  ]
}
```

**State 2 — финальный (ключ `booking_confirm`):**

```json
"booking_confirm": {
  "message": "Спасибо! Заявка принята. Ожидайте подтверждение от менеджера.",
  "buttons": [
    { "text": "Вернуться в меню", "nextState": "start" },
    { "text": "Посмотреть акции", "nextState": "promotions" }
  ]
}
```

**Ключи состояний:** `booking_contact`, `booking_confirm`, `start`, `promotions`, …

**Что уходит в Telegram как `callback_data`:**  
В роутере в Inline-кнопки подставляется `callback_data: btn.nextState` (см. `telegram.ts`). То есть при нажатии:

- «Поделиться номером» → `callback_data` = `"booking_confirm"` (nextState).
- «Вернуться в меню» → `callback_data` = `"start"`.
- «Посмотреть акции» → `callback_data` = `"promotions"`.

При переходе в `booking_confirm` в webhook приходит `callback_query.data === "booking_confirm"`. В ingest передаётся `messageText: "booking_confirm"`. В `inferOperationalType` строка `"booking_confirm"` содержит `"confirm"` → возвращается `'appointment'` → создаётся запись в `appointments` и событие в `bot_events`.

**Итого по ключам и callback_data:**

| Кнопка                 | nextState         | callback_data в Telegram |
|------------------------|-------------------|---------------------------|
| Поделиться номером     | booking_confirm   | booking_confirm          |
| Вернуться в меню       | start             | start                    |
| Посмотреть акции       | promotions        | promotions               |

Финальный state для создания appointment здесь — `booking_confirm` (ключ содержит `confirm`).
