# RUNBOOK

## Prerequisites

- Node.js >= 18.0.0 (check with `node --version`)
- Docker and Docker Compose (check with `docker --version` and `docker-compose --version`; if `docker-compose` is not found, use Compose v2: `docker compose version` and run commands as `docker compose ...`)
- jq (optional, for pretty-printing JSON in the optional verify script; if missing, raw curl output is fine)
- npm (comes with Node.js)
- Git (for cloning)

## Initial Setup

- Clone repository: `git clone https://github.com/BogdanMod/lego_bot.git && cd lego_bot`
- Install dependencies: `npm install` (installs all workspace packages)
- Copy `.env.example` to `.env`: `cp .env.example .env`
  - Option (Windows PowerShell): `copy .env.example .env` or `Copy-Item .env.example .env`
- Generate encryption key:
  ```bash
  # Option 1: Using openssl
  openssl rand -base64 32
  
  # Option 2: Using Node.js
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- Edit `.env` and set:
  - `TELEGRAM_BOT_TOKEN` (get from @BotFather)
  - `ENCRYPTION_KEY` (paste generated key)
  - `MINI_APP_URL` (URL вашего Mini App на Vercel, например https://lego-bot-miniapp.vercel.app)
  - `API_URL` (URL вашего Core API на Vercel, например https://lego-bot-core.vercel.app)
  - `TELEGRAM_SECRET_TOKEN` (опционально, для безопасности webhook)
  - `ADMIN_USER_IDS` (опционально, список Telegram user IDs через запятую для доступа к admin командам)
  - Verify `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/dialogue_constructor`
  - Verify `REDIS_URL=redis://localhost:6379`

## Starting Services

Step 1: Start databases
```bash
docker-compose up -d
```
> **Option (Compose v2):** If `docker-compose` is not available, use `docker compose up -d`.
Wait 10-15 seconds for health checks to pass. Verify with:
```bash
docker-compose ps
# Both postgres and redis should show "healthy" status
```
> **Option (Compose v2):** `docker compose ps`

Step 2: Verify database connectivity
```bash
cd packages/core
npm run test-db
```
Expected output: PostgreSQL and Redis connection successful messages.

Step 3: Start core service (Terminal 1)
```bash
cd packages/core
npm run dev
```
Wait for "✅ PostgreSQL initialized" and "✅ Redis initialized" messages. Verify health:
```bash
curl http://localhost:3000/health
# Example output: {"status":"ok","databases":{"postgres":"ready","redis":"ready"}} (exact fields may vary; expect `status: ok|degraded` and a `databases` block)
```

Step 4: Start router service (Terminal 2)
```bash
cd packages/router
npm run dev
```
Wait for "✅ PostgreSQL pool initialized" and "✅ Redis initialized" messages. Verify health:
```bash
curl http://localhost:3001/health
# Example output: {"status":"ok","service":"router","databases":{"postgres":"ready","redis":"ready"}} (exact fields may vary; expect `status: ok|degraded` and a `databases` block)
```

Step 5: Start mini-app (Terminal 3)
```bash
cd packages/mini-app
npm run dev
```
Open browser to `http://localhost:5174`.
> **Option:** If port 5174 is busy, Vite will offer a different port; use the URL printed in the terminal output. Check browser console for "🏠 Local dev detected, using: http://localhost:3000".

## Verification Checklist

- [ ] `npm install` at repo root succeeds without errors
- [ ] `docker-compose up -d` brings up PostgreSQL and Redis with "healthy" status
- [ ] `docker-compose ps` shows both containers running
- [ ] `cd packages/core && npm run test-db` passes with ✅ messages
- [ ] `cd packages/core && npm run dev` starts without DB errors
- [ ] `curl http://localhost:3000/health` returns JSON with `status: "ok"` (or `"degraded"` if Redis is down)
- [ ] `cd packages/router && npm run dev` starts without DB/Redis errors
- [ ] `curl http://localhost:3001/health` returns JSON with `status: "ok"` (or `"degraded"` if Redis is down)
- [ ] Mini-app loads at `http://localhost:5174` without JS errors
- [ ] Mini-app console shows "🏠 Local dev detected"
- [ ] Mini-app can fetch bot list (test with user_id in Telegram WebApp or mock)
- [ ] `/setup_miniapp` команда настраивает Menu Button успешно
- [ ] Menu Button отображается в Telegram (рядом с полем ввода)
- [ ] Нажатие на Menu Button открывает Mini App
- [ ] `/setup_webhook` команда настраивает webhook для основного бота
- [ ] `/check_webhook` показывает корректный статус webhook
- [ ] Mini App загружается без ошибки "Service temporarily unavailable"
- [ ] Повторное открытие Mini App работает быстро (< 1 сек)

