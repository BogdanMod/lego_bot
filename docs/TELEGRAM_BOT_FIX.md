# Telegram Bot Fix - Диагностика и исправление

## 1. Найденная реализация

### Библиотека
- **Telegraf v4.14.0** (`packages/core/package.json:29`)

### Создание бота
- **Файл**: `packages/core/src/index.ts`
- **Строка 213**: `botInstance = new Telegraf<Scenes.SceneContext>(botToken);`
- **Строка 218**: `botInstance.use(session());` - сессии в памяти
- **Строка 221**: `botInstance.use(stage.middleware());` - FSM сцены

### Обработчики команд
- **Строка 277**: `botInstance.command('start', async (ctx) => { ... })`
- **Строка 282**: `await handleStart(ctx as any);`
- **Файл**: `packages/core/src/bot/commands.ts:85` - функция `handleStart`

### Режим работы
- **Webhook** (не polling)
- **Строка 672-675**: `logger.info('🔗 Bot configured for webhook mode');`
- **Строка 674**: `logger.info('📡 Webhook endpoint: /api/webhook');`
- **НЕТ вызова `botInstance.launch()`** - подтверждает webhook режим

## 2. Webhook конфигурация

### Core Service (основной бот)
- **Endpoint**: `POST /api/webhook`
- **Файл**: `packages/core/src/index.ts:1704`
- **Обработка**: `await botInstance.handleUpdate(update);`
- **Secret Token**: Проверяется через `TELEGRAM_SECRET_TOKEN` (если установлен)

### Router Service (созданные боты)
- **Endpoint**: `POST /webhook/:botId`
- **Файл**: `packages/router/src/index.ts:448`
- **Обработка**: Загружает схему бота, обрабатывает диалог

### Установка webhook
- **Функция**: `packages/core/src/services/telegram-webhook.ts:14` - `setWebhook()`
- **Команда бота**: `/setup_webhook` (`packages/core/src/index.ts:466`)
- **Автоматически**: При создании бота через `/newbot` (`packages/core/src/bot/scenes.ts:200`)

## 3. Поток запросов от Telegram

```
Telegram → Router Service (/webhook/:botId) → Core Service (для основного бота)
```

**Для основного бота:**
```
Telegram → Core Service (/api/webhook)
```

**Для созданных ботов:**
```
Telegram → Router Service (/webhook/:botId) → Обработка схемы
```

### Environment Variables

**Core Service:**
- `TELEGRAM_BOT_TOKEN` - токен основного бота (обязательно)
- `TELEGRAM_SECRET_TOKEN` - secret token для webhook (опционально, но рекомендуется)
- `API_URL` - публичный URL core сервиса (для `/setup_webhook`)
- `ROUTER_URL` - URL router сервиса (для создания ботов)

**Router Service:**
- `DATABASE_URL` - PostgreSQL (обязательно)
- `ENCRYPTION_KEY` - для расшифровки токенов ботов (обязательно)
- `REDIS_URL` - для состояний пользователей (опционально, но рекомендуется)

## 4. Проблема с Redis

### Текущая конфигурация
- **Файл**: `packages/core/src/db/redis.ts:249`
- **Проблема**: Нет TLS конфигурации для `rediss://` (Upstash)
- **Ошибка**: "Socket closed unexpectedly"

### Исправление
Добавлена конфигурация TLS для `rediss://`:

```typescript
const isTls = redisUrl.startsWith('rediss://');
const client = createClient({
  url: redisUrl,
  socket: {
    connectTimeout: REDIS_RETRY_CONFIG.connectTimeoutMs,
    ...(isTls ? {
      tls: true,
      rejectUnauthorized: true,
      keepAlive: 30000,
    } : {}),
  },
});
```

### Почему Redis важен
- **Сессии бота**: `botInstance.use(session())` - в памяти (не критично)
- **Rate limiting**: Использует Redis для хранения счетчиков
- **Дедупликация webhook**: Проверка `update_id` в Redis
- **Состояния пользователей**: В router для FSM диалогов

**Если Redis недоступен:**
- Бот может работать (сессии в памяти)
- Rate limiting может не работать
- Дедупликация может не работать
- Router может не работать для созданных ботов

## 5. Конкретные патчи

### Патч 1: Redis TLS для Upstash

**Файл**: `packages/core/src/db/redis.ts:247-254`

```diff
  for (let attempt = 1; attempt <= REDIS_RETRY_CONFIG.maxRetries; attempt++) {
    const attemptStart = Date.now();
+   // Configure TLS for rediss:// (Upstash Redis)
+   const isTls = redisUrl.startsWith('rediss://');
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: REDIS_RETRY_CONFIG.connectTimeoutMs,
+       ...(isTls ? {
+         tls: true,
+         rejectUnauthorized: true,
+         keepAlive: 30000,
+       } : {}),
      },
    });
```

### Патч 2: Root endpoint для core

**Файл**: `packages/core/src/index.ts:1833`

```diff
+ // Root endpoint for Railway health checks
+ app.get('/', async (req: Request, res: Response) => {
+   res.json({ 
+     service: 'core',
+     status: 'ok',
+     timestamp: new Date().toISOString(),
+     endpoints: {
+       health: '/health',
+       api: '/api',
+       webhook: '/api/webhook',
+     },
+   });
+ });
+
  app.get('/health', async (req: Request, res: Response) => {
```

