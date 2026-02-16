# Owner Auth Environment Variables

Документация по переменным окружения для Owner Auth (owner-web + core).

## Проблема: "Owner auth is not configured"

Это сообщение появляется, когда не настроены необходимые переменные окружения для Owner Auth.

---

## Переменные для сервиса `owner-web`

### Обязательные:

- **`CORE_API_ORIGIN`** (server-side)
  - Описание: URL сервиса `core` для проксирования запросов
  - Пример: `https://core-production-xxxx.up.railway.app`
  - Где используется: `packages/owner-web/src/app/api/core/[...path]/route.ts`
  - Ошибка: `CORE_API_ORIGIN is not set` → 500 в proxy route

### Для клиентской части (NEXT_PUBLIC_*):

- **`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`** (client-side)
  - Описание: Username Telegram бота для Login Widget
  - Пример: `my_bot`
  - Где используется: `packages/owner-web/src/app/login/page.tsx` (Telegram Login Widget)
  - Важно: Должен начинаться с `NEXT_PUBLIC_` для доступа в браузере
  - После изменения: требуется **rebuild** Next.js (`pnpm build`)

---

## Переменные для сервиса `core`

### Обязательные для Owner Auth:

- **`JWT_SECRET`** (server-side)
  - Описание: Секретный ключ для подписи JWT токенов сессий
  - Пример: `your-super-secret-jwt-key-min-32-chars`
  - Где используется: `packages/core/src/index.ts` → `getOwnerJwtSecret()`
  - Ошибка: `Owner auth is not configured: missing JWT_SECRET` → 500 в `/api/owner/auth/telegram` и `/api/owner/auth/botlink`

- **`TELEGRAM_BOT_TOKEN`** (server-side)
  - Описание: Токен Telegram бота для верификации Telegram Login Widget
  - Пример: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
  - Где используется: `packages/core/src/index.ts` → `getTelegramBotToken()` (из shared)
  - Ошибка: `Owner auth is not configured: missing TELEGRAM_BOT_TOKEN` → 500 в `/api/owner/auth/telegram`

### Опциональные (fallback):

- **`OWNER_BOTLINK_SECRET`** (server-side)
  - Описание: Секретный ключ для botlink токенов (альтернатива JWT_SECRET)
  - Пример: `your-botlink-secret-key`
  - Где используется: `packages/core/src/index.ts` → `getOwnerBotlinkSecret()`
  - Fallback: Если не установлен, используется `JWT_SECRET` или `ENCRYPTION_KEY`
  - Ошибка: `Owner auth is not configured: missing OWNER_BOTLINK_SECRET (or JWT_SECRET, or ENCRYPTION_KEY as fallback)` → 500 в `/api/owner/auth/botlink`

- **`ENCRYPTION_KEY`** (server-side)
  - Описание: Ключ шифрования (используется как fallback для botlink secret)
  - Пример: `your-encryption-key-32-chars`
  - Где используется: Fallback в `getOwnerBotlinkSecret()` если нет `OWNER_BOTLINK_SECRET` и `JWT_SECRET`

### Дополнительные (для полной функциональности):

- **`REDIS_URL`** (server-side)
  - Описание: URL Redis для botlink token deduplication
  - Пример: `redis://localhost:6379` или `rediss://xxx.upstash.io:6379`
  - Где используется: `packages/core/src/index.ts` → `/api/owner/auth/botlink` (проверка использованных токенов)
  - Ошибка: `Redis is required for botlink auth` → 500 в `/api/owner/auth/botlink` (если Redis недоступен)

---

## Полный путь выполнения

### 1. Owner-web → Proxy → Core

```
Owner-web (client)
  ↓
GET /api/core/api/owner/auth/me
  ↓
packages/owner-web/src/app/api/core/[...path]/route.ts
  ↓ (проверка CORE_API_ORIGIN)
  ↓ (fetch к core)
Core API
  ↓
GET /api/owner/auth/me
  ↓
requireOwnerAuth middleware
  ↓ (проверка JWT сессии)
  ↓
Response
```

### 2. Owner-web → Telegram Login → Core

```
Owner-web (client)
  ↓
Telegram Login Widget (data-telegram-login="NEXT_PUBLIC_TELEGRAM_BOT_USERNAME")
  ↓
onTelegramAuth(payload)
  ↓
POST /api/core/api/owner/auth/telegram
  ↓
packages/owner-web/src/app/api/core/[...path]/route.ts
  ↓ (проверка CORE_API_ORIGIN)
  ↓ (fetch к core)
Core API
  ↓
POST /api/owner/auth/telegram
  ↓
getTelegramBotToken() → проверка TELEGRAM_BOT_TOKEN
getOwnerJwtSecret() → проверка JWT_SECRET
  ↓ (если отсутствуют → "Owner auth is not configured: missing ...")
  ↓
verifyTelegramLoginPayload() → верификация через TELEGRAM_BOT_TOKEN
  ↓
Response (Set-Cookie: owner_session=...)
```

### 3. Owner-web → Botlink → Core

