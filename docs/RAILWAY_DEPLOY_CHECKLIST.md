# Railway Deployment Checklist

## 1. Endpoints и серверы

### Core (packages/core)
- **HTTP Server**: `app.listen(PORT, ...)` на `process.env.PORT || 3000`
- **Endpoints**:
  - `POST /api/webhook` - Telegram webhook для основного бота (TELEGRAM_BOT_TOKEN)
  - `GET /health` - Health check с проверкой DB/Redis
  - `GET /api/bot-status` - Статус бота
  - Множество `/api/owner/*` endpoints

### Router (packages/router)
- **HTTP Server**: `app.listen(PORT, '0.0.0.0', ...)` на `process.env.PORT || process.env.ROUTER_PORT || 3001`
- **Endpoints**:
  - `GET /` - Простой health check (возвращает "router ok")
  - `GET /health` - Детальный health check с DB/Redis статусом
  - `POST /webhook/:botId` - Telegram webhook для пользовательских ботов

### Worker (packages/worker)
- **Нет HTTP сервера** - только Redis Stream consumer

## 2. Webhook URL Construction

### Основной бот (TELEGRAM_BOT_TOKEN)
- **Где**: `packages/core/src/index.ts:500-501`
- **URL**: `${process.env.API_URL || 'https://lego-bot-core.vercel.app'}/api/webhook`
- **Пример**: `https://core-production-72de.up.railway.app/api/webhook`

### Пользовательские боты
- **Где**: `packages/core/src/bot/webhook-commands.ts:88` и `packages/core/src/bot/scenes.ts:181`
- **URL**: `${process.env.ROUTER_URL || process.env.WEBHOOK_URL || 'http://localhost:3001'}/webhook/${bot.id}`
- **Пример**: `https://router-production.up.railway.app/webhook/{bot-id}`

## 3. Environment Variables (минимум)

| Сервис | Env переменная | Пример значения | Обязательно |
|--------|----------------|-----------------|-------------|
| **core** | `PORT` | `3000` (Railway установит автоматически) | ✅ |
| **core** | `DATABASE_URL` | `postgresql://user:pass@host:5432/db?sslmode=require` | ✅ |
| **core** | `REDIS_URL` | `redis://default:pass@host:6379` | ✅ |
| **core** | `TELEGRAM_BOT_TOKEN` | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` | ✅ |
| **core** | `JWT_SECRET` | `your-secret-key-32-chars-min` | ✅ |
| **core** | `ENCRYPTION_KEY` | `your-encryption-key-32-chars` | ✅ |
| **core** | `API_URL` | `https://core-production-72de.up.railway.app` | ✅ |
| **core** | `ROUTER_URL` | `https://router-production.up.railway.app` | ✅ |
| **core** | `OWNER_WEB_BASE_URL` | `https://owner-web-production.up.railway.app` | ✅ |
| **core** | `TELEGRAM_SECRET_TOKEN` | `your-webhook-secret` | ⚠️ (рекомендуется) |
| **core** | `OWNER_BOTLINK_SECRET` | `your-botlink-secret` | ⚠️ (fallback: JWT_SECRET) |
| **core** | `SENTRY_DSN` | `https://...@sentry.io/...` | ❌ |
| **core** | `ADMIN_USER_IDS` | `123456789,987654321` | ❌ |
| **router** | `PORT` | `3001` (Railway установит автоматически) | ✅ |
| **router** | `DATABASE_URL` | `postgresql://user:pass@host:5432/db?sslmode=require` | ✅ |
| **router** | `ENCRYPTION_KEY` | `your-encryption-key-32-chars` | ✅ |
| **router** | `REDIS_URL` | `redis://default:pass@host:6379` | ⚠️ (опционально) |
| **router** | `ROUTER_INTERNAL_SECRET` | `internal-secret` | ❌ |
| **worker** | `DATABASE_URL` | `postgresql://user:pass@host:5432/db?sslmode=require` | ✅ |
| **worker** | `REDIS_URL` | `redis://default:pass@host:6379` | ✅ |
| **worker** | `LOG_LEVEL` | `info` | ❌ (default: info) |
| **owner-web** | `PORT` | Railway установит автоматически | ✅ |
| **owner-web** | `CORE_API_ORIGIN` | `https://core-production-72de.up.railway.app` | ✅ |
| **owner-web** | `NEXT_PUBLIC_OWNER_WEB_URL` | `https://owner-web-production.up.railway.app` | ✅ |
| **owner-web** | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | `your_bot` | ❌ |
| **miniapp** | `PORT` | Railway установит автоматически | ✅ |
| **miniapp** | `VITE_API_URL` | `https://core-production-72de.up.railway.app` | ✅ |
| **frontend** | `PORT` | Railway установит автоматически | ✅ |
| **frontend** | `VITE_API_URL` | `https://core-production-72de.up.railway.app` | ✅ |