## Testing Mini-App API Connectivity

Local testing (without Telegram):
```bash
# Test bot list endpoint
curl "http://localhost:3000/api/bots?user_id=123"

# Test get schema endpoint
curl "http://localhost:3000/api/bot/YOUR_BOT_ID/schema?user_id=123"

# Test update schema endpoint
curl -X POST "http://localhost:3000/api/bot/YOUR_BOT_ID/schema?user_id=123" \
  -H "Content-Type: application/json" \
  -d '{"version":1,"initialState":"start","states":{"start":{"message":"Hello"}}}'
```

Testing in Telegram:
1. Open bot in Telegram
2. Send `/start` command
3. Click "Open Mini App" button
4. Mini-app should load and fetch bot list automatically
5. Check browser console (Telegram Desktop) or use remote debugging (mobile)

## Сбор контактов клиентов

### Как добавить кнопку запроса телефона в схему
1. Добавьте отдельное состояние (например, `collect_contact`) с кнопкой типа `request_contact`.
2. В этом состоянии должна быть только одна кнопка `request_contact` (не смешивайте с обычными кнопками).
3. Укажите `nextState`, куда перейти после получения контакта.

Пример состояния:
```json
{
  "collect_contact": {
    "message": "Для записи нам нужен ваш номер телефона",
    "buttons": [
      { "type": "request_contact", "text": "📱 Поделиться номером", "nextState": "confirm_booking" }
    ]
  }
}
```

### Где посмотреть и экспортировать контакты
- В Mini App откройте бота и нажмите «Клиенты».
- На странице доступны фильтры, статистика и кнопка экспорта CSV.

### API примеры
```bash
# Список контактов (пагинация через cursor)
curl "http://localhost:3000/api/bot/<BOT_ID>/users?user_id=123&limit=50"

# Статистика контактов
curl "http://localhost:3000/api/bot/<BOT_ID>/users/stats?user_id=123"

# Экспорт CSV
curl -o contacts.csv "http://localhost:3000/api/bot/<BOT_ID>/users/export?user_id=123"
```

## Known Gotchas

1. **Port Conflicts**
   - Core uses port 3000, router uses 3001, mini-app uses 5174
   - Option: If 5174 is already in use, Vite will select another port (check the terminal output).
   - PostgreSQL uses 5433 (not default 5432 to avoid conflicts)
   - Redis uses 6379 (default)
   - If ports are in use, stop conflicting services or change ports in `.env`

2. **Environment Variables**
   - All services read from root `.env` file (not package-specific .env files)
   - `ENCRYPTION_KEY` must be at least 32 characters
   - Same `ENCRYPTION_KEY` must be used in both core and router
   - `TELEGRAM_BOT_TOKEN` format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

3. **Database Health Checks**
   - Docker containers need 10-15 seconds to become "healthy"
   - Don't start core/router until `docker-compose ps` shows "healthy"
   - If services start before DB is ready, they will retry up to 5 times with exponential backoff

4. **Redis Graceful Degradation**
   - If Redis fails, core and router will log warnings but continue running
   - Sessions will use memory instead of Redis
   - Status will show "degraded" instead of "ok"

5. **CORS Issues**
   - Core allows localhost origins by default
   - If mini-app shows CORS errors, check core logs for "🔍 CORS check" messages
   - Verify mini-app is running on port 5174 (configured in `file:packages/mini-app/vite.config.ts`)

6. **Telegram WebApp Context**
   - Mini-app requires Telegram WebApp context to get user_id
   - For local testing without Telegram, mock `window.Telegram.WebApp` or use curl commands
   - See `file:packages/mini-app/src/utils/api.ts` for user_id extraction logic

