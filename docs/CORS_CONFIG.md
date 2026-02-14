# CORS и Security Headers Configuration

## Обзор

Настроена production-ready конфигурация CORS и security headers для Telegram Mini App с правильным allow-list и защитой internal endpoints.

## Environment Variables

### Обязательные для Railway

```bash
# CORS_ORIGINS - CSV список разрешенных origins (без пробелов после запятых)
CORS_ORIGINS=https://miniapp-production-aa17.up.railway.app,https://web.telegram.org

# Опционально: отключить credentials (по умолчанию true)
CORS_ALLOW_CREDENTIALS=true
```

### Legacy переменные (для обратной совместимости)

Если `CORS_ORIGINS` не установлен, используются:
- `FRONTEND_URL` (default: `http://localhost:5173`)
- `MINI_APP_URL` (default: `https://lego-bot-miniapp.vercel.app`)
- `OWNER_WEB_BASE_URL` (default: `http://localhost:5175`)

### Автоматически добавляемые origins

**В production:**
- Origins из `CORS_ORIGINS`
- `https://web.telegram.org`
- `https://*.telegram.org` (wildcard pattern)

**В dev/staging (`NODE_ENV !== 'production'`):**
- Все production origins
- `http://localhost:3000`
- `http://localhost:5173`
- `http://localhost:5174`
- `http://127.0.0.1:5174`
- `http://localhost:5175`
- Любые origins содержащие `localhost` или `127.0.0.1`

## CORS Configuration

### Allow-list подход

- **НЕ используется `*`** вместе с `credentials: true`
- Только origins из allow-list получают CORS headers
- Запросы без `Origin` (non-browser) не получают CORS headers

### Preflight (OPTIONS)

- Обрабатывается для всех маршрутов через `app.options('*', ...)`
- Возвращает `204 No Content` с правильными CORS headers
- Логируется с `action: 'cors_preflight'`

### Allowed Headers

```
Content-Type
Authorization
X-Requested-With
x-telegram-init-data
X-Telegram-Init-Data
x-health-token
x-internal-secret (только для internal endpoints, но они блокируются по path)
```

### Credentials

- По умолчанию: `credentials: true`
- Можно отключить через `CORS_ALLOW_CREDENTIALS=false`
- На фронте должен быть `credentials: 'include'` в fetch

## Internal Endpoints Protection

Маршруты `/api/internal/*`:
- **Блокируются CORS** (не получают CORS headers)
- Доступны только через `x-internal-secret` header
- Логируются с `action: 'cors_blocked_internal'`

## Security Headers (Frame Embedding)

### Content-Security-Policy

Для не-API маршрутов (если core служит HTML):
```
Content-Security-Policy: frame-ancestors 'self' https://web.telegram.org https://*.telegram.org
```

Это позволяет встраивание в:
- `https://web.telegram.org`
- `https://*.telegram.org` (любые поддомены Telegram)

### X-Frame-Options

- **НЕ устанавливается** (конфликтует с CSP `frame-ancestors`)
- Для API маршрутов не нужен (возвращают JSON)

## Observability

### Логирование CORS

Все CORS события логируются с structured logging:

**Разрешенные запросы:**
```json
{
  "action": "cors_allowed",
  "origin": "https://miniapp-production-aa17.up.railway.app"
}
```

**Отклоненные запросы:**
```json
{
  "action": "cors_denied",
  "origin": "https://malicious-site.com"
}
```

**Preflight запросы:**
```json
{
  "action": "cors_preflight",
  "requestId": "abc-123",
  "method": "OPTIONS",
  "path": "/api/bots",
  "origin": "https://miniapp-production-aa17.up.railway.app",
  "allowed": true,
  "acrm": "POST",
  "acrh": "content-type,x-telegram-init-data"
}
```

**Internal endpoints:**
```json
{
  "action": "cors_blocked_internal",
  "requestId": "abc-123",
  "path": "/api/internal/process-broadcast",
  "origin": "https://miniapp-production-aa17.up.railway.app",
  "method": "POST"
}
```

## DevTools Checklist

### 1. Проверка OPTIONS preflight

1. Открой DevTools → Network
2. Найдите OPTIONS запрос к `/api/bots`
3. Проверьте Response Headers:
   - ✅ `Access-Control-Allow-Origin: https://miniapp-production-aa17.up.railway.app` (конкретный origin, не `*`)
   - ✅ `Access-Control-Allow-Credentials: true`
   - ✅ `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`
   - ✅ `Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With,x-telegram-init-data,X-Telegram-Init-Data,x-health-token,x-internal-secret`
   - ✅ `Vary: Origin`
   - ✅ Status: `204 No Content`

### 2. Проверка основного запроса

1. После OPTIONS найдите GET/POST запрос к `/api/bots`
2. Проверьте Response Headers:
   - ✅ `Access-Control-Allow-Origin: https://miniapp-production-aa17.up.railway.app`
   - ✅ `Access-Control-Allow-Credentials: true`
   - ✅ Нет ошибок CORS в Console

### 3. Проверка frame embedding

1. Открой Mini App в Telegram
2. Проверьте Console:
   - ✅ Нет ошибок `X-Frame-Options: SAMEORIGIN`
   - ✅ Нет ошибок `frame-ancestors`
   - ✅ Mini App загружается корректно

### 4. Проверка internal endpoints

1. Попробуйте сделать запрос к `/api/internal/process-broadcast` с origin из Mini App
2. Проверьте:
   - ✅ Нет CORS headers в ответе
   - ✅ Запрос отклоняется (401/403) если нет `x-internal-secret`
   - ✅ В логах: `action: 'cors_blocked_internal'`

## Troubleshooting

### "Origin ... is not allowed"

1. Проверьте `CORS_ORIGINS` в Railway env vars
2. Убедитесь, что origin точно совпадает (без trailing slash)
3. Проверьте логи: `action: 'cors_denied'`

### "Cannot GET //api/bots"

Это проблема на стороне Mini App, не CORS. Проверьте формирование URL в `packages/mini-app/src/utils/api.ts`.

### "Refused to display in a frame"

1. Проверьте, что Mini App открывается через Telegram (не напрямую в браузере)
2. Проверьте Response Headers: должен быть `Content-Security-Policy: frame-ancestors ...`
3. Убедитесь, что нет `X-Frame-Options: SAMEORIGIN` (конфликтует с CSP)

### OPTIONS возвращает 404

1. Проверьте, что `app.options('*', ...)` зарегистрирован
2. Проверьте логи: должно быть `✅ OPTIONS preflight - allowed`

## Примеры

### Railway Production

```bash
CORS_ORIGINS=https://miniapp-production-aa17.up.railway.app,https://web.telegram.org
CORS_ALLOW_CREDENTIALS=true
NODE_ENV=production
```

### Local Development

```bash
# CORS_ORIGINS не нужен - автоматически разрешаются localhost origins
NODE_ENV=development
```

## Безопасность

- ✅ Allow-list только (нет `*`)
- ✅ Internal endpoints защищены от CORS
- ✅ Credentials только для разрешенных origins
- ✅ Structured logging для аудита
- ✅ Vary: Origin для правильного кеширования

