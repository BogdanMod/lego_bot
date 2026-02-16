# Railway UI Setup Instructions

После удаления `railway.json` из корня, Railway UI снова позволяет настраивать команды для каждого сервиса индивидуально.

## Общие требования

- **PORT**: Railway автоматически устанавливает `PORT` для каждого сервиса. НЕ добавляйте `PORT` в Railway Variables вручную.
- **Build Command**: Все сервисы используют pnpm workspace, поэтому build команды должны запускаться из корня.
- **Start Command**: Каждый сервис запускает свой пакет через `pnpm --filter`.

---

## 1. Service: `miniapp` (Mini App)

### Railway UI Settings:

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/mini-app build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/mini-app start
```

**Healthcheck Path:**
```
/health
```

**Healthcheck Port:**
```
(оставьте пустым, Railway использует автоматический PORT)
```

### Проверка после деплоя:

1. **Deploy Logs** должны содержать:
   ```
   ✅ Server listening on port <динамический PORT> (from env: <PORT>)
   ✅ Server is ready to accept connections
   ✅ Railway: Service is ready on port <PORT>
   ```

2. **HTTP Logs** → `GET /health` должен вернуть:
   ```json
   {"ok":true,"service":"mini-app","port":<PORT>,...}
   ```

3. **HTTP Logs** → `GET /` должен вернуть HTML (index.html) или 200 OK.

4. **НЕ должно быть**:
   - `502 Bad Gateway`
   - `connection refused` в upstreamErrors
   - Фиксированных портов (3000, 3002, 8080) в логах

---

## 2. Service: `owner-web` (Owner Cabinet)

### Railway UI Settings:

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/owner-web build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/owner-web start
```

**Healthcheck Path:**
```
/api/health
```

**Healthcheck Port:**
```
(оставьте пустым, Railway использует автоматический PORT)
```

### Проверка после деплоя:

1. **Deploy Logs** должны содержать:
   ```
   ▲ Next.js <version>
   - Local:        http://0.0.0.0:<PORT>
   - Ready in <time> ms
   ```

2. **HTTP Logs** → `GET /api/health` должен вернуть:
   ```json
   {"ok":true,"service":"owner-web","ts":<timestamp>}
   ```

3. **HTTP Logs** → `GET /` должен вернуть HTML (Next.js app).

4. **НЕ должно быть**:
   - `502 Bad Gateway`
   - `connection refused`
   - Фиксированных портов в start команде

---

## 3. Service: `core` (Core API)

### Railway UI Settings:

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/core build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/core start
```

**Healthcheck Path:**
```
/health
```

**Healthcheck Port:**
```
(оставьте пустым)
```

### Проверка после деплоя:

1. **Deploy Logs** должны содержать:
   ```
   Server is running on port <PORT>
   ```

2. **HTTP Logs** → `GET /health` должен вернуть JSON с `ok: true`.

3. **HTTP Logs** → `GET /` должен вернуть JSON (или 404, если корневой роут не настроен).

---

## 4. Service: `router` (Router Service)

### Railway UI Settings:

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/router build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/router start
```

**Healthcheck Path:**
```
/health
```

**Healthcheck Port:**
```
(оставьте пустым)
```

### Проверка после деплоя:

1. **Deploy Logs** должны содержать:
   ```
   Router listening on port <PORT>
   ```

2. **HTTP Logs** → `GET /health` должен вернуть JSON.

---

## 5. Service: `worker` (Worker Service)

### Railway UI Settings:

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/worker build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/worker start
```

**Healthcheck Path:**
```
(оставьте пустым, worker обычно не имеет HTTP сервера)
```

**Healthcheck Port:**
```
(оставьте пустым)
```

### Проверка после деплоя:

1. **Deploy Logs** должны показывать, что worker запустился и начал обрабатывать события.

2. **НЕ должно быть**:
   - `process exited`
   - `connection refused` (если worker не имеет HTTP сервера, это нормально)

---

## 6. Service: `frontend` (Frontend)

### Railway UI Settings:

**Build Command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/frontend build
```