### Патч 3: Улучшенное логирование webhook

**Файл**: `packages/core/src/index.ts:1704`

Добавлено логирование:
- Входящий запрос (headers, IP, body size)
- Парсинг update (updateId, type, messageText)
- Длительность обработки

## 6. Список найденных причин

### Где было указано запускать owner-web вместо core:
1. **Удален `railway.json`** из корня - содержал `"startCommand": "cd packages/owner-web && PORT=$PORT pnpm start"` (применялся ко всем сервисам)
2. **Удален `nixpacks.toml`** из корня - содержал `cmd = "cd packages/owner-web && PORT=${PORT:-8080} pnpm start"` (применялся ко всем сервисам)
3. **Создан `scripts/railway-start.js`** - универсальный start script, который выбирает пакет по `RAILWAY_SERVICE_NAME`
4. **Создан новый `railway.json`** - использует `pnpm railway:start` (config-as-code)

### Проблемы с Redis:
- **packages/core/src/db/redis.ts:249** - не было TLS конфигурации для `rediss://`
- **packages/router/src/db/redis.ts:300** - не было TLS конфигурации для `rediss://`
- **Исправлено**: Добавлена автоматическая TLS конфигурация для `rediss://` URL

### Проблемы с webhook:
- Webhook может быть не настроен (нужно вызвать `/setup_webhook` или установить вручную)
- Нет проверки, что webhook реально работает
- **Исправлено**: Добавлено улучшенное логирование входящих webhook запросов

## 7. Инструкция для Railway

### Шаг 1: Проверка Environment Variables

**Core Service:**
```bash
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_SECRET_TOKEN=<random-secret-token>  # Рекомендуется
API_URL=https://core-production-*.up.railway.app
ROUTER_URL=https://router-production-*.up.railway.app
REDIS_URL=rediss://default:...@...upstash.io:6379  # Upstash URL
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=...
```

**Router Service:**
```bash
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=...
REDIS_URL=rediss://default:...@...upstash.io:6379
```

### Шаг 2: Настройка Webhook для основного бота

**Вариант A: Через команду бота**
1. Откройте бота в Telegram
2. Отправьте: `/setup_webhook`
3. Бот автоматически настроит webhook на `https://core-production-*.up.railway.app/api/webhook`

**Вариант B: Вручную через API**
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://core-production-*.up.railway.app/api/webhook",
    "secret_token": "<TELEGRAM_SECRET_TOKEN>",
    "allowed_updates": ["message", "callback_query"]
  }'
```

### Шаг 3: Проверка Webhook

**Проверка через команду бота:**
```
/check_webhook
```

**Проверка через API:**
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "result": {
    "url": "https://core-production-*.up.railway.app/api/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": null,
    "last_error_message": null,
    "max_connections": 40,
    "allowed_updates": ["message", "callback_query"]
  }
}
```

### Шаг 4: Проверка входящих запросов

**Railway HTTP Logs для Core Service:**
- Должны быть POST запросы на `/api/webhook`
- Status: 200
- Headers: `x-telegram-bot-api-secret-token` (если установлен)

**Railway Deploy Logs:**
- Должны быть логи: `📨 Webhook received:`
- Должны быть логи: `✅ Update handled successfully`

### Шаг 5: Диагностика проблем

**401/403 ошибки:**
- Проверьте `TELEGRAM_SECRET_TOKEN` в Core Service
- Проверьте, что secret token в webhook совпадает с env var
- Проверьте логи: `Missing webhook secret token` или `Invalid webhook secret token`

**503 Bot not initialized:**
- Проверьте `TELEGRAM_BOT_TOKEN` в Core Service
- Проверьте Deploy Logs: должно быть `✅ Bot initialized successfully`
- Проверьте, что `botInstance` не null

**Timeout:**
- Проверьте, что Core Service доступен извне
- Проверьте Railway HTTP Logs на наличие запросов
- Проверьте, что нет блокирующих операций в webhook handler

**Redis "Socket closed unexpectedly":**
- Проверьте, что `REDIS_URL` начинается с `rediss://` для Upstash
- Проверьте, что TLS конфигурация применена (после патча)
- Проверьте Deploy Logs: должно быть `✅ Redis initialized`

## 7. Команды проверки

```bash
# Проверка health endpoint
curl https://core-production-*.up.railway.app/health

# Проверка root endpoint
curl https://core-production-*.up.railway.app/

# Проверка webhook info
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"

# Тест webhook (локально, если есть доступ)
curl -X POST https://core-production-*.up.railway.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-telegram-bot-api-secret-token: <SECRET_TOKEN>" \
  -d '{"update_id": 1, "message": {"message_id": 1, "from": {"id": 123}, "chat": {"id": 123}, "text": "/start"}}'
```

## 8. Критерии успеха

✅ Core Service Deploy Logs содержат: `✅ Bot initialized successfully`  
✅ Core Service Deploy Logs содержат: `✅ Redis initialized` (если REDIS_URL установлен)  
✅ `curl https://core-production-*.up.railway.app/` возвращает JSON с `service: 'core'`  
✅ `curl https://core-production-*.up.railway.app/health` возвращает `status: 'ok'` или `status: 'degraded'`  
✅ `getWebhookInfo` показывает правильный URL  
✅ Railway HTTP Logs показывают POST запросы на `/api/webhook`  
✅ Бот отвечает на `/start` в Telegram  