7. **Database Initialization Race Condition**
   - Core uses `ensureDatabasesInitialized` middleware to prevent race conditions
   - First API request may take 2-3 seconds while databases initialize
   - Subsequent requests will be fast

## Troubleshooting

Problem: `npm install` fails
- Solution: Check Node.js version (`node --version` should be >= 18.0.0)
- Solution: Clear npm cache: `npm cache clean --force`
- Solution: Delete `node_modules` and `package-lock.json`, then retry

Problem: Docker containers won't start
- Solution: Check Docker is running: `docker ps`
- Solution: Check port availability: `lsof -i :5433` (macOS/Linux) or `netstat -ano | findstr :5433` (Windows)
- Solution: Stop existing containers: `docker-compose down -v`
  - Option (Compose v2): `docker compose down -v`

Problem: `test-db` script fails with "connection refused"
- Solution: Wait 15 seconds after `docker-compose up -d`
- Solution: Check container health: `docker-compose ps`
- Solution: Check container logs: `docker-compose logs postgres` or `docker-compose logs redis`

Problem: Core starts but shows "PostgreSQL initialization failed"
- Solution: Verify `DATABASE_URL` in `.env` matches docker-compose settings
- Solution: Check PostgreSQL logs: `docker-compose logs postgres`
- Solution: Restart PostgreSQL: `docker-compose restart postgres`

Problem: Mini-app shows CORS errors
- Solution: Check core is running on port 3000
- Solution: Check mini-app console for API URL (should be `http://localhost:3000`)
- Solution: Check core logs for CORS messages
- Solution: Verify `VITE_API_URL_LOCAL=http://localhost:3000` in `file:packages/mini-app/.env.example`

Problem: Mini-app can't fetch bot list
- Solution: Check core health: `curl http://localhost:3000/health`
- Solution: Test API directly: `curl "http://localhost:3000/api/bots?user_id=123"`
- Solution: Check browser console for detailed error messages
- Solution: Verify mini-app is detecting localhost correctly (look for "🏠 Local dev detected" message)

Problem: "User ID not found" error in mini-app
- Solution: Mini-app requires Telegram WebApp context
- Solution: For local testing, use curl commands instead
- Solution: Or mock `window.Telegram.WebApp.initDataUnsafe.user.id` in browser console

## Quick Reference Commands

> **Option (Compose v2):** Replace `docker-compose ...` with `docker compose ...` if `docker-compose` is not available.

```bash
# Start everything
docker-compose up -d                    # Start databases
cd packages/core && npm run dev         # Terminal 1: Core
cd packages/router && npm run dev       # Terminal 2: Router
cd packages/mini-app && npm run dev     # Terminal 3: Mini-app

# Health checks
curl http://localhost:3000/health       # Core health
curl http://localhost:3001/health       # Router health
docker-compose ps                       # Database health

# Stop everything
docker-compose down                     # Stop databases (keeps data)
docker-compose down -v                  # Stop databases (removes data)
Ctrl+C in each terminal                 # Stop services

# Logs
docker-compose logs postgres            # PostgreSQL logs
docker-compose logs redis               # Redis logs
docker-compose logs -f                  # Follow all logs

# Database access
docker exec -it dialogue-constructor-postgres psql -U postgres -d dialogue_constructor
docker exec -it dialogue-constructor-redis redis-cli
```

## Настройка Mini App Menu Button

Есть два способа настроить кнопку меню (Menu Button), которая открывает Mini App:
- Ручной: через @BotFather
- Программный: через команду `/setup_miniapp` (Telegram Bot API)

### Вариант 1: вручную через @BotFather

1. Открыть чат с @BotFather
2. Отправить команду `/setmenubutton`
3. Выбрать бота из списка
4. Выбрать "Edit menu button"
5. Выбрать "Web App"
6. Ввести текст кнопки (например, "Open Mini App")
7. Ввести URL Mini App (из переменной `MINI_APP_URL` в `.env`, по умолчанию `https://lego-bot-miniapp.vercel.app`)

### Вариант 2: программно через `/setup_miniapp`

1. Убедиться, что `MINI_APP_URL` установлен в `.env` (или будет использован `DEFAULT_MINI_APP_URL`)
2. Отправить команду `/setup_miniapp` боту
3. Если настроен `ADMIN_USER_IDS`, команда доступна только администраторам для глобальной настройки
4. Если `ADMIN_USER_IDS` не настроен, команда применяется только для текущего чата

