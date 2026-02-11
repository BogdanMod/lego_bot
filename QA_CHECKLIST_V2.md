# QA Checklist v2 - Enterprise-Grade Owner Cabinet

## v2 Новые Функции

### Event-Driven Pipeline
- [ ] Router создает события в Redis Stream `events` после записи `bot_events`
- [ ] Worker читает из Stream и обрабатывает события
- [ ] Worker обновляет entities (customers/leads/orders/appointments)
- [ ] Worker обновляет `bot_events.processed_at` и `status`
- [ ] Worker публикует в Redis PubSub для SSE
- [ ] При ошибке: 3 retry с exponential backoff
- [ ] После 3 retry: событие идет в DLQ stream `events:dead`
- [ ] Usage counters обновляются инкрементально в `bot_usage_daily`

### SSE Realtime
- [ ] Endpoint `/api/owner/bots/:botId/stream` возвращает SSE
- [ ] SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
- [ ] Событие `connected` отправляется при подключении
- [ ] Keep-alive `ping` каждые 30 секунд
- [ ] Worker публикует события в PubSub → SSE доставляет их
- [ ] Owner-web подписывается через EventSource
- [ ] TanStack Query cache инвалидируется при получении событий
- [ ] Graceful cleanup при disconnect

### RBAC 2.0
- [ ] `bot_admins.permissions_json` используется для permissions
- [ ] Default permissions: owner (all), admin (no team/settings write), staff (no team/settings/audit), viewer (read-only)
- [ ] Middleware `requirePermission('orders.write')` работает
- [ ] UI скрывает/дизейблит действия по permission
- [ ] Endpoint `/api/owner/bots/:botId/me` возвращает permissions

### Tenant Isolation
- [ ] Все endpoints (кроме `/auth/*` и `/bots`) требуют `botId`
- [ ] `requireBotContext` middleware проверяет доступ
- [ ] `botContext` содержит: `botId`, `role`, `permissions`
- [ ] Все запросы фильтруются по `bot_id` в БД
- [ ] Pagination использует `(created_at, id)` cursor

### Observability
- [ ] `request_id` в всех запросах и ответах
- [ ] Structured logs: `{requestId, botId, userId, route, method, statusCode, latency}`
- [ ] Sentry инициализирован в core (если `SENTRY_DSN` задан)
- [ ] Sentry инициализирован в owner-web (если `NEXT_PUBLIC_SENTRY_DSN` задан)
- [ ] Sentry beforeSend фильтрует sensitive data
- [ ] Worker логирует с `botId`, `eventId`, `eventType`

### Billing-Ready
- [ ] Таблица `bot_usage_daily` создана (миграция `020`)
- [ ] Worker инкрементально обновляет counters
- [ ] Endpoint `/api/owner/bots/:botId/usage` возвращает usage статистику
- [ ] Usage агрегируется по дате
- [ ] Counters: events_count, messages_count, customers_count, leads_count, orders_count, appointments_count

## Авторизация (v1 + v2)
- [ ] Команда `/cabinet` в Telegram возвращает кнопку "Открыть кабинет"
- [ ] Клик по кнопке открывает owner-web и автоматически логинит
- [ ] Cookie `owner_session` устанавливается после входа
- [ ] `/api/core/owner/auth/me` возвращает profile + bots + csrfToken
- [ ] Повторное использование той же botlink ссылки → ошибка "уже использована"
- [ ] Токен старше 2 минут → ошибка "истек"
- [ ] Пользователь без bot_admins → 403 "нет доступа"

## Multi-Bot (v1 + v2)
- [ ] Bot selector отображает все доступные боты
- [ ] Поиск в bot selector работает
- [ ] Роли отображаются корректно (owner/admin/staff/viewer)
- [ ] Permissions отображаются в `/api/owner/bots/:botId/me`
- [ ] Переключение бота сохраняет lastBotId в localStorage
- [ ] При входе редирект на последний бот (если доступен)
- [ ] Если последний бот недоступен → редирект на первый доступный
- [ ] URL всегда содержит botId: `/cabinet/[botId]/...`
- [ ] Все запросы используют botId из route params

## Навигация (v1 + v2)
- [ ] Sidebar отображает все разделы на русском
- [ ] Активный раздел подсвечивается
- [ ] Переход между разделами работает
- [ ] Hotkey `/` фокусирует глобальный поиск
- [ ] Hotkey `g i` → Inbox
- [ ] Hotkey `g c` → Customers
- [ ] Hotkey `g o` → Orders
- [ ] Hotkey `g k` → Calendar
- [ ] Command Palette (⌘K) открывается
- [ ] Поиск в Command Palette работает
- [ ] Навигация из Command Palette работает

## Страницы (v1 + v2)

### Overview
- [ ] KPI карточки отображаются (лиды, заказы, выручка, конверсия)
- [ ] Недавние лиды показываются
- [ ] Недавние заказы показываются
- [ ] Ближайшие записи показываются
- [ ] Skeleton loading работает
- [ ] Empty state при отсутствии данных

### Inbox
- [ ] Список событий отображается
- [ ] Фильтры по статусу работают (new/in_progress/done/cancelled)
- [ ] Поиск работает
- [ ] Пагинация работает (cursor-based `(created_at, id)`)
- [ ] Empty state при отсутствии событий
- [ ] Realtime обновления через SSE

