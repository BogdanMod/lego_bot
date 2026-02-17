# Owner Web: Управление ботами

## Обзор

Owner Web теперь поддерживает полное управление ботами через веб-интерфейс:
- Просмотр списка ботов
- Создание ботов из шаблонов или с нуля
- Удаление ботов
- Обновление информации о ботах

## API Endpoints

### GET /api/owner/templates

Возвращает список доступных шаблонов ботов.

**Аутентификация:** Требуется owner session cookie

**Ответ:**
```json
{
  "items": [
    {
      "id": "coffee-shop-rf",
      "title": "Кофейня (РФ)",
      "industry": "Бизнес",
      "goal": "Развернутый шаблон кофейни...",
      "shortDescription": "Развернутый шаблон кофейни...",
      "requiredInputs": [
        {
          "key": "businessName",
          "label": "Название бизнеса",
          "type": "text",
          "required": true,
          "description": "Название вашего бизнеса"
        }
      ],
      "defaultFlows": [
        {
          "id": "start",
          "name": "Добро пожаловать в кофейню!",
          "description": "Приветственное сообщение"
        }
      ],
      "tags": ["Категории напитков", "Предзаказ", "Акции"]
    }
  ]
}
```

**cURL пример:**
```bash
curl -X GET "https://core-production.up.railway.app/api/owner/templates" \
  -H "Cookie: owner_session=<session_token>" \
  -H "Content-Type: application/json"
```

### GET /api/owner/bots

Возвращает список ботов текущего владельца.

**Аутентификация:** Требуется owner session cookie

**Ответ:**
```json
{
  "items": [
    {
      "botId": "d578f835-41f7-4a21-83ce-2da6c82b7c16",
      "name": "Мой бот",
      "role": "owner"
    }
  ]
}
```

**cURL пример:**
```bash
curl -X GET "https://core-production.up.railway.app/api/owner/bots" \
  -H "Cookie: owner_session=<session_token>" \
  -H "Content-Type: application/json"
```

### POST /api/owner/bots

Создает нового бота.

**Аутентификация:** Требуется owner session cookie + CSRF token

**Тело запроса:**
```json
{
  "templateId": "coffee-shop-rf",  // Опционально
  "name": "Моя кофейня",
  "timezone": "Europe/Moscow",      // Опционально, по умолчанию "Europe/Moscow"
  "language": "ru",                 // Опционально, по умолчанию "ru"
  "inputs": {                       // Опционально, для подстановки в шаблон
    "businessName": "Кофейня на углу",
    "contactPhone": "+79991234567"
  }
}
```

**Ответ:**
```json
{
  "bot": {
    "botId": "d578f835-41f7-4a21-83ce-2da6c82b7c16",
    "name": "Моя кофейня",
    "role": "owner"
  }
}
```

**cURL пример:**
```bash
curl -X POST "https://core-production.up.railway.app/api/owner/bots" \
  -H "Cookie: owner_session=<session_token>" \
  -H "X-CSRF-Token: <csrf_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "coffee-shop-rf",
    "name": "Моя кофейня",
    "timezone": "Europe/Moscow",
    "language": "ru",
    "inputs": {
      "businessName": "Кофейня на углу",
      "contactPhone": "+79991234567"
    }
  }'
```

### PATCH /api/owner/bots/:botId

Обновляет информацию о боте.

**Аутентификация:** Требуется owner session cookie + CSRF token + доступ к боту

**Тело запроса:**
```json
{
  "name": "Новое название",  // Опционально
  "inputs": {                // Опционально, для обновления шаблона
    "businessName": "Новое название бизнеса"
  }
}
```

**Ответ:**
```json
{
  "ok": true
}
```

**cURL пример:**
```bash
curl -X PATCH "https://core-production.up.railway.app/api/owner/bots/d578f835-41f7-4a21-83ce-2da6c82b7c16" \
  -H "Cookie: owner_session=<session_token>" \
  -H "X-CSRF-Token: <csrf_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Новое название",
    "inputs": {
      "businessName": "Новое название бизнеса"
    }
  }'
```

### DELETE /api/owner/bots/:botId

Деактивирует бота (soft delete).

**Аутентификация:** Требуется owner session cookie + CSRF token + доступ к боту

**Ответ:**
```json
{
  "success": true,
  "message": "Bot deactivated"
}
```

