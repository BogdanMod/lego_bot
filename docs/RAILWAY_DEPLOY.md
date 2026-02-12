# Railway Deployment Guide

Данный документ описывает настройку деплоя всех 5 сервисов monorepo на Railway.

## Важно: Monorepo Setup

Railway должен устанавливать зависимости и запускать команды **из корня репо**, используя npm workspaces. Это гарантирует, что локальные пакеты (например, `@dialogue-constructor/shared`) правильно линкуются.

## Общая структура

Monorepo содержит 5 сервисов:
1. **core** - Express API сервер (`@dialogue-constructor/core`)
2. **worker** - Event processing worker (`@dialogue-constructor/worker`)
3. **owner-web** - Next.js приложение (`@dialogue-constructor/owner-web`)
4. **mini-app** - Vite приложение (`@dialogue-constructor/mini-app`)
5. **frontend** - Vite приложение (`@dialogue-constructor/frontend`)

## Railway Configuration (для всех сервисов)

### Общие настройки
- **Root Directory**: (пусто) - Railway должен работать из корня репо
- **Install Command**: `npm ci` (из корня репо)

### Workspace Names
- `@dialogue-constructor/core`
- `@dialogue-constructor/worker`
- `@dialogue-constructor/owner-web`
- `@dialogue-constructor/mini-app`
- `@dialogue-constructor/frontend`
- `@dialogue-constructor/shared` (зависимость)

## 1. Core (Express API)

### Railway Configuration
- **Root Directory**: (пусто)
- **Build Command**: `npm run build -w @dialogue-constructor/core`
- **Start Command**: `npm run start -w @dialogue-constructor/core`
- **Port**: Railway автоматически устанавливает `PORT` env var

### Environment Variables (обязательные)
```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
TELEGRAM_BOT_TOKEN=...
JWT_SECRET=...
ENCRYPTION_KEY=...
OWNER_BOTLINK_SECRET=...  # или использует JWT_SECRET
OWNER_WEB_BASE_URL=https://your-owner-web.railway.app
```

### Environment Variables (опциональные)
```bash
SENTRY_DSN=...
ADMIN_USER_IDS=123456789,987654321
NODE_ENV=production
LOG_LEVEL=info
```

### Проверка
- ✅ Сервер слушает `process.env.PORT || 3000`
- ✅ Build компилирует TypeScript в `dist/`
- ✅ Start запускает `node dist/index.js`
- ✅ Workspace dependency `@dialogue-constructor/shared` линкуется автоматически

## 2. Worker (Event Processor)

### Railway Configuration
- **Root Directory**: (пусто)
- **Build Command**: `npm run build -w @dialogue-constructor/worker`
- **Start Command**: `npm run start -w @dialogue-constructor/worker`
- **Port**: Не требуется (worker не слушает HTTP)

### Environment Variables (обязательные)
```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
LOG_LEVEL=info
```

### Проверка
- ✅ Build компилирует TypeScript в `dist/`
- ✅ Start запускает `node dist/index.js`
- ✅ Бесконечный loop с `xReadGroup` и `BLOCK: 5000ms`
- ✅ Consumer group: `event-processors`
- ✅ Stream: `events`
- ✅ DLQ: `events:dead`
- ✅ Workspace dependency `@dialogue-constructor/shared` линкуется автоматически

### Примечания
- Worker работает постоянно, читая из Redis Stream
- Graceful shutdown на SIGTERM/SIGINT
- Retry strategy: 3 попытки с exponential backoff

## 3. Owner-Web (Next.js)

### Railway Configuration
- **Root Directory**: (пусто)
- **Build Command**: `npm run build -w @dialogue-constructor/owner-web`
- **Start Command**: `npm run start -w @dialogue-constructor/owner-web`
- **Port**: Railway автоматически устанавливает `PORT` env var (Next.js использует его автоматически)

### Environment Variables (обязательные)
```bash
CORE_API_ORIGIN=https://your-core.railway.app
NEXT_PUBLIC_OWNER_WEB_URL=https://your-owner-web.railway.app
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot  # опционально
```

### Environment Variables (опциональные)
```bash
NEXT_PUBLIC_SENTRY_DSN=...
NODE_ENV=production
```

### Проверка
- ✅ Build: `next build`
- ✅ Start: `next start` (автоматически использует `PORT`)
- ✅ Dev: `next dev -p 3000` (для локальной разработки)

## 4. Mini-App (Vite)

### Railway Configuration
- **Root Directory**: (пусто)
- **Build Command**: `npm run build -w @dialogue-constructor/mini-app`
- **Start Command**: `npm run start -w @dialogue-constructor/mini-app`
- **Port**: Railway автоматически устанавливает `PORT` env var

### Environment Variables
```bash
VITE_API_URL=https://your-core.railway.app
PORT=5174  # Railway установит автоматически
```

### Проверка
- ✅ Build: `vite build` (собирает в `dist/`)
- ✅ Start: `vite preview --host 0.0.0.0 --port ${PORT:-5174}`
- ✅ Dev: `vite` (для локальной разработки)
- ✅ Workspace dependency `@dialogue-constructor/shared` линкуется автоматически

