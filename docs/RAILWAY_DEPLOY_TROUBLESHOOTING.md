# Railway Deploy Troubleshooting

## Проблема: Railway не деплоится после push в main

### 1. Проверка коммита

Убедитесь, что коммит запушен в `origin/main`:

```bash
git log origin/main --oneline -1
# Должен показать последний коммит
```

### 2. Проверка настроек Railway

#### В Railway Dashboard:

1. **Settings → Source**
   - Репозиторий: `BogdanMod/lego_bot`
   - Ветка: `main`
   - Auto Deploy: **Enabled** ✅

2. **Settings → Service**
   - Root Directory: (пусто) или правильная директория
   - Build Command: правильная команда для вашего сервиса
   - Start Command: правильная команда для вашего сервиса

### 3. Ручной запуск деплоя

Если автодеплой не работает:

1. Откройте сервис в Railway
2. Нажмите **"Deploy"** → **"Redeploy"**
3. Или **"Deploy"** → **"Deploy Latest Commit"**

### 4. Проверка логов

Проверьте логи Railway на ошибки:

1. Откройте сервис в Railway
2. Перейдите в **"Deployments"**
3. Откройте последний деплой
4. Проверьте логи на ошибки сборки или запуска

### 5. Проверка webhook GitHub

Railway должен получать webhook от GitHub при push в main:

1. В Railway: **Settings → Source**
2. Проверьте, что webhook настроен
3. В GitHub: **Settings → Webhooks**
4. Проверьте, что есть webhook для Railway

### 6. Типичные проблемы

#### Проблема: "Build failed"
- Проверьте Build Command в Railway
- Проверьте логи сборки
- Убедитесь, что все зависимости установлены

#### Проблема: "Start failed"
- Проверьте Start Command в Railway
- Проверьте переменные окружения
- Убедитесь, что PORT установлен правильно

#### Проблема: "No deployments"
- Проверьте, что Auto Deploy включен
- Проверьте, что webhook от GitHub работает
- Попробуйте запустить деплой вручную

### 7. Команды для проверки

```bash
# Проверить последний коммит
git log origin/main --oneline -1

# Проверить статус
git status

# Проверить remote
git remote -v

# Принудительно обновить remote
git fetch origin
git log origin/main --oneline -1
```

### 8. Если ничего не помогает

1. Проверьте, что у вас есть доступ к Railway проекту
2. Проверьте, что репозиторий подключен правильно
3. Попробуйте отключить и заново подключить репозиторий в Railway
4. Проверьте логи Railway на ошибки

