# Railway Deployment Guide

Данный документ описывает настройку деплоя всех 5 сервисов monorepo на Railway.

## Общая структура

Monorepo содержит 5 сервисов:
1. **core** - Express API сервер
2. **worker** - Event processing worker (Redis Streams consumer)
3. **owner-web** - Next.js приложение (Owner Cabinet)
4. **mini-app** - Vite приложение (Telegram Mini App)
5. **frontend** - Vite приложение (Public frontend)

## 1. Core (Express API)

### Railway Configuration
- **Root Directory**: `packages/core`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
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
- ✅ Не запускается на Vercel (`VERCEL=1` проверяется)

## 2. Worker (Event Processor)

### Railway Configuration
- **Root Directory**: `packages/worker`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
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

### Примечания
- Worker работает постоянно, читая из Redis Stream
- Graceful shutdown на SIGTERM/SIGINT
- Retry strategy: 3 попытки с exponential backoff

## 3. Owner-Web (Next.js)

### Railway Configuration
- **Root Directory**: `packages/owner-web`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
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
- **Root Directory**: `packages/mini-app`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
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

### Примечания
- Vite preview сервер для production (статический hosting)
- Для production лучше использовать nginx или другой статический сервер
- Railway может использовать статический hosting для Vite build

## 5. Frontend (Vite)

### Railway Configuration
- **Root Directory**: `packages/frontend`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
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

## Общие зависимости

Все сервисы используют:
- **PostgreSQL** (Neon или Railway Postgres)
- **Redis** (Upstash или Railway Redis)
- **Shared package** (`@dialogue-constructor/shared`) - должен быть собран перед build

## Build процесс

Railway автоматически:
1. Устанавливает зависимости (`npm install`)
2. Запускает Build Command
3. Запускает Start Command

Для monorepo может потребоваться установка зависимостей в корне:
```bash
# В Root Directory каждого сервиса
cd ../.. && npm install && cd packages/<service>
```

Или использовать Railway's monorepo detection.

## Health Checks

### Core
```bash
curl https://your-core.railway.app/api/health
```

### Owner-Web
```bash
curl https://your-owner-web.railway.app/api/health
```

### Worker
Worker не имеет HTTP endpoint, проверка через логи Railway.

## Troubleshooting

### Build fails
- Проверьте, что `@dialogue-constructor/shared` собран
- Проверьте Node.js version (рекомендуется 20.x)
- Проверьте наличие всех env vars

### Port conflicts
- Railway автоматически устанавливает `PORT`
- Убедитесь, что сервисы используют `process.env.PORT`

### Worker не обрабатывает события
- Проверьте Redis connection
- Проверьте, что Stream `events` существует
- Проверьте consumer group: `XINFO GROUPS events`

### Database connection fails
- Проверьте `DATABASE_URL` формат
- Проверьте SSL режим (Neon требует SSL)
- Проверьте connection pool limits

## Локальная разработка

Все скрипты `dev` настроены для локальной разработки:
- Core: `npm run dev` (tsx watch)
- Worker: `npm run dev` (tsx watch)
- Owner-Web: `npm run dev` (next dev -p 3000)
- Mini-App: `npm run dev` (vite)
- Frontend: `npm run dev` (vite)

Локальная разработка не требует изменений после подготовки к Railway.