## 4. Railway Commands

### Core
- **Root Directory**: (пусто)
- **Build Command**: `pnpm --filter @dialogue-constructor/shared build && pnpm --filter @dialogue-constructor/core build`
- **Start Command**: `pnpm --filter @dialogue-constructor/core start`

### Router
- **Root Directory**: (пусто)
- **Build Command**: `pnpm --filter @dialogue-constructor/shared build && pnpm --filter @dialogue-constructor/router build`
- **Start Command**: `pnpm --filter @dialogue-constructor/router start`

### Worker
- **Root Directory**: (пусто)
- **Build Command**: `pnpm --filter @dialogue-constructor/shared build && pnpm --filter @dialogue-constructor/worker build`
- **Start Command**: `pnpm --filter @dialogue-constructor/worker start`

### Owner-Web
- **Root Directory**: (пусто)
- **Build Command**: `pnpm --filter @dialogue-constructor/owner-web build`
- **Start Command**: `pnpm --filter @dialogue-constructor/owner-web start`

### Mini-App
- **Root Directory**: (пусто)
- **Build Command**: `pnpm --filter @dialogue-constructor/mini-app build`
- **Start Command**: `pnpm --filter @dialogue-constructor/mini-app start`

### Frontend
- **Root Directory**: (пусто)
- **Build Command**: `pnpm --filter @dialogue-constructor/frontend build`
- **Start Command**: `pnpm --filter @dialogue-constructor/frontend start`

## 5. Проверка (curl команды)

### Router Health Checks
```bash
# Простой health check
curl https://router-production.up.railway.app/

# Детальный health check
curl https://router-production.up.railway.app/health
```

### Core Health Checks
```bash
# Health check
curl https://core-production-72de.up.railway.app/health

# Проверка что /api/webhook принимает POST
curl -X POST https://core-production-72de.up.railway.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"update_id":1}'
```

### Telegram API - Проверка webhook основного бота
```bash
# Замените YOUR_BOT_TOKEN на реальный токен
BOT_TOKEN="YOUR_BOT_TOKEN"
CORE_URL="https://core-production-72de.up.railway.app"

# Проверить текущий webhook
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

# Установить webhook для основного бота
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${CORE_URL}/api/webhook\", \"allowed_updates\": [\"message\", \"callback_query\"]}"

# Если используется secret token
SECRET_TOKEN="your-webhook-secret"
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${CORE_URL}/api/webhook\", \"secret_token\": \"${SECRET_TOKEN}\", \"allowed_updates\": [\"message\", \"callback_query\"]}"
```

### Проверка пользовательского бота webhook
```bash
# Замените USER_BOT_TOKEN и BOT_ID на реальные значения
USER_BOT_TOKEN="USER_BOT_TOKEN"
BOT_ID="bot-uuid-here"
ROUTER_URL="https://router-production.up.railway.app"

# Установить webhook для пользовательского бота
curl -X POST "https://api.telegram.org/bot${USER_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${ROUTER_URL}/webhook/${BOT_ID}\", \"allowed_updates\": [\"message\", \"callback_query\"]}"
```

## 6. План развертывания (1-2-3-4)

### Шаг 1: Railway Variables для Core
```bash
PORT=3000  # Railway установит автоматически
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
REDIS_URL=redis://default:pass@host:6379
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
JWT_SECRET=your-secret-key-32-chars-min
ENCRYPTION_KEY=your-encryption-key-32-chars
API_URL=https://core-production-72de.up.railway.app
ROUTER_URL=https://router-production.up.railway.app
OWNER_WEB_BASE_URL=https://owner-web-production.up.railway.app
TELEGRAM_SECRET_TOKEN=your-webhook-secret  # рекомендуется
OWNER_BOTLINK_SECRET=your-botlink-secret  # или использует JWT_SECRET
NODE_ENV=production
```

