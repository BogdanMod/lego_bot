# Production Environment Variables Matrix

Полная матрица переменных окружения, healthcheck endpoints и зависимостей для всех сервисов в production на Railway.

---

## Таблица сервисов

| Сервис | Домен (Railway) | Обязательные ENV | Опциональные ENV | Healthcheck | Зависимости |
|--------|-----------------|------------------|-------------------|-------------|-------------|
| **core** | `core-production-xxxx.up.railway.app` | `DATABASE_URL`<br>`TELEGRAM_BOT_TOKEN`<br>`ENCRYPTION_KEY`<br>`JWT_SECRET` | `REDIS_URL`<br>`TELEGRAM_SECRET_TOKEN`<br>`OWNER_BOTLINK_SECRET`<br>`MINI_APP_URL`<br>`API_URL`<br>`SENTRY_DSN` | `GET /health` | PostgreSQL<br>Redis (опционально)<br>Telegram Bot API |
| **owner-web** | `owner-web-production-xxxx.up.railway.app` | `CORE_API_ORIGIN`<br>`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | `NEXT_PUBLIC_SENTRY_DSN`<br>`ENABLE_OWNER_WIZARD` (опционально)<br>`NEXT_PUBLIC_ENABLE_OWNER_WIZARD` (опционально) | `GET /api/health` | core (через CORE_API_ORIGIN) |
| **miniapp** | `miniapp-production-xxxx.up.railway.app` | *(нет)* | `VITE_API_URL`<br>`VITE_OWNER_WEB_BASE_URL` | `GET /health` | core (через API)<br>owner-web (через botlink) |
| **router** | `router-production-xxxx.up.railway.app` | `DATABASE_URL`<br>`ENCRYPTION_KEY` | `REDIS_URL`<br>`ROUTER_PORT` | `GET /health` | PostgreSQL<br>Redis (опционально)<br>Telegram Bot API |
| **worker** | *(private service)* | `DATABASE_URL`<br>`REDIS_URL` | `LOG_LEVEL` | *(нет HTTP сервера)* | PostgreSQL<br>Redis (обязательно) |
| **frontend** | `frontend-production-xxxx.up.railway.app` | *(нет)* | `VITE_API_URL` | *(нет)* | core (через API) |

---

## Детальная информация по сервисам

### 1. **core** (Core API Server)

**Описание:** Основной Express.js сервер с Telegram ботом и Owner API.

**Домен:** `https://core-production-xxxx.up.railway.app`

**Обязательные переменные:**
- `DATABASE_URL` - PostgreSQL connection string (Neon/Postgres)
- `TELEGRAM_BOT_TOKEN` - Токен Telegram бота от @BotFather
- `ENCRYPTION_KEY` - Ключ для шифрования токенов ботов (минимум 32 символа)
- `JWT_SECRET` - Секретный ключ для JWT токенов Owner сессий (минимум 32 символа)

**Опциональные переменные:**
- `REDIS_URL` - Redis connection string (Upstash/local) для rate limiting и кеширования
- `TELEGRAM_SECRET_TOKEN` - Секретный токен для webhook security (рекомендуется)
- `OWNER_BOTLINK_SECRET` - Секретный ключ для botlink токенов (fallback: JWT_SECRET или ENCRYPTION_KEY)
- `MINI_APP_URL` - URL Mini App для генерации ссылок
- `API_URL` - URL API для генерации ссылок
- `SENTRY_DSN` - Sentry DSN для error tracking
- `NODE_ENV` - Окружение (production/development/test)

**Healthcheck:**
- **Endpoint:** `GET /health`
- **Ожидаемый ответ:** `200 OK` с JSON:
  ```json
  {
    "status": "ok",
    "databases": { "postgres": "ready", "redis": "ready|degraded|skipped" },
    "featureFlags": { "botEnabled": true, "encryptionAvailable": true },
    "timestamp": 1234567890
  }
  ```

**Зависимости:**
- **PostgreSQL** (обязательно) - для хранения ботов, пользователей, событий
- **Redis** (опционально) - для rate limiting, кеширования, botlink deduplication
- **Telegram Bot API** - для работы Telegram бота

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/core build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/core start
```

---

### 2. **owner-web** (Owner Cabinet - Next.js)

**Описание:** Next.js 15 приложение для Owner Cabinet (SaaS панель управления).

**Домен:** `https://owner-web-production-xxxx.up.railway.app`

**Обязательные переменные:**
- `CORE_API_ORIGIN` (server-side) - URL сервиса `core` для проксирования запросов
  - Пример: `https://core-production-xxxx.up.railway.app`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (client-side) - Username Telegram бота для Login Widget
  - Пример: `my_bot` (без @)
  - **Важно:** После изменения требуется rebuild (`pnpm build`)

