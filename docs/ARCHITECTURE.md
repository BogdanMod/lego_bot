# ZerCon / Zero Context System — архитектура и контекст

## A) Карта архитектуры

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Монорепа (pnpm workspaces)                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  packages/core        — Node/TS API (Express). Бизнес-логика, Postgres,     │
│                         Redis, Telegram auth, owner/bot/mini-app API         │
│  packages/owner-web   — Next.js App Router. Кабинет владельца. Прокси        │
│                         /api/core/* → CORE_API_ORIGIN                        │
│  packages/mini-app    — Telegram WebApp (Vite + Express). Упрощённый         │
│                         биллинг/статус, переход в Owner Web через botlink    │
│  packages/router      — Обработка входящих событий, ingest (leads/orders/     │
│                         bot_events), Redis Stream                            │
│  packages/worker       — (если есть) обработка очереди                       │
│  packages/shared       — Общие типы/утилиты                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Деплой (Railway):
  Core:     https://core-production-72de.up.railway.app   (PORT из env)
  Owner Web: https://owner-web-production-70f8.up.railway.app
  Mini App: https://miniapp-production-325b.up.railway.app
```

### Ключевые env переменные

| Сервис     | Переменная              | Назначение |
|-----------|-------------------------|------------|
| Core      | `PORT`                  | Порт (Railway задаёт; слушать 0.0.0.0) |
| Core      | `DATABASE_URL`          | Neon Postgres |
| Core      | `REDIS_URL`             | Redis (dedupe botlink, streams) |
| Core      | `JWT_SECRET`            | Owner JWT |
| Core      | `OWNER_BOTLINK_SECRET`  | Botlink токены |
| Core      | `OWNER_WEB_BASE_URL`    | Базовый URL Owner Web для botlink |
| Core      | `TELEGRAM_BOT_TOKEN`    | Telegram bot |
| Core      | `RAILWAY_GIT_COMMIT_SHA`| В /health (gitSha) |
| Owner Web | `PORT`                  | Порт (не фиксировать 3000 в проде) |
| Owner Web | `CORE_API_ORIGIN`       | URL Core для прокси /api/core/* |
| Owner Web | `RAILWAY_GIT_COMMIT_SHA`| В /api/health (gitSha) |
| Mini App  | `PORT`                  | Порт; слушать 0.0.0.0 |
| Mini App  | `OWNER_WEB_BASE_URL`    | Для кнопки «Открыть Owner Web» через botlink |
| Mini App  | `CORE_API_ORIGIN`       | Запросы к Core (botlink generate и др.) |

---

## B) Где считаются leads/orders, где пишутся события, toggle is_active

### Подсчёт leads/orders

- **Core `packages/core/src/db/owner.ts`**
  - `getBotTodayMetrics()` — COUNT(leads), COUNT(orders) за сегодня, revenue (orders), conversion.
  - `getBotAnalyticsDashboard(botId, range)` — summaryToday / summary7d: leadsCount, ordersCount, revenuePotentialRub (SUM(amount) RUB), conversionPct; latestOrders, latestLeads.
- **Core `packages/core/src/index.ts`**
  - `GET /api/owner/bots/:botId/summary` — метрики за сегодня.
  - `GET /api/owner/bots/:botId/analytics?range=today|7d` — вызывает `getBotAnalyticsDashboard`.

### Запись событий (leads, orders, bot_events)

- **Router `packages/router/src/db/owner-ingest.ts`**
  - `ingestOwnerEvent()`:
    - Dedupe: `event_dedup` (bot_id, source_id).
    - При инференсе типа: INSERT в `leads` или `orders` или `appointments`.
    - Всегда INSERT в `bot_events` (type: lead_created / order_created / …).
    - Публикация в Redis Stream `events` для воркера.

### Toggle is_active

- **Core `packages/core/src/index.ts`**
  - `PATCH /api/owner/bots/:botId` — body `isActive: true|false` → `UPDATE bots SET is_active = $1 WHERE id = $2`.
  - `DELETE /api/owner/bots/:botId` — soft delete через `deleteBot()` (is_active = false, deleted_at = NOW(), webhook_set = false).

---

## C) Схемы таблиц Neon (из миграций core)

### bots

- `id`, `user_id`, `token`, `name`, `webhook_set`, `schema`, `schema_version`, `webhook_secret`, `is_active` (BOOLEAN DEFAULT true), `deleted_at`, `created_at`, `updated_at`.

### bot_admins

- `id`, `bot_id`, `telegram_user_id`, `role` ('owner'|'admin'|'staff'|'viewer'), `permissions_json`, `created_by`, `created_at`.
- Уникальность: (bot_id, telegram_user_id).

### bot_settings

- `bot_id` (PK), `timezone`, `business_name`, `brand_json`, `working_hours_json`, `notify_new_leads`, `notify_new_orders`, `notify_new_appointments`, `notify_chat_id`, `updated_at`.

### leads

- `id`, `bot_id`, `customer_id`, `status`, `assignee`, `title`, `message`, `source`, `payload_json`, `created_at`, `updated_at`.
- Индекс: (bot_id, status, created_at DESC).

### orders

- `id`, `bot_id`, `customer_id`, `status`, `payment_status`, `amount`, `currency`, `tracking`, `assignee`, `items_json`, `payload_json`, `created_at`, `updated_at`.
- Индексы: (bot_id, status, created_at), (bot_id, payment_status, created_at).

### bot_events

- `id`, `bot_id`, `type`, `entity_type`, `entity_id`, `status`, `priority`, `assignee`, `payload_json`, `created_at`, `updated_at`.
- Индексы: (bot_id, created_at DESC), (bot_id, status, created_at), (bot_id, type, created_at).

### Проверка в Neon SQL (последняя активность по боту)

```sql
-- Последняя активность по bot_id (подставить свой UUID)
SELECT
  (SELECT MAX(created_at) FROM leads WHERE bot_id = 'BOT_UUID') AS last_lead_at,
  (SELECT MAX(created_at) FROM orders WHERE bot_id = 'BOT_UUID') AS last_order_at,
  (SELECT MAX(created_at) FROM bot_events WHERE bot_id = 'BOT_UUID') AS last_event_at;
```

---

## Health и debug

| Сервис     | Endpoint        | Ответ (кратко) |
|------------|-----------------|----------------|
| Core       | GET /health     | ok, service: 'core', gitSha, port, databases (postgres, redis) |
| Owner Web  | GET /api/health | ok, service: 'owner-web', gitSha, port, debugEnvPath: '/api/debug/env' |
| Owner Web  | GET /api/debug/env | (существует по пути без _debug) |
| Mini App   | GET /health     | ok, service: 'mini-app', gitSha, port, envPort |

Все серверы должны слушать `0.0.0.0` и использовать `process.env.PORT` (не хардкод 3000/8080 в проде).

---

## Bot status feedback (последняя активность)

**Endpoint:** `GET /api/owner/bots/:botId` возвращает объект `status` от `getBotRealStatus()`:

- `isActive`, `webhookSet`, `hasToken`
- `lastLeadAt`, `lastOrderAt`, `lastEventAt` — MAX(created_at) по таблицам leads, orders, bot_events
- `lastActivityAt` — максимум из трёх дат (для подписи «Последняя активность: …»)
- `hasRecentActivity` — true, если за последние 24 ч есть хотя бы одна запись в leads, orders или bot_events

В Owner Web на `/cabinet`: на карточке бота показываются «Активен/Остановлен», «Последняя активность: …» и при `isActive && !hasRecentActivity` — подсказка диагностики. На `/cabinet/[botId]/analytics` при отсутствии активности за 24 ч показывается сообщение с датой последней активности (если есть).

**Проверка в Neon SQL (последняя активность по bot_id):**

```sql
SELECT
  (SELECT MAX(created_at) FROM leads WHERE bot_id = 'BOT_UUID') AS last_lead_at,
  (SELECT MAX(created_at) FROM orders WHERE bot_id = 'BOT_UUID') AS last_order_at,
  (SELECT MAX(created_at) FROM bot_events WHERE bot_id = 'BOT_UUID') AS last_event_at;
```

---

## Smoke-test сценарий

1. Создать бота (Owner Web: /cabinet → Создать бота).
2. Запустить бота (Запустить на карточке или PATCH isActive: true).
3. Создать lead/order через роутер (ingestOwnerEvent с type lead_created/order_created или сообщение с «заявк»/«заказ») либо вручную INSERT в `leads`/`orders` для этого bot_id.
4. В Owner Web: /cabinet — на карточке должна появиться «Последняя активность: <дата>»; /cabinet/[botId]/analytics — в блоке «Сегодня» или «7 дней» должны отобразиться заявки/заказы и последняя активность в статусе.