### Шаг 2: Railway Variables для Router
```bash
PORT=3001  # Railway установит автоматически
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
ENCRYPTION_KEY=your-encryption-key-32-chars  # ДОЛЖЕН совпадать с core
REDIS_URL=redis://default:pass@host:6379  # опционально
NODE_ENV=production
```

### Шаг 3: Railway Variables для Worker
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
REDIS_URL=redis://default:pass@host:6379
LOG_LEVEL=info
NODE_ENV=production
```

### Шаг 4: Настройка Telegram Webhooks

#### 4.1. Основной бот (TELEGRAM_BOT_TOKEN)
**Webhook URL**: `https://core-production-72de.up.railway.app/api/webhook`

**Команда для установки**:
```bash
BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
CORE_URL="https://core-production-72de.up.railway.app"
SECRET_TOKEN="your-webhook-secret"  # если используется

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${CORE_URL}/api/webhook\", \"secret_token\": \"${SECRET_TOKEN}\", \"allowed_updates\": [\"message\", \"callback_query\"]}"
```

**Проверка**:
```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

#### 4.2. Пользовательские боты
**Webhook URL паттерн**: `https://router-production.up.railway.app/webhook/{bot-id}`

**Как удостовериться**:
1. Создайте бота через Mini App или команду `/create_bot` в основном боте
2. После создания бота, core автоматически вызовет `setWebhook` с URL: `${ROUTER_URL}/webhook/${bot.id}`
3. Проверьте в логах core: должно быть сообщение `🔗 Настройка webhook для бота {bot.id}`
4. Проверьте в Telegram API:
   ```bash
   USER_BOT_TOKEN="user-bot-token"
   curl "https://api.telegram.org/bot${USER_BOT_TOKEN}/getWebhookInfo"
   ```
   Должен вернуть URL вида: `https://router-production.up.railway.app/webhook/{bot-id}`

**Ручная установка (если автоматическая не сработала)**:
```bash
USER_BOT_TOKEN="user-bot-token"
BOT_ID="bot-uuid-from-database"
ROUTER_URL="https://router-production.up.railway.app"

curl -X POST "https://api.telegram.org/bot${USER_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${ROUTER_URL}/webhook/${BOT_ID}\", \"allowed_updates\": [\"message\", \"callback_query\"]}"
```

## 7. Проверка End-to-End

### 7.1. Проверка основного бота
1. Отправьте сообщение основному боту в Telegram
2. Проверьте логи core: должно быть `POST /api/webhook`
3. Бот должен ответить (команды `/start`, `/help`, `/instruction`, `/cabinet`)

### 7.2. Проверка пользовательского бота
1. Создайте бота через Mini App
2. Проверьте, что webhook установлен на router: `curl "https://api.telegram.org/bot${USER_BOT_TOKEN}/getWebhookInfo"`
3. Отправьте сообщение пользовательскому боту
4. Проверьте логи router: должно быть `POST /webhook/{bot-id}`
5. Бот должен ответить согласно схеме

### 7.3. Проверка Worker
1. Отправьте сообщение пользовательскому боту
2. Проверьте Redis Stream: `redis-cli XLEN events` (должен быть > 0)
3. Проверьте логи worker: должно быть `Processing event {eventId}`
4. Проверьте БД: таблица `bot_events` должна содержать событие

## 8. Troubleshooting

### Core не отвечает на /api/webhook
- Проверьте `API_URL` в core env
- Проверьте, что webhook установлен: `curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"`
- Проверьте логи core на ошибки

### Router не отвечает на /webhook/:botId
- Проверьте `ROUTER_URL` в core env
- Проверьте, что router запущен: `curl https://router-production.up.railway.app/`
- Проверьте логи router на ошибки

### Пользовательские боты не получают сообщения
- Проверьте, что webhook установлен на router URL
- Проверьте, что `ENCRYPTION_KEY` одинаковый в core и router
- Проверьте логи router на ошибки дешифровки токена

### Worker не обрабатывает события
- Проверьте Redis connection
- Проверьте Stream: `redis-cli XLEN events`
- Проверьте consumer group: `redis-cli XINFO GROUPS events`
- Проверьте логи worker