**Опциональные переменные:**
- `NEXT_PUBLIC_SENTRY_DSN` (client-side) - Sentry DSN для error tracking в браузере
- `NODE_ENV` - Окружение (production/development/test)

**Healthcheck:**
- **Endpoint:** `GET /api/health`
- **Ожидаемый ответ:** `200 OK` с JSON:
  ```json
  {
    "ok": true,
    "service": "owner-web",
    "ts": 1234567890
  }
  ```

**Зависимости:**
- **core** (через `CORE_API_ORIGIN`) - все API запросы проксируются через `/api/core/*` к core сервису

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/owner-web build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/owner-web start
```

**Важно:**
- `NEXT_PUBLIC_*` переменные встраиваются в клиентский код при сборке
- После изменения `NEXT_PUBLIC_*` требуется rebuild
- Server-side переменные (`CORE_API_ORIGIN`) доступны только на сервере

---

### 3. **miniapp** (Mini App - Vite)

**Описание:** Vite + React приложение для Telegram Mini App.

**Домен:** `https://miniapp-production-xxxx.up.railway.app`

**Обязательные переменные:**
- *(нет обязательных)* - Railway автоматически устанавливает `PORT`

**Опциональные переменные:**
- `VITE_API_URL` (client-side) - URL API для запросов (обычно URL core сервиса)
  - Пример: `https://core-production-xxxx.up.railway.app`
  - **Важно:** После изменения требуется rebuild (`pnpm build`)
- `VITE_OWNER_WEB_BASE_URL` (client-side) - URL Owner Web для переходов в кабинет владельца
  - Пример: `https://owner-web-production-xxxx.up.railway.app`
  - **Важно:** 
    - URL должен быть без trailing slash (`/`)
    - После изменения требуется rebuild (`pnpm build`)
    - Если не установлен, переходы в owner-web не будут работать
- `NODE_ENV` - Окружение (production/development/test)

**Healthcheck:**
- **Endpoint:** `GET /health`
- **Ожидаемый ответ:** `200 OK` с JSON:
  ```json
  {
    "ok": true,
    "service": "mini-app",
    "port": 3002,
    "envPort": "3002",
    "timestamp": 1234567890,
    "uptime": 123.45
  }
  ```

**Зависимости:**
- **core** (через API) - все запросы идут к core сервису
- **owner-web** (опционально, через `VITE_OWNER_WEB_BASE_URL`) - для переходов в кабинет владельца

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/mini-app build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/mini-app start
```

**Важно:**
- Сервер слушает на `0.0.0.0` и использует `process.env.PORT` (Railway устанавливает автоматически)
- `VITE_API_URL` и `VITE_OWNER_WEB_BASE_URL` встраиваются в клиентский код при сборке
- После изменения `VITE_*` переменных требуется rebuild

---

### 4. **router** (Router Service)

**Описание:** Express.js сервер для обработки webhook'ов от Telegram для созданных ботов.

**Домен:** `https://router-production-xxxx.up.railway.app`

**Обязательные переменные:**
- `DATABASE_URL` - PostgreSQL connection string для загрузки схем ботов
- `ENCRYPTION_KEY` - Ключ для расшифровки токенов ботов (должен совпадать с core)

**Опциональные переменные:**
- `REDIS_URL` - Redis connection string для состояния пользователей и дедупликации
- `ROUTER_PORT` - Порт для локальной разработки (в production используется `PORT` от Railway)
- `NODE_ENV` - Окружение (production/development/test)

**Healthcheck:**
- **Endpoint:** `GET /health`
- **Ожидаемый ответ:** `200 OK` с JSON (формат зависит от реализации)

**Зависимости:**
- **PostgreSQL** (обязательно) - для загрузки схем ботов и состояния
- **Redis** (опционально) - для хранения состояния пользователей и дедупликации
- **Telegram Bot API** - для отправки сообщений от имени ботов

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/router build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/router start
```

**Важно:**
- `ENCRYPTION_KEY` должен совпадать с `ENCRYPTION_KEY` в сервисе `core`
- Router обрабатывает webhook'и на `/webhook/:botId`

---

### 5. **worker** (Worker Service)

**Описание:** Фоновый сервис для обработки событий из Redis Streams и обновления entities.

**Домен:** *(private service, нет публичного домена)*

**Обязательные переменные:**
- `DATABASE_URL` - PostgreSQL connection string для обновления entities
- `REDIS_URL` - Redis connection string для чтения из Streams (обязательно для worker)

**Опциональные переменные:**
- `LOG_LEVEL` - Уровень логирования (info/debug/warn/error)
- `NODE_ENV` - Окружение (production/development/test)

**Healthcheck:**
- *(нет HTTP сервера)* - worker не имеет публичного HTTP endpoint
- Проверка работоспособности: через логи Railway (должны быть сообщения об обработке событий)

**Зависимости:**
- **PostgreSQL** (обязательно) - для обновления `customers`, `leads`, `orders`, `appointments`, `bot_usage_daily`
- **Redis** (обязательно) - для чтения из Stream `events` и публикации в PubSub для SSE

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/worker build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/worker start
```

