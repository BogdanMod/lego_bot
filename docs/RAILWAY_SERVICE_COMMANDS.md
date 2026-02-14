# Railway Service Commands

## Проблема
Глобальные `railway.json` и `nixpacks.toml` в корне применялись ко всем сервисам, из-за чего все запускали `owner-web`.

## Решение
Удалены глобальные конфиги. Каждый сервис настраивается отдельно в Railway UI.

## Команды для Railway UI

### 1. Core Service

**Settings → Build & Deploy:**

- **Root Directory:** `.` (корень репозитория)
- **Build Command:** `pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/core build`
- **Start Command:** `pnpm --filter @dialogue-constructor/core start`

**Проверка в Deploy Logs:**
```
> @dialogue-constructor/core@1.0.0 start
> node dist/index.js
```

**Health Check:**
```bash
curl https://core-production-*.up.railway.app/health
```

---

### 2. Owner-Web Service

**Settings → Build & Deploy:**

- **Root Directory:** `.` (корень репозитория)
- **Build Command:** `pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/owner-web build`
- **Start Command:** `pnpm --filter @dialogue-constructor/owner-web start`

**Проверка в Deploy Logs:**
```
> @dialogue-constructor/owner-web@1.0.0 start
> next start -H 0.0.0.0 -p ${PORT:-8080}
▲ Next.js 15.0.3
- Local:        http://0.0.0.0:XXXX
✓ Ready in XXXms
```

**Health Check:**
```bash
curl https://owner-web-production-*.up.railway.app/api/health
```

---

### 3. Router Service

**Settings → Build & Deploy:**

- **Root Directory:** `.` (корень репозитория)
- **Build Command:** `pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/router build`
- **Start Command:** `pnpm --filter @dialogue-constructor/router start`

**Проверка в Deploy Logs:**
```
> @dialogue-constructor/router@1.0.0 start
> node dist/index.js
```

**Health Check:**
```bash
curl https://router-production-*.up.railway.app/health
```

---

### 4. Worker Service

**Settings → Build & Deploy:**

- **Root Directory:** `.` (корень репозитория)
- **Build Command:** `pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/worker build`
- **Start Command:** `pnpm --filter @dialogue-constructor/worker start`

**Проверка в Deploy Logs:**
```
> @dialogue-constructor/worker@1.0.0 start
> node dist/index.js
```

---

### 5. Mini-App Service

**Settings → Build & Deploy:**

- **Root Directory:** `.` (корень репозитория)
- **Build Command:** `pnpm install --frozen-lockfile && pnpm --filter @dialogue-constructor/mini-app build`
- **Start Command:** `pnpm --filter @dialogue-constructor/mini-app start`

**Проверка в Deploy Logs:**
```
> @dialogue-constructor/mini-app@1.0.0 start
> node server.js
🚀 Mini App server running on http://0.0.0.0:XXXX
```

---

## Критерии успеха

### Core Service
- ✅ Deploy Logs содержат: `@dialogue-constructor/core start`
- ✅ НЕТ упоминаний `packages/owner-web` в Deploy Logs
- ✅ `curl https://core-production-*.up.railway.app/health` возвращает JSON
- ✅ Домен core отдаёт API, а не Owner Cabinet

### Owner-Web Service
- ✅ Deploy Logs содержат: `next start -H 0.0.0.0`
- ✅ `curl https://owner-web-production-*.up.railway.app/api/health` возвращает `{"ok":true,"ts":...}`

### Общие проверки
- ✅ Каждый сервис запускает свой пакет
- ✅ PORT автоматически передаётся Railway
- ✅ Нет ошибок "connection refused" в HTTP Logs

---

## Быстрый тест

```bash
# Core должен отдавать API
curl https://core-production-*.up.railway.app/health

# Owner-Web должен отдавать Next.js
curl https://owner-web-production-*.up.railway.app/api/health

# Проверка, что core НЕ отдаёт Owner Cabinet
curl -I https://core-production-*.up.railway.app/ | grep -i "content-type"
# Должно быть: application/json или text/html (но не Next.js страница)
```

