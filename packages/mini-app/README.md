# Mini App

Telegram Mini App для управления ботами.

## Environment Variables

### Required

- **`VITE_API_URL`** (client-side)
  - Описание: URL backend API (core сервис)
  - Пример: `https://core-production-xxxx.up.railway.app`
  - Где используется: `packages/mini-app/src/utils/api.ts`
  - **Важно:** После изменения требуется rebuild (`pnpm build`)

### Optional

- **`VITE_OWNER_WEB_BASE_URL`** (client-side)
  - Описание: URL Owner Web (owner-web сервис) для переходов в кабинет владельца
  - Пример: `https://owner-web-production-xxxx.up.railway.app`
  - Где используется: `packages/mini-app/src/utils/owner-web.ts`
  - **Важно:** 
    - URL должен быть без trailing slash (`/`)
    - После изменения требуется rebuild (`pnpm build`)
    - Если не установлен, переходы в owner-web не будут работать

- **`VITE_API_URL_LOCAL`** (client-side, для локальной разработки)
  - Описание: URL backend API для локальной разработки
  - Пример: `http://localhost:3000`
  - Используется автоматически при `localhost` или `import.meta.env.DEV`

## URL Normalization

Все base URLs нормализуются автоматически:
- Trailing slashes удаляются
- Paths нормализуются (добавляется `/` в начале если отсутствует)
- Результат: `baseUrl + normalizedPath` без двойных слэшей

Пример:
```typescript
// VITE_OWNER_WEB_BASE_URL = "https://owner-web.example.com/"
// path = "/cabinet/botId/settings"
// Результат: "https://owner-web.example.com/cabinet/botId/settings" (без двойных слэшей)
```

## Navigation to Owner Web

Mini App использует следующие функции для перехода в Owner Web:

- `openOwnerWebCabinet()` - открывает главную страницу кабинета (`/cabinet`)
- `openOwnerWebCreateBot()` - открывает страницу создания бота (`/cabinet` или `/cabinet/create`)
- `openBotInOwnerWeb(botId, section)` - открывает конкретного бота в секции (`/cabinet/${botId}/${section}`)

Все переходы используют `Telegram.WebApp.openLink()` если доступно, иначе `window.open()`.

## Routes in Owner Web

- `/cabinet` - главная страница со списком ботов
- `/cabinet/${botId}/overview` - обзор бота
- `/cabinet/${botId}/settings` - настройки бота
- `/cabinet/${botId}/inbox` - входящие события
- `/cabinet/${botId}/calendar` - календарь
- `/cabinet/${botId}/orders` - заказы
- `/cabinet/${botId}/leads` - лиды
- `/cabinet/${botId}/customers` - клиенты
- `/cabinet/${botId}/team` - команда
- `/cabinet/${botId}/audit` - аудит

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Build Requirements

После изменения `VITE_*` переменных окружения требуется rebuild:

```bash
pnpm build
```

Это необходимо, потому что `VITE_*` переменные встраиваются в клиентский код при сборке.