### Orders
- [ ] Список заказов отображается
- [ ] Статусы заказов показываются
- [ ] Пагинация работает (cursor-based)
- [ ] Empty state при отсутствии заказов
- [ ] Actions скрыты/дизейблены по permission `orders.write`

### Leads
- [ ] Список лидов отображается
- [ ] Статусы лидов показываются
- [ ] Пагинация работает (cursor-based)
- [ ] Empty state при отсутствии лидов
- [ ] Actions скрыты/дизейблены по permission `leads.write`

### Customers
- [ ] Список клиентов отображается
- [ ] Контакты (телефон/email) показываются
- [ ] Пагинация работает (cursor-based)
- [ ] Empty state при отсутствии клиентов
- [ ] Actions скрыты/дизейблены по permission `customers.write`

### Calendar
- [ ] Записи отображаются
- [ ] Даты форматируются корректно
- [ ] Empty state при отсутствии записей
- [ ] Actions скрыты/дизейблены по permission `appointments.write`

### Team
- [ ] Список участников отображается
- [ ] Роли показываются
- [ ] Empty state при отсутствии участников
- [ ] Actions скрыты/дизейблены по permission `team.write`

### Settings
- [ ] Настройки бота отображаются
- [ ] Редактирование работает (если есть permission `settings.write`)

### Audit
- [ ] История изменений отображается
- [ ] Сортировка по дате работает
- [ ] Empty state при отсутствии записей
- [ ] Доступ только с permission `audit.read`

### Usage (v2)
- [ ] Endpoint `/api/owner/bots/:botId/usage` возвращает данные
- [ ] Usage по датам отображается
- [ ] Counters корректны (events, messages, customers, leads, orders, appointments)

## UI/UX (v1 + v2)
- [ ] Все тексты на русском (кроме общепринятых терминов)
- [ ] Skeleton loading на всех страницах
- [ ] Empty states красивые и информативные
- [ ] Ошибки показывают request_id (скрыто в "подробнее")
- [ ] Таблицы читаемые, плотные
- [ ] Badges для статусов/ролей
- [ ] Hover states работают
- [ ] Dark mode работает (если включен)
- [ ] Мобильная адаптивность (базовая)
- [ ] Actions скрыты/дизейблены по permissions

## Безопасность (v1 + v2)
- [ ] Cookies: httpOnly, secure (prod), sameSite=Lax
- [ ] CSRF: Mutations требуют x-csrf-token
- [ ] RBAC 2.0: Нет доступа к чужим ботам → 403
- [ ] RBAC 2.0: Permissions проверяются middleware
- [ ] Tenant isolation: Все запросы требуют botId
- [ ] Botlink: Одноразовость через Redis
- [ ] Security headers: X-Content-Type-Options, Referrer-Policy
- [ ] Request ID в всех ответах
- [ ] Логи без токенов/паролей
- [ ] Sentry beforeSend фильтрует sensitive data

## Производительность (v1 + v2)
- [ ] Страницы загружаются быстро (<2s)
- [ ] Пагинация работает без лагов (cursor-based)
- [ ] Поиск не блокирует UI
- [ ] Skeleton показывается мгновенно
- [ ] SSE connection стабильна
- [ ] Worker обрабатывает события без задержек
- [ ] Usage counters обновляются инкрементально (не блокируют)

## Ошибки (v1 + v2)
- [ ] 401 → редирект на /login
- [ ] 403 → понятное сообщение (с указанием permission если нужно)
- [ ] 404 → понятное сообщение
- [ ] 500 → сообщение с request_id
- [ ] Network errors обрабатываются
- [ ] Все ошибки показывают request_id
- [ ] Worker ошибки логируются и идут в DLQ

## Интеграция (v1 + v2)
- [ ] Proxy `/api/core/*` работает
- [ ] Set-Cookie headers форвардятся
- [ ] Content-Type форвардится
- [ ] Debug header x-proxy-upstream присутствует
- [ ] Все запросы через same-origin proxy
- [ ] SSE endpoint работает через proxy
- [ ] Worker читает из Redis Stream
- [ ] Worker публикует в Redis PubSub

## Worker (v2)
- [ ] Worker запускается и подключается к Redis
- [ ] Consumer group `event-processors` создается
- [ ] Worker читает события из Stream
- [ ] Worker обрабатывает события (обновляет entities)
- [ ] Worker обновляет `bot_events.processed_at`
- [ ] Worker обновляет usage counters
- [ ] Worker публикует в PubSub
- [ ] Retry работает (3 попытки)
- [ ] DLQ работает (события после 3 retry)
- [ ] Graceful shutdown работает

## Финальная проверка (v1 + v2)
- [ ] Все страницы открываются без ошибок
- [ ] Нет console errors в браузере
- [ ] Нет TypeScript errors
- [ ] Нет lint errors
- [ ] Деплой на Vercel проходит успешно
- [ ] Core, Worker, Owner-Web деплоятся отдельно
- [ ] Production работает стабильно
- [ ] SSE realtime работает
- [ ] Usage counters обновляются
- [ ] Permissions работают корректно

