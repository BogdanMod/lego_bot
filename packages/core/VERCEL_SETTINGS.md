# Настройки Vercel для lego-bot-core

## Проблема

При сборке проекта `lego-bot-core` Vercel запускает `cd ../.. && npm run build`, что собирает ВСЕ пакеты через Turbo, включая `mini-app`, который не нужен для `core` и вызывает ошибки.

## Решение

### Настройки в Vercel Dashboard для проекта `lego-bot-core`:

1. **Root Directory**: `packages/core` ✅ (уже правильно)

2. **Install Command**:
   - **Override**: включен
   - Команда: `cd ../.. && npm install`

3. **Build Command**:
   - **Override**: включен
   - Команда: `cd ../.. && npm install && turbo run build --filter=@dialogue-constructor/core...`
   - Или проще: `cd ../.. && npm install && turbo run build --filter=@dialogue-constructor/core^...`
   - Это соберет только `core` и его зависимости (`shared`), но не `mini-app`

4. **Output Directory**: не используется (это serverless функция)

5. **Framework Preset**: `Other`

## Альтернативный вариант (если Turbo filter не работает)

Если фильтр Turbo не работает, используйте прямую сборку:

**Build Command**:
```
cd ../.. && npm install && cd packages/shared && npm run build && cd ../core && npm run build
```

Это:
1. Установит зависимости из корня
2. Соберет `shared` (зависимость `core`)
3. Соберет `core`

## Проверка

После изменения настроек:
1. Сохраните изменения
2. Сделайте Redeploy
3. Проверьте логи - должна собираться только `core` и `shared`, без `mini-app`