**cURL пример:**
```bash
curl -X DELETE "https://core-production.up.railway.app/api/owner/bots/d578f835-41f7-4a21-83ce-2da6c82b7c16" \
  -H "Cookie: owner_session=<session_token>" \
  -H "X-CSRF-Token: <csrf_token>" \
  -H "Content-Type: application/json"
```

## UI Маршруты

### /cabinet/bots

Главная страница управления ботами:
- Список всех ботов владельца
- Кнопка "Создать бота"
- Кнопки "Открыть" и "Удалить" для каждого бота

### /cabinet/bots/templates

Галерея шаблонов:
- Поиск по названию/описанию
- Фильтр по отрасли
- Карточки шаблонов с кнопкой "Выбрать"

### /cabinet/bots/new

Wizard создания бота (4 шага):

**Шаг 1: Базовая информация**
- Название бота
- Часовой пояс
- Язык

**Шаг 2: Поля шаблона** (если выбран шаблон)
- Обязательные и опциональные поля
- Валидация обязательных полей

**Шаг 3: Предпросмотр**
- Информация о боте
- Список сценариев (flows)

**Шаг 4: Создание**
- Кнопка "Создать бота"
- Редирект на `/cabinet/:botId/overview` после успешного создания

## Клиентский API (owner-web)

Все функции находятся в `packages/owner-web/src/lib/api.ts`:

```typescript
// Получить шаблоны
ownerGetTemplates(): Promise<{ items: TemplateMetadata[] }>

// Получить список ботов
ownerBots(): Promise<{ items: Array<{ botId: string; name: string; role: string }> }>

// Создать бота
ownerCreateBot(payload: CreateBotPayload): Promise<{ bot: { botId: string; name: string; role: string } }>

// Обновить бота
ownerUpdateBot(botId: string, payload: UpdateBotPayload): Promise<{ ok: boolean }>

// Удалить бота
ownerDeactivateBot(botId: string): Promise<{ success: boolean; message: string }>
```

## Особенности

### Создание бота без токена

При создании бота через Owner Web используется placeholder токен. Реальный токен Telegram бота должен быть добавлен позже через:
- Настройки бота в Owner Web
- Mini App (публикация бота)

### Подстановка значений в шаблоны

Если в шаблоне есть плейсхолдеры вида `{{businessName}}`, они будут заменены на значения из `inputs` при создании бота.

### Лимиты ботов

Создание бота проверяет лимит активных ботов пользователя. При достижении лимита возвращается ошибка `bot_limit_reached` с деталями:
```json
{
  "code": "bot_limit_reached",
  "message": "Bot limit reached: 5/5",
  "details": {
    "activeBots": 5,
    "limit": 5
  }
}
```

## Структура шаблонов

Шаблоны загружаются из `packages/mini-app/src/templates/*.json` и преобразуются в формат `TemplateMetadata` для API.

Каждый шаблон содержит:
- `id` - уникальный идентификатор
- `name` - название
- `description` - описание
- `category` - категория (business/education/entertainment/other)
- `icon` - иконка (emoji)
- `schema` - схема бота (BotSchema)
- `preview.features` - список возможностей

## Обработка ошибок

Все ошибки обрабатываются через toast-уведомления:
- `bot_limit_reached` - показывается модал с информацией о лимите
- `csrf_failed` - автоматически обновляется CSRF токен
- Другие ошибки - показывается сообщение об ошибке

## Тестирование

### Локальное тестирование

1. Запустите `core` и `owner-web`:
```bash
pnpm --filter @dialogue-constructor/core dev
pnpm --filter @dialogue-constructor/owner-web dev
```

2. Откройте `http://localhost:5175` и войдите через Telegram

3. Перейдите в раздел "Мои боты"

### Тестирование API

Используйте curl примеры выше, заменив:
- `https://core-production.up.railway.app` на `http://localhost:3000`
- `<session_token>` на реальный токен из cookie после входа
- `<csrf_token>` на токен из `/api/owner/auth/me`

## Миграция данных

Нет необходимости в миграции - все данные берутся из существующих таблиц:
- `bots` - информация о ботах
- `bot_admins` - доступ владельцев к ботам
- `bot_settings` - настройки ботов

## Безопасность

- Все endpoints требуют owner authentication
- Mutating операции (POST, PATCH, DELETE) требуют CSRF token
- Доступ к ботам проверяется через `bot_admins` (RBAC)
- Лимиты ботов проверяются с advisory locks для предотвращения race conditions