```
Telegram Bot
  ↓
/cabinet command
  ↓
createOwnerBotlinkToken() → использует OWNER_BOTLINK_SECRET (или JWT_SECRET/ENCRYPTION_KEY)
  ↓
Redirect to owner-web /auth/bot?token=...
  ↓
POST /api/core/api/owner/auth/botlink
  ↓
packages/owner-web/src/app/api/core/[...path]/route.ts
  ↓ (проверка CORE_API_ORIGIN)
  ↓ (fetch к core)
Core API
  ↓
POST /api/owner/auth/botlink
  ↓
getOwnerJwtSecret() → проверка JWT_SECRET
getOwnerBotlinkSecret() → проверка OWNER_BOTLINK_SECRET (или fallback)
  ↓ (если отсутствуют → "Owner auth is not configured: missing ...")
  ↓
verifyOwnerBotlinkToken() → верификация токена
  ↓ (проверка Redis для deduplication)
  ↓
Response (Set-Cookie: owner_session=...)
```

---

## Диагностика ошибок

### Ошибка: "CORE_API_ORIGIN is not set"

**Причина:** В сервисе `owner-web` не установлена переменная `CORE_API_ORIGIN`.

**Решение:**
1. Railway → Service "owner-web" → Variables
2. Добавить: `CORE_API_ORIGIN` = `https://core-production-xxxx.up.railway.app` (URL вашего core сервиса)
3. Перезапустить сервис

**Проверка:**
```bash
curl https://your-owner-web.up.railway.app/api/_debug/env
# Должно показать: "CORE_API_ORIGIN": { "set": true, ... }
```

---

### Ошибка: "Owner auth is not configured: missing JWT_SECRET"

**Причина:** В сервисе `core` не установлена переменная `JWT_SECRET`.

**Решение:**
1. Railway → Service "core" → Variables
2. Добавить: `JWT_SECRET` = `your-super-secret-jwt-key-min-32-chars` (сгенерировать случайную строку)
3. Перезапустить сервис

**Генерация секрета:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Ошибка: "Owner auth is not configured: missing TELEGRAM_BOT_TOKEN"

**Причина:** В сервисе `core` не установлена переменная `TELEGRAM_BOT_TOKEN`.

**Решение:**
1. Получить токен от [@BotFather](https://t.me/botfather) в Telegram
2. Railway → Service "core" → Variables
3. Добавить: `TELEGRAM_BOT_TOKEN` = `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
4. Перезапустить сервис

---

### Ошибка: "Owner auth is not configured: missing OWNER_BOTLINK_SECRET (or JWT_SECRET, or ENCRYPTION_KEY as fallback)"

**Причина:** В сервисе `core` отсутствуют все три переменные: `OWNER_BOTLINK_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY`.

**Решение:**
Установить хотя бы одну из:
- `JWT_SECRET` (рекомендуется)
- `OWNER_BOTLINK_SECRET`
- `ENCRYPTION_KEY` (fallback)

---

### Ошибка: "Telegram Login Widget не отображается"

**Причина:** В сервисе `owner-web` не установлена переменная `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` или не выполнен rebuild.

**Решение:**
1. Railway → Service "owner-web" → Variables
2. Добавить: `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` = `my_bot` (username вашего бота без @)
3. **Важно:** Выполнить rebuild (`pnpm build`) или перезапустить деплой

**Проверка:**
```bash
# В браузере (DevTools → Console)
console.log(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME)
# Должно показать: "my_bot"
```

---

## Debug Endpoints

### Owner-web: `/api/_debug/env`

**Доступно только в:** dev/staging (не в production)

**Использование:**
```bash
curl https://your-owner-web.up.railway.app/api/_debug/env
```

**Ответ:**
```json
{
  "ok": true,
  "env": {
    "CORE_API_ORIGIN": {
      "set": true,
      "length": 45,
      "startsWith": "https://co"
    },
    "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME": {
      "set": true,
      "length": 7
    },
    "NODE_ENV": "production",
    "timestamp": 1234567890,
    "service": "owner-web"
  },
  "note": "Secrets are never exposed. Only boolean/length info is shown."
}
```

---

## Чек-лист настройки

### Для сервиса `owner-web`:

- [ ] `CORE_API_ORIGIN` установлен (URL core сервиса)
- [ ] `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` установлен (username бота без @)
- [ ] После изменения `NEXT_PUBLIC_*` выполнен rebuild
- [ ] `/api/_debug/env` возвращает `CORE_API_ORIGIN.set: true`

### Для сервиса `core`:

- [ ] `JWT_SECRET` установлен (минимум 32 символа)
- [ ] `TELEGRAM_BOT_TOKEN` установлен (от @BotFather)
- [ ] `REDIS_URL` установлен (для botlink auth, опционально)
- [ ] `/api/owner/auth/me` возвращает 401 (не 500 с "misconfigured")

---

## Важные замечания

1. **NEXT_PUBLIC_* переменные** встраиваются в клиентский код при сборке. После изменения требуется **rebuild**.

2. **Server-side переменные** (`CORE_API_ORIGIN`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`) доступны только на сервере и не попадают в клиентский код.

3. **Secrets никогда не должны быть в NEXT_PUBLIC_*** - только публичные значения (например, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`).

4. **Все переменные должны быть установлены в Railway Variables** для каждого сервиса отдельно.

5. **После изменения переменных** требуется перезапуск сервиса (Railway делает это автоматически при деплое).