Проверка настройки:
- Открыть бота в Telegram
- Нажать на иконку меню рядом с полем ввода
- Должна появиться кнопка "Open Mini App"

Примечание о переменных окружения:
- `MINI_APP_URL` (приоритет)
- `DEFAULT_MINI_APP_URL` (fallback)
- hardcoded URL (последний fallback)

## Команды администратора

### Команда `/setup_miniapp`

- Назначение: программная настройка Menu Button для Mini App через Telegram Bot API
- Использование:
  - Если `ADMIN_USER_IDS` настроен (не пустой):
    - `/setup_miniapp` (без аргументов) настраивает глобальный Menu Button (default scope)
    - `/setup_miniapp <chat_id>` настраивает Menu Button для конкретного чата (удобно для тестирования)
  - Если `ADMIN_USER_IDS` не настроен / пустой:
    - `/setup_miniapp` настраивает Menu Button только для текущего чата (safe default)
    - Глобальная настройка требует `ADMIN_USER_IDS`
- Требования:
  - `TELEGRAM_BOT_TOKEN` должен быть установлен
  - `MINI_APP_URL` рекомендуется установить (иначе используется fallback)
  - `ADMIN_USER_IDS` (опционально) - список Telegram user IDs через запятую для доступа к глобальной настройке
- Примечание: глобальная настройка Menu Button влияет на всех пользователей, поэтому при включенном allowlist (`ADMIN_USER_IDS`) она ограничена.
- Пример вывода успешной настройки:
  ```
  ✅ Menu Button настроен!

  🔗 URL: https://lego-bot-miniapp.vercel.app

  Теперь пользователи могут открыть Mini App через кнопку меню рядом с полем ввода.
  ```
- Пример вывода с предупреждениями (если `MINI_APP_URL` не установлен):
  ```
  ✅ Menu Button настроен!

  🔗 URL: https://lego-bot-miniapp.vercel.app

  Теперь пользователи могут открыть Mini App через кнопку меню рядом с полем ввода.

  ⚠️ MINI_APP_URL не установлен, используется URL по умолчанию.
  Рекомендуется установить MINI_APP_URL в переменных окружения.
  ```

### Команда `/setup_webhook`

- Назначение: настройка webhook для основного бота (не для созданных пользователями ботов)
- Использование: `/setup_webhook` (без параметров)
- Требования:
  - `TELEGRAM_BOT_TOKEN` должен быть установлен
  - `API_URL` должен быть установлен (по умолчанию `https://lego-bot-core.vercel.app`)
  - `TELEGRAM_SECRET_TOKEN` рекомендуется установить для безопасности
  - `ADMIN_USER_IDS` (опционально) - ограничивает доступ к команде
- Webhook URL формат: `{API_URL}/api/webhook`
- Пример вывода успешной настройки:
  ```
  ✅ Webhook для основного бота настроен!

  🔗 URL: https://lego-bot-core.vercel.app/api/webhook
  🔐 Secret Token: ✅ Установлен

  Теперь бот будет работать на Vercel.
  ```
- Примечание: после настройки webhook, long polling автоматически отключается

### Команда `/check_webhook`

- Назначение: проверка статуса webhook основного бота
- Использование: `/check_webhook` (без параметров)
- Требования: те же, что и для `/setup_webhook`
- Информация в выводе:
  - Статус webhook (настроен/не настроен)
  - URL webhook
  - Количество ожидающих обновлений
  - IP адрес (если доступен)
  - Максимальное количество соединений
  - Разрешенные типы обновлений
  - Последняя ошибка (если есть) с датой и сообщением
- Пример вывода для настроенного webhook:
  ```
  📡 Статус Webhook

  ✅ Webhook настроен

  🔗 URL: https://lego-bot-core.vercel.app/api/webhook
  📊 Ожидающих обновлений: 0
  ```
- Пример вывода для ненастроенного webhook:
  ```
  📡 Статус Webhook

  ❌ Webhook не настроен

  Используйте команду /setup_webhook для настройки.
  ```