**Важно:**
- Worker работает в бесконечном цикле, читая из Redis Stream `events`
- Использует consumer group `event-processors` для распределенной обработки
- Публикует события в Redis PubSub для real-time обновлений в UI

---

### 6. **frontend** (Frontend - Vite)

**Описание:** Vite + React приложение для публичного фронтенда.

**Домен:** `https://frontend-production-xxxx.up.railway.app`

**Обязательные переменные:**
- *(нет обязательных)* - Railway автоматически устанавливает `PORT`

**Опциональные переменные:**
- `VITE_API_URL` (client-side) - URL API для запросов
  - Пример: `https://core-production-xxxx.up.railway.app`
  - **Важно:** После изменения требуется rebuild (`pnpm build`)
- `NODE_ENV` - Окружение (production/development/test)

**Healthcheck:**
- *(нет стандартного healthcheck endpoint)*
- Можно использовать `GET /` для проверки доступности

**Зависимости:**
- **core** (через API) - все запросы идут к core сервису

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/frontend build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/frontend start
```

**Важно:**
- `VITE_API_URL` встраивается в клиентский код при сборке
- После изменения `VITE_API_URL` требуется rebuild

---

## Общие зависимости (инфраструктура)

### PostgreSQL (Neon/Postgres)

**Используется сервисами:**
- `core` (обязательно)
- `router` (обязательно)
- `worker` (обязательно)

**Переменная:** `DATABASE_URL`
- Формат: `postgresql://user:password@host:port/database`
- Пример: `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require`

---

### Redis (Upstash/Local)

**Используется сервисами:**
- `core` (опционально) - для rate limiting, кеширования, botlink deduplication
- `router` (опционально) - для состояния пользователей, дедупликации
- `worker` (обязательно) - для чтения Streams и публикации в PubSub

**Переменная:** `REDIS_URL`
- Формат: `redis://host:port` или `rediss://host:port` (TLS)
- Пример: `rediss://default:xxx@xxx.upstash.io:6379`

**Важно для Upstash:**
- Используйте `rediss://` (с двойным 's') для TLS
- Railway автоматически настраивает TLS для `rediss://` URLs

---

## Чек-лист настройки production

### Для каждого сервиса:

- [ ] Все обязательные переменные установлены в Railway Variables
- [ ] Healthcheck endpoint настроен в Railway UI
- [ ] Build Command и Start Command настроены в Railway UI
- [ ] Healthcheck возвращает `200 OK`
- [ ] Сервис показывает статус "Online" в Railway UI

### Для инфраструктуры:

- [ ] PostgreSQL доступен (проверить `DATABASE_URL`)
- [ ] Redis доступен (если используется, проверить `REDIS_URL`)
- [ ] Telegram Bot Token валиден (проверить через `/api/bot-status` в core)

### Для зависимостей между сервисами:

- [ ] `owner-web` → `CORE_API_ORIGIN` указывает на правильный URL core
- [ ] `miniapp` → `VITE_API_URL` указывает на правильный URL core (если используется)
- [ ] `frontend` → `VITE_API_URL` указывает на правильный URL core (если используется)
- [ ] `router` → `ENCRYPTION_KEY` совпадает с `ENCRYPTION_KEY` в core

---

## Важные замечания

1. **PORT переменная:** Railway автоматически устанавливает `PORT` для каждого сервиса. НЕ добавляйте `PORT` в Railway Variables вручную.

2. **NEXT_PUBLIC_* и VITE_* переменные:** Встраиваются в клиентский код при сборке. После изменения требуется rebuild.

3. **Server-side переменные:** Доступны только на сервере и не попадают в клиентский код.

4. **Secrets:** Никогда не используйте `NEXT_PUBLIC_*` или `VITE_*` для секретов. Только для публичных значений.

5. **Rebuild после изменения env:** Если изменили `NEXT_PUBLIC_*` или `VITE_*`, выполните rebuild:
   ```bash
   pnpm --filter @dialogue-constructor/<package> build
   ```

6. **Проверка env переменных:** Используйте debug endpoints:
   - `owner-web`: `GET /api/_debug/env` (dev/staging only)
   - `core`: `GET /health` (показывает статус env переменных)

---

## Ссылки на документацию

- [Railway UI Setup](./RAILWAY_UI_SETUP.md) - инструкции по настройке команд в Railway UI
- [Owner Auth ENV](./OWNER_AUTH_ENV.md) - детальная документация по Owner Auth переменным
- [Railway Deploy](./RAILWAY_DEPLOY.md) - общая документация по деплою на Railway

