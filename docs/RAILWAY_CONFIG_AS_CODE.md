# Railway Config-as-Code Setup

## Проблема

Railway применяет `railway.json` из корня ко всем сервисам, из-за чего все сервисы запускали один и тот же пакет (owner-web).

## Решение

Создан универсальный start script (`scripts/railway-start.js`), который определяет нужный пакет по переменной окружения `RAILWAY_SERVICE_NAME`.

## Конфигурация

### railway.json (корень репозитория)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "pnpm railway:start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Railway Variables (для каждого сервиса)

Railway автоматически устанавливает `RAILWAY_SERVICE_NAME` для каждого сервиса. Если нет - установите вручную:

**Core Service:**
```
RAILWAY_SERVICE_NAME=core
```

**Owner-Web Service:**
```
RAILWAY_SERVICE_NAME=owner-web
```

**Router Service:**
```
RAILWAY_SERVICE_NAME=router
```

**Worker Service:**
```
RAILWAY_SERVICE_NAME=worker
```

**Mini-App Service:**
```
RAILWAY_SERVICE_NAME=miniapp
```

## Маппинг сервисов

| Railway Service Name | Package Name |
|---------------------|--------------|
| `core` | `@dialogue-constructor/core` |
| `owner-web` | `@dialogue-constructor/owner-web` |
| `router` | `@dialogue-constructor/router` |
| `worker` | `@dialogue-constructor/worker` |
| `miniapp` или `mini-app` | `@dialogue-constructor/mini-app` |
| `frontend` | `@dialogue-constructor/frontend` |

## Проверка

### Core Service Deploy Logs должны показывать:
```
🚀 Starting service: core → @dialogue-constructor/core
> @dialogue-constructor/core@1.0.0 start
> node dist/index.js
Server is running on port XXXX
```

**НЕ должно быть:**
- `@dialogue-constructor/owner-web`
- `next start`
- `packages/owner-web`

### Owner-Web Service Deploy Logs должны показывать:
```
🚀 Starting service: owner-web → @dialogue-constructor/owner-web
> @dialogue-constructor/owner-web@1.0.0 start
> next start -H 0.0.0.0 -p ${PORT:-8080}
▲ Next.js 15.0.3
- Local:        http://0.0.0.0:XXXX
✓ Ready in XXXms
```

## Health Checks

```bash
# Core должен отдавать API (JSON)
curl https://core-production-*.up.railway.app/health

# Owner-Web должен отдавать Next.js
curl https://owner-web-production-*.up.railway.app/api/health
# Ожидается: {"ok":true,"ts":...}

# Router должен отдавать API
curl https://router-production-*.up.railway.app/health
```

## Критерии успеха

✅ Core Deploy Logs содержат: `@dialogue-constructor/core start`  
✅ Нет упоминаний `packages/owner-web` в Core Deploy Logs  
✅ `curl https://core-production-*.up.railway.app/health` возвращает JSON  
✅ Домен core отдаёт API, а не Owner Cabinet  
✅ Каждый сервис запускает свой пакет  
✅ PORT автоматически передаётся Railway  

## Troubleshooting

### Если сервис запускает не тот пакет:

1. Проверьте переменную `RAILWAY_SERVICE_NAME` в Railway UI:
   - Settings → Variables → `RAILWAY_SERVICE_NAME`
   - Должно быть: `core`, `owner-web`, `router`, `worker`, `miniapp`

2. Проверьте Deploy Logs:
   - Должна быть строка: `🚀 Starting service: <service> → <package>`

3. Если `RAILWAY_SERVICE_NAME` не установлен:
   - Railway может не устанавливать эту переменную автоматически
   - Установите вручную в Railway UI для каждого сервиса

### Альтернатива: SERVICE_NAME

Если `RAILWAY_SERVICE_NAME` не работает, скрипт также проверяет `SERVICE_NAME`:

```
SERVICE_NAME=core
```