## Troubleshooting: Service Temporarily Unavailable

**Описание проблемы:**
- Ошибка "Service temporarily unavailable" при открытии Mini App через Menu Button с телефона
- Сначала определить, что именно не грузится: Mini App HTML (страница/статические файлы) или API-вызовы внутри Mini App.
- Обычно связана с проблемами инициализации базы данных на Vercel serverless

**Причины и решения:**

**Причина 1: Cold Start на Vercel**
- Описание: Vercel serverless функции "засыпают" после периода неактивности, первый запрос после пробуждения может занять 2-5 секунд
- Решение: 
  - Это нормальное поведение, повторная попытка через 3-5 секунд должна сработать
  - Проверьте актуальные лимиты/поведение cold starts в вашем плане Vercel; при необходимости настройте maxDuration и/или перейдите на платный план (опции могут отличаться по планам).
  - Или настроить периодический ping (каждые 5 минут) для поддержания функций в активном состоянии

**Причина 2: Проблемы с подключением к PostgreSQL**
- Описание: Vercel serverless имеет ограничения на количество соединений (по умолчанию max 3 в коде)
- Решение:
  - Проверить логи Vercel: `vercel logs <deployment-url>` (требуется установленный Vercel CLI и выполненный `vercel login`; альтернатива — смотреть логи в Vercel Dashboard проекта)
  - Искать сообщения "PostgreSQL connection failed after X attempts"
  - Убедиться, что `DATABASE_URL` правильно установлен в Vercel Environment Variables
  - Рассмотреть использование connection pooling (возможные варианты, зависят от провайдера):
    - Supabase (встроенный pooling)
    - Neon (serverless-friendly PostgreSQL)
    - PgBouncer (возможный вариант; поддержка и формат параметров зависят от провайдера/строки подключения; иногда используют `?pgbouncer=true`, иногда — отдельный pooler URL/порт)
  - Проверить лимиты подключений на стороне PostgreSQL провайдера

**Причина 3: Timeout при инициализации**
- Описание: Vercel serverless функции имеют timeout (10 секунд для Hobby, 60 секунд для Pro)
- Решение:
  - Проверить логи на сообщения "Webhook processing timed out"
  - Текущая реализация использует retry логику с exponential backoff (3 попытки для Vercel, 5 для локального)
  - Если проблема сохраняется, увеличить `connectionTimeoutMillis` в `file:packages/core/src/db/postgres.ts` (текущее значение 2000ms для Vercel)

**Причина 4: Webhook не настроен или настроен неправильно**
- Описание: Telegram не может доставить обновления боту
- Решение:
  - Отправить команду `/check_webhook` боту для проверки статуса
  - Если webhook не настроен, отправить `/setup_webhook`
  - Проверить, что `API_URL` в `.env` соответствует реальному URL Vercel deployment
  - Проверить, что `TELEGRAM_SECRET_TOKEN` совпадает между `.env` и настройкой webhook

**Причина 5: Menu Button не настроен**
- Описание: Кнопка меню не открывает Mini App или открывает неправильный URL
- Решение:
  - Отправить команду `/setup_miniapp` боту
  - Или настроить вручную через @BotFather (см. секцию "Настройка Mini App Menu Button")
  - Проверить, что `MINI_APP_URL` в `.env` соответствует реальному URL Vercel deployment Mini App

**Причина 6: CORS ошибки**
- Описание: Mini App не может обращаться к Core API из-за CORS политики
- Решение:
  - Проверить браузерную консоль (Telegram Desktop) или remote debugging (mobile)
  - Убедиться, что Core API (`file:packages/core/src/index.ts`) настроен на разрешение запросов от Mini App URL
  - Текущая реализация разрешает localhost для локальной разработки, для production нужно добавить production URL

**Диагностические команды:**

_Примечание:_ команды `vercel logs ...` работают только при установленном Vercel CLI и выполненном входе (`vercel login`). Если CLI не установлен, смотрите логи через Vercel Dashboard.

```bash
# Проверить логи Vercel Core API
vercel logs https://lego-bot-core.vercel.app

# Проверить логи Vercel Mini App
vercel logs https://lego-bot-miniapp.vercel.app

# Проверить статус webhook
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Проверить health endpoint Core API
curl https://lego-bot-core.vercel.app/health

# Проверить доступность Mini App
curl https://lego-bot-miniapp.vercel.app
```