**Start Command:**
```bash
pnpm --filter @dialogue-constructor/frontend start
```

**Healthcheck Path:**
```
/health
```

**Healthcheck Port:**
```
(оставьте пустым, Railway использует автоматический PORT)
```

### Проверка после деплоя:

1. **Deploy Logs** должны содержать:
   ```
   ✅ Server listening on port <динамический PORT> (from env: <PORT>)
   ✅ Server is ready to accept connections
   ✅ Railway: Service is ready on port <PORT>
   ```

2. **HTTP Logs** → `GET /health` должен вернуть:
   ```json
   {"ok":true,"service":"frontend","port":<PORT>,...}
   ```

3. **HTTP Logs** → `GET /` должен вернуть HTML (index.html) или 200 OK.

4. **НЕ должно быть**:
   - `502 Bad Gateway`
   - `connection refused` в upstreamErrors
   - Фиксированных портов (3000, 8080) в логах

---

## Чек-лист проверки после деплоя всех сервисов

### ✅ Общие проверки:

- [ ] Все сервисы показывают статус "Online" (зеленый) в Railway UI
- [ ] В Deploy Logs каждого сервиса есть строка "listening on port <динамический PORT>" (НЕ фиксированный 3000/8080)
- [ ] HTTP Logs не показывают `502 Bad Gateway` или `connection refused`
- [ ] Healthcheck endpoints возвращают `200 OK` с JSON `{"ok":true,...}`

### ✅ Специфичные проверки:

- [ ] **miniapp**: `GET /health` → `200 OK`, `GET /` → `200 OK` (HTML)
- [ ] **owner-web**: `GET /api/health` → `200 OK`, `GET /` → `200 OK` (Next.js HTML)
- [ ] **core**: `GET /health` → `200 OK`, Telegram bot отвечает на команды
- [ ] **router**: `GET /health` → `200 OK` (если есть HTTP сервер)
- [ ] **worker**: Deploy Logs показывают обработку событий (если есть Redis Streams)
- [ ] **frontend**: `GET /health` → `200 OK`, `GET /` → `200 OK` (HTML)

---

## Troubleshooting

### Проблема: "502 Bad Gateway" или "connection refused"

**Причины:**
1. Сервер слушает на `localhost` вместо `0.0.0.0`
2. Сервер использует фиксированный порт вместо `process.env.PORT`
3. Сервер завершается сразу после старта (нет keep-alive)
4. Healthcheck endpoint недоступен или возвращает ошибку

**Решение:**
1. Проверьте Deploy Logs: должна быть строка `listening on 0.0.0.0:<PORT>`
2. Проверьте Start Command: должен использовать `$PORT` (не фиксированный)
3. Проверьте код сервера: нет ли `process.exit()` после `listen()`
4. Проверьте Healthcheck Path: должен быть доступен и возвращать `200 OK`

### Проблема: "The value is set in railway.json"

**Причина:** В корне репозитория есть `railway.json`, который блокирует UI настройки.

**Решение:** Удалите `railway.json` из корня (или переименуйте в `railway.json.disabled`).

### Проблема: PORT не установлен

**Причина:** Railway должен автоматически устанавливать `PORT`, но иногда это не происходит.

**Решение:**
1. НЕ добавляйте `PORT` в Railway Variables вручную
2. Убедитесь, что сервис имеет тип "Web Service" (не "Private Service")
3. Перезапустите сервис через Railway UI

---

## Важные замечания

1. **НЕ добавляйте PORT в Railway Variables** - Railway устанавливает его автоматически для каждого сервиса.

2. **Все Build/Start команды запускаются из корня репозитория** - Railway автоматически устанавливает рабочую директорию в корень монорепы.

3. **Используйте `pnpm --filter` для запуска конкретного пакета** - это гарантирует, что зависимости установлены и пакет собран.

4. **Healthcheck Path должен быть доступен БЕЗ аутентификации** - Railway использует его для проверки готовности сервиса.

5. **Все серверы должны слушать на `0.0.0.0`**, а не `localhost` или `127.0.0.1` - это необходимо для работы через Railway proxy.

