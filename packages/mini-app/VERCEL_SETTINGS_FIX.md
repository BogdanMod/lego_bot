# Исправление настроек Vercel для Mini App

## Проблема

В настройках проекта Vercel указан неправильный **Root Directory**: `packages/core` вместо `packages/mini-app`.

## Решение

### Шаг 1: Измените Root Directory

1. Откройте Vercel Dashboard → ваш проект для Mini App
2. Перейдите в **Settings** → **General** → **Root Directory**
3. Измените `packages/core` на `packages/mini-app`
4. Нажмите **Save**

### Шаг 2: Обновите Build Command

1. Перейдите в **Settings** → **Build and Deployment**
2. В разделе **Build Command**:
   - Убедитесь, что **Override** включен
   - Измените команду на:
     ```
     cd ../.. && npm install && turbo run build --filter=@dialogue-constructor/shared && cd packages/mini-app && npm run build
     ```
   - Или проще (если Turbo правильно обрабатывает зависимости):
     ```
     npm run build
     ```
3. В разделе **Install Command**:
   - Убедитесь, что **Override** включен
   - Измените команду на:
     ```
     cd ../.. && npm install
     ```
4. В разделе **Output Directory**:
   - Убедитесь, что указано: `dist`
5. Нажмите **Save**

### Шаг 3: Проверьте Framework Preset

- **Framework Preset** должен быть: `Vite` (или `Other`, если Vite не определяется автоматически)

### Шаг 4: Redeploy

После изменения настроек:
1. Перейдите в **Deployments**
2. Найдите последний деплой
3. Нажмите **Redeploy** (три точки → Redeploy)

## Альтернативный вариант (если не работает)

Если проблема сохраняется, попробуйте упростить Build Command:

1. **Root Directory**: `packages/mini-app`
2. **Install Command**: `cd ../.. && npm install` (Override включен)
3. **Build Command**: `npm run build` (Override включен)
4. **Output Directory**: `dist` (Override включен)

Turbo должен автоматически собрать зависимости (`shared`) перед сборкой `mini-app` благодаря `dependsOn: ["^build"]` в `turbo.json`.

## Проверка

После деплоя проверьте:
1. Логи сборки — должны быть успешными
2. Деплой должен завершиться без ошибок
3. Mini App должен открываться по URL