## End-to-End: Открытие Mini App с телефона

_Примечание:_ диаграмма ниже упрощённая (концептуальная) и предназначена для понимания потока; реальные внутренние шаги Telegram могут отличаться.

```mermaid
sequenceDiagram
    participant User as 👤 Пользователь (Телефон)
    participant TG as 📱 Telegram App
    participant Bot as 🤖 Telegram Bot API
    participant Core as 🖥️ Core API (Vercel)
    participant MiniApp as 🌐 Mini App (Vercel)
    participant PG as 🗄️ PostgreSQL
    participant Redis as 💾 Redis

    Note over User,Redis: Сценарий 1: Первое открытие (Cold Start)
    
    User->>TG: Открывает бота, нажимает Menu Button
    TG->>Bot: Запрос информации о Menu Button
    Bot-->>TG: Возвращает web_app URL (MINI_APP_URL)
    TG->>MiniApp: GET / (загрузка Mini App)
    MiniApp-->>TG: HTML + JS + CSS
    TG->>User: Отображает Mini App в WebView
    
    Note over MiniApp,Redis: Mini App инициализация
    MiniApp->>MiniApp: Извлекает user_id из Telegram WebApp SDK
    MiniApp->>Core: GET /api/bots?user_id=X
    
    Note over Core,Redis: Cold Start: инициализация (2-5 сек)
    Core->>PG: Инициализация pool (retry 3x)
    PG-->>Core: ✅ Connected
    Core->>Redis: Инициализация (retry 3x, optional)
    Redis-->>Core: ✅ Connected (или degraded)
    
    Core->>PG: SELECT * FROM bots WHERE user_id=X
    PG-->>Core: Список ботов
    Core-->>MiniApp: 200 OK [bot list]
    MiniApp->>User: Отображает список ботов
    
    Note over User,Redis: Сценарий 2: Повторное открытие (Warm)
    
    User->>TG: Открывает бота, нажимает Menu Button
    TG->>MiniApp: GET / (загрузка Mini App)
    MiniApp-->>TG: HTML + JS + CSS (cached)
    MiniApp->>Core: GET /api/bots?user_id=X
    
    Note over Core: Pool уже инициализирован (< 100ms)
    Core->>PG: SELECT * FROM bots WHERE user_id=X
    PG-->>Core: Список ботов
    Core-->>MiniApp: 200 OK [bot list]
    MiniApp->>User: Отображает список ботов
    
    Note over User,Redis: Сценарий 3: Ошибка (Service Unavailable)
    
    User->>TG: Открывает бота, нажимает Menu Button
    TG->>MiniApp: GET / (загрузка Mini App)
    MiniApp->>Core: GET /api/bots?user_id=X
    
    Core->>PG: Инициализация pool (retry 3x)
    PG--xCore: ❌ Connection timeout
    Core-->>MiniApp: 503 Service Temporarily Unavailable
    MiniApp->>User: Показывает ошибку
    
    Note over User: Решение: подождать 3-5 сек и повторить
```

**Описание диаграммы:**
- Сценарий 1 показывает первое открытие Mini App с cold start (2-5 секунд инициализации)
- Сценарий 2 показывает повторное открытие с уже инициализированным pool (< 100ms)
- Сценарий 3 показывает ошибку "Service temporarily unavailable" и рекомендацию повторить через 3-5 секунд

## Production Deployment на Vercel

**Содержание:**
- Требования для production deployment:
  - Vercel аккаунт (Hobby или Pro)
  - PostgreSQL база данных (рекомендуется Supabase или Neon для serverless)
  - Redis база данных (рекомендуется Upstash для serverless)
  - Два Vercel проекта: один для Core API, один для Mini App

**Шаги деплоя Core API:**
1. Создать новый проект на Vercel
2. Подключить GitHub репозиторий
3. Настроить Root Directory: `packages/core`
4. Настроить Build Command: `cd ../.. && npm install && npm run build`
5. Настроить Output Directory: `dist`
6. Добавить Environment Variables (все из `.env`)
7. Deploy
8. Скопировать URL deployment (например, `https://lego-bot-core.vercel.app`)
9. Отправить команду `/setup_webhook` боту для настройки webhook

