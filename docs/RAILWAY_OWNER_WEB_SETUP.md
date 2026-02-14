# Railway Setup для owner-web

## Проблема: ERR_PNPM_NO_LOCKFILE

Railway не находит `pnpm-lock.yaml` при сборке `owner-web`, потому что по умолчанию использует директорию сервиса как root.

## Решение: Настроить Root Directory

В Railway Dashboard для сервиса `owner-web`:

1. Откройте сервис `owner-web` в Railway Dashboard
2. Перейдите в **Settings** → **Service Settings**
3. Найдите поле **Root Directory**
4. Установите значение: `.` (корень репозитория)
5. Сохраните изменения

## Альтернатива: Использовать nixpacks.toml

Если Railway не подхватывает `railway.json`, можно создать `nixpacks.toml` в корне:

```toml
[phases.setup]
nixPkgs = ["nodejs_20", "pnpm"]

[phases.install]
cmds = [
  "pnpm install --frozen-lockfile"
]

[phases.build]
cmds = [
  "pnpm --filter @dialogue-constructor/owner-web build"
]

[start]
cmd = "pnpm --filter @dialogue-constructor/owner-web start"
```

## Проверка

После настройки Root Directory:

1. Railway должен видеть `pnpm-lock.yaml` в корне
2. Сборка должна пройти успешно
3. `pnpm install --frozen-lockfile` должен выполниться без ошибок

## Важно

- Root Directory должен быть `.` (корень репозитория), НЕ `packages/owner-web`
- `pnpm-lock.yaml` должен быть закоммичен в git
- `railway.json` находится в корне репозитория