### Примечания
- Vite preview сервер для production (статический hosting)
- Для production лучше использовать nginx или другой статический сервер
- Railway может использовать статический hosting для Vite build

## 5. Frontend (Vite)

### Railway Configuration
- **Root Directory**: (пусто)
- **Build Command**: `npm run build -w @dialogue-constructor/frontend`
- **Start Command**: `npm run start -w @dialogue-constructor/frontend`
- **Port**: Railway автоматически устанавливает `PORT` env var

### Environment Variables
```bash
VITE_API_URL=https://your-core.railway.app
PORT=5173  # Railway установит автоматически
```

### Проверка
- ✅ Build: `vite build` (собирает в `dist/`)
- ✅ Start: `vite preview --host 0.0.0.0 --port ${PORT:-5173}`
- ✅ Dev: `vite` (для локальной разработки)

## Порядок деплоя

1. **Core** - деплой первым (API должен быть доступен)
2. **Worker** - деплой после Core (нужен доступ к БД и Redis)
3. **Owner-Web** - деплой после Core (нужен `CORE_API_ORIGIN`)
4. **Mini-App** - независимый деплой
5. **Frontend** - независимый деплой

## Workspace Dependencies

Все локальные зависимости используют `"*"` версию:
- `@dialogue-constructor/shared: "*"` в `core`, `worker`, `mini-app`, `router`, `bot-router`

npm workspaces автоматически резолвит эти зависимости при установке из корня репо.

**Важно**: Railway должен запускать команды из корня репо с флагом `-w` (workspace), чтобы npm правильно линковал workspace-пакеты.

## Build процесс

Railway автоматически:
1. Устанавливает зависимости из корня: `npm ci` (создает симлинки для workspace-пакетов)
2. Запускает Build Command с флагом `-w`: `npm run build -w @dialogue-constructor/<service>`
3. Запускает Start Command с флагом `-w`: `npm run start -w @dialogue-constructor/<service>`

## Переменные окружения

### Core
```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
TELEGRAM_BOT_TOKEN=...
JWT_SECRET=...
ENCRYPTION_KEY=...
OWNER_BOTLINK_SECRET=...
OWNER_WEB_BASE_URL=https://...
SENTRY_DSN=...  # опционально
ADMIN_USER_IDS=...  # опционально
```

### Owner-Web
```bash
CORE_API_ORIGIN=https://...
NEXT_PUBLIC_OWNER_WEB_URL=https://...
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=...  # опционально
NEXT_PUBLIC_SENTRY_DSN=...  # опционально
```

### Worker
```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
LOG_LEVEL=info
```

## Smoke Tests

После деплоя проверьте:

### Core Health
```bash
curl https://your-core.railway.app/api/health
```

### Owner-Web Health
```bash
curl https://your-owner-web.railway.app/api/health
```

### SSO Flow
1. Откройте Telegram бот
2. Отправьте `/cabinet`
3. Нажмите "Открыть кабинет"
4. Проверьте, что owner-web открывается и автоматически логинит

### SSE Realtime
1. Откройте owner-web
2. Откройте DevTools → Network
3. Проверьте, что есть запрос к `/api/core/owner/bots/:botId/stream`
4. Проверьте, что приходят SSE события

## Troubleshooting

### Build fails: "Cannot find module @dialogue-constructor/shared"
**Проблема**: Railway пытается установить зависимости в каждом пакете отдельно.

**Решение**: 
- Убедитесь, что **Root Directory** пустой (Railway работает из корня репо)
- Убедитесь, что используется `npm ci` из корня
- Убедитесь, что Build/Start команды используют флаг `-w`:
  - `npm run build -w @dialogue-constructor/core`
  - НЕ `cd packages/core && npm run build`

### Port conflicts
- Railway автоматически устанавливает `PORT`
- Убедитесь, что сервисы используют `process.env.PORT`
- Next.js автоматически использует `PORT`
- Vite preview использует `${PORT:-default}`

### Worker не обрабатывает события
- Проверьте Redis connection
- Проверьте, что Stream `events` существует
- Проверьте consumer group: `XINFO GROUPS events`
- Проверьте логи Railway на наличие ошибок

### Database connection fails
- Проверьте `DATABASE_URL` формат
- Проверьте SSL режим (Neon требует SSL)
- Проверьте connection pool limits

### Workspace packages not linked
- Убедитесь, что root `package.json` содержит `"workspaces": ["packages/*"]`
- Убедитесь, что root `package.json` содержит `"private": true`
- Убедитесь, что используется `npm ci` из корня (не `npm install` в каждом пакете)
- Проверьте, что `package-lock.json` содержит workspace links

## Локальная разработка

Все скрипты `dev` настроены для локальной разработки:
- Core: `npm run dev -w @dialogue-constructor/core` (tsx watch)
- Worker: `npm run dev -w @dialogue-constructor/worker` (tsx watch)
- Owner-Web: `npm run dev -w @dialogue-constructor/owner-web` (next dev -p 3000)
- Mini-App: `npm run dev -w @dialogue-constructor/mini-app` (vite)
- Frontend: `npm run dev -w @dialogue-constructor/frontend` (vite)

Или используйте turbo:
```bash
npm run dev  # запускает все сервисы через turbo
```

Локальная разработка не требует изменений после подготовки к Railway.