**Шаги деплоя Mini App:**
1. Создать новый проект на Vercel
2. Подключить GitHub репозиторий
3. Настроить Root Directory: `packages/mini-app`
4. Настроить Build Command: `npm install && npm run build`
5. Настроить Output Directory: `dist`
6. Добавить Environment Variable: `VITE_API_URL=https://lego-bot-core.vercel.app`
7. Deploy
8. Скопировать URL deployment (например, `https://lego-bot-miniapp.vercel.app`)
9. Обновить `MINI_APP_URL` в Core API Environment Variables
10. Отправить команду `/setup_miniapp` боту для настройки Menu Button

**Проверка deployment:**
```bash
# Проверить Core API health
curl https://lego-bot-core.vercel.app/health

# Проверить Mini App доступность
curl https://lego-bot-miniapp.vercel.app

# Проверить webhook статус
# Отправить /check_webhook боту в Telegram
```

**Важные замечания:**
- После каждого deployment Vercel, webhook может потребовать повторной настройки (если URL изменился)
- Проверьте актуальные лимиты max duration/bandwidth в вашем плане Vercel; при необходимости увеличьте maxDuration и/или перейдите на платный план (лимиты и формулировки могут меняться).
- PostgreSQL и Redis должны быть доступны из Vercel (проверить firewall правила)

## One-command dev (optional)

This repo includes a root `npm run dev` script (Turbo) that starts core/router/mini-app together:

```bash
npm run dev
```

Notes:
- Uses Turbo (`turbo run dev`) to run workspace `dev` scripts in parallel.
- Starts the `dev` scripts for `packages/core`, `packages/router`, and `packages/mini-app`.
- Logs will appear interleaved in the same terminal output.
- Turbo prefixes output with the package/task name (for example: `core:dev`, `router:dev`, `mini-app:dev`) to help identify which service produced a log line.

## Verification Workflow Diagram

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Docker as Docker Compose
    participant PG as PostgreSQL
    participant Redis as Redis
    participant Core as Core Service
    participant Router as Router Service
    participant MiniApp as Mini-App

    Dev->>Docker: docker-compose up -d
    Docker->>PG: Start container
    Docker->>Redis: Start container
    PG-->>Docker: Health check (10-15s)
    Redis-->>Docker: Health check (10-15s)
    
    Dev->>Core: npm run test-db
    Core->>PG: Test connection
    Core->>Redis: Test connection
    PG-->>Core: ✅ Connected
    Redis-->>Core: ✅ Connected
    
    Dev->>Core: npm run dev
    Core->>PG: Initialize with retry
    Core->>Redis: Initialize with retry
    PG-->>Core: ✅ Ready
    Redis-->>Core: ✅ Ready
    Core-->>Dev: Listening on :3000
    
    Dev->>Router: npm run dev
    Router->>PG: Initialize with retry
    Router->>Redis: Initialize with retry
    PG-->>Router: ✅ Ready
    Redis-->>Router: ✅ Ready
    Router-->>Dev: Listening on :3001
    
    Dev->>MiniApp: npm run dev
    MiniApp-->>Dev: Vite server on :5174
    
    Dev->>MiniApp: Open localhost:5174
    MiniApp->>Core: GET /api/bots?user_id=X
    Core-->>MiniApp: 200 OK [bot list]
```

## Stage 1 Stabilization - Acceptance Criteria

- [ ] `npm install` at repo root succeeds
- [ ] `docker-compose up -d` brings up Postgres+Redis
- [ ] `cd packages/core && npm run test-db` passes
- [ ] `cd packages/core && npm run dev` starts without DB errors
- [ ] `cd packages/router && npm run dev` starts without DB/Redis errors
- [ ] Mini-app runs locally and can hit core API successfully (no CORS errors)
- [ ] When pointing mini-app to deployed core API, requests succeed (CORS + base URL ok)
- [ ] Documentation updated so new dev can launch in <10 minutes

## Health Check Commands
```bash
# All should return status "ok" or "degraded" (if Redis is down)
curl http://localhost:3000/health
curl http://localhost:3001/health
docker-compose ps  # Both should show "healthy"
```
