# Owner-Web Environment Variables Checklist

## Обязательные переменные для owner-web на Railway

### 1. `CORE_API_ORIGIN` (server-side)
- **Описание:** URL сервиса `core` для проксирования всех API запросов
- **Пример:** `https://core-production-xxxx.up.railway.app`
- **Где установить:** Railway → Service "owner-web" → Variables
- **Важно:** 
  - Должен быть полный URL с `https://`
  - Без trailing slash (`/`)
  - Это server-side переменная, не попадает в клиентский код

### 2. `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (client-side)
- **Описание:** Username Telegram бота для Login Widget (без символа `@`)
- **Пример:** `my_bot`
- **Где установить:** Railway → Service "owner-web" → Variables
- **Важно:**
  - Должен начинаться с `NEXT_PUBLIC_` для доступа в браузере
  - После изменения требуется **rebuild** (`pnpm build`)
  - Используется в `packages/owner-web/src/app/login/page.tsx`

---

## Проверка переменных

### 1. Проверка через Railway UI
1. Откройте Railway → Service "owner-web"
2. Перейдите в раздел "Variables"
3. Убедитесь, что установлены:
   - ✅ `CORE_API_ORIGIN` = `https://core-production-xxxx.up.railway.app`
   - ✅ `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` = `your_bot_username`

### 2. Проверка через Debug Endpoint (dev/staging only)
```bash
curl https://owner-web-production-xxxx.up.railway.app/api/debug/env
```

**Ожидаемый ответ:**
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
    }
  }
}
```

### 3. Проверка в браузере (Console)
```javascript
// В DevTools → Console
console.log(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME)
// Должно показать: "your_bot_username"
```

---

## Ошибки и решения

### Ошибка: "Application error: a client-side exception has occurred"
**Возможные причины:**
1. Отсутствует `CORE_API_ORIGIN` → все API запросы падают с 500
2. Отсутствует `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` → Login Widget не работает
3. `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` изменен, но не выполнен rebuild

**Решение:**
1. Проверьте Railway Variables для `owner-web`
2. Убедитесь, что `CORE_API_ORIGIN` указывает на правильный URL core
3. Убедитесь, что `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` установлен
4. Если изменили `NEXT_PUBLIC_*`, выполните rebuild или перезапустите деплой

### Ошибка: "CORE_API_ORIGIN is not set"
**Причина:** В сервисе `owner-web` не установлена переменная `CORE_API_ORIGIN`

**Решение:**
1. Railway → Service "owner-web" → Variables
2. Добавить: `CORE_API_ORIGIN` = `https://core-production-xxxx.up.railway.app`
3. Перезапустить сервис

### Ошибка: "Telegram Login Widget не отображается"
**Причина:** Отсутствует `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` или не выполнен rebuild

**Решение:**
1. Railway → Service "owner-web" → Variables
2. Добавить: `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` = `your_bot_username` (без @)
3. **Важно:** Выполнить rebuild или перезапустить деплой

---

## Чек-лист настройки

### Для сервиса `owner-web`:
- [ ] `CORE_API_ORIGIN` установлен (URL core сервиса)
- [ ] `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` установлен (username бота без @)
- [ ] После изменения `NEXT_PUBLIC_*` выполнен rebuild
- [ ] Сервис перезапущен после изменения переменных

### Для сервиса `core` (зависимость):
- [ ] `JWT_SECRET` установлен (минимум 32 символа)
- [ ] `TELEGRAM_BOT_TOKEN` установлен (от @BotFather)
- [ ] `DATABASE_URL` установлен
- [ ] `ENCRYPTION_KEY` установлен (минимум 32 символа)

---

## Важные замечания

1. **NEXT_PUBLIC_* переменные** встраиваются в клиентский код при сборке
   - После изменения требуется **rebuild** (`pnpm build`)
   - Railway автоматически делает rebuild при деплое

2. **Server-side переменные** (`CORE_API_ORIGIN`) доступны только на сервере
   - Не попадают в клиентский код
   - Не требуют rebuild после изменения

3. **Secrets никогда не должны быть в NEXT_PUBLIC_***
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` - это публичное значение (username бота)
   - Токены и секреты должны быть только в server-side переменных

4. **Проверка работоспособности:**
   - Healthcheck: `GET /api/health` должен возвращать `200 OK`
   - Login page: должен отображаться Telegram Login Widget
   - API запросы: должны проксироваться к core без ошибок

