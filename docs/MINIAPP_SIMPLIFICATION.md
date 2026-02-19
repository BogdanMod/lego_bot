# Mini App Simplification

## Обзор изменений

Mini App был радикально упрощен для устранения путаницы между Owner Web и Mini App.

### Цель продукта

- **Owner Web** = единственное место для управления ботами (создание/редактирование/все разделы)
- **Mini App** = только billing + health (проверка подписки, апгрейд/продление, read-only список ботов и их статус)

## Что изменилось

### 1. Новый UI Mini App (2 экрана)

#### A) Subscription (`/subscription`)
- План подписки (free/premium)
- Статус подписки (активна/неактивна)
- Дата окончания (`expiresAt`)
- Лимиты (активных ботов: active/limit, всего ботов: total)
- CTA кнопки:
  - "Повысить план" (если неактивна)
  - "Продлить подписку" (если активна)
  - "Открыть Owner Web" (всегда доступна)
- Кнопка "Поддержка"

#### B) Bots (`/bots`)
- Read-only список ботов:
  - Название бота
  - Статус (активен/неактивен)
  - Счетчик Active/Total
- CTA "Открыть в Owner Web" для каждого бота (deeplink)
- Кнопка "Открыть Owner Web" в шапке

### 2. Удаленные функции

Все следующие функции были удалены из Mini App:
- Создание ботов
- Редактирование ботов (конструктор)
- Настройки ботов
- Команды ботов
- Шаблоны
- Интеграции
- Аналитика
- Рассылки
- Клиенты

**Все эти функции теперь доступны только в Owner Web.**

### 3. Backward Compatible

Все старые routes Mini App редиректят на `/subscription` с баннером:
- "Управление ботами переехало в Owner Web"
- Кнопка "Открыть Owner Web"
- Кнопка "Вернуться в Mini App"

Старые deep links не падают, они корректно редиректят.

### 4. Feature Flag

Добавлен feature flag `MINIAPP_MODE`:

- **`billing`** (по умолчанию) - новый упрощенный режим
- **`legacy`** - старый полный режим (для отката)

Установка через переменную окружения:
```bash
VITE_MINIAPP_MODE=billing  # или legacy
```

### 5. API

Создан единый endpoint `/api/miniapp/overview` в Core:

**Endpoint:** `GET /api/miniapp/overview?user_id={userId}`

**Headers:**
- `X-Telegram-Init-Data: {initData}`

**Response:**
```json
{
  "subscription": {
    "plan": "free" | "premium",
    "status": "active" | "inactive",
    "startsAt": "2024-01-01T00:00:00Z" | null,
    "endsAt": "2024-02-01T00:00:00Z" | null,
    "isActive": true | false
  },
  "bots": {
    "items": [
      {
        "id": "bot-id",
        "name": "Bot Name",
        "isActive": true | false
      }
    ],
    "active": 2,
    "total": 5,
    "limit": 3
  }
}
```

**Источники данных:**
- `subscription` - из таблицы `user_subscriptions` (функция `getUserSubscription`)
- `bots.active` - из `countOwnerAccessibleBots()` (source of truth)
- `bots.total` - из `getBotStatsByUserId()` (включая неактивные)
- `bots.items` - read-only список всех ботов (активных и неактивных)

### 6. UX

- **Максимальный минимализм** (Linear-style):
  - Чистый дизайн без лишней навигации
  - Только 2 экрана (Subscription и Bots)
  - Простая bottom navigation
  - Ампл whitespace
  - Тонкие borders
  - Нейтральная типографика

- **Ясные подсказки:**
  - Везде явные баннеры: "Управление ботами — в Owner Web"
  - Одна явная кнопка "Открыть Owner Web" на каждом экране

- **Нет редактирования:**
  - Mini App не может редактировать ботов
  - Все действия ведут в Owner Web

## Структура файлов

### Новые файлы

```
packages/mini-app/src/
  pages/
    SubscriptionPage.tsx      # Экран подписки
    BotsPage.tsx               # Экран списка ботов (read-only)
  components/
    LegacyRedirect.tsx         # Компонент для редиректов старых routes
    BillingNavigation.tsx      # Bottom navigation для billing mode
```

### Измененные файлы

```
packages/mini-app/src/
  App.tsx                      # Добавлен feature flag и routing для billing mode
packages/core/src/
  index.ts                     # Добавлен endpoint /api/miniapp/overview
  db/admin.ts                  # Добавлена функция getUserSubscription
```

## Миграция

### Для пользователей

1. Откройте Mini App
2. Увидите новый упрощенный интерфейс с 2 экранами
3. Все старые ссылки автоматически редиректят с баннером
4. Используйте кнопку "Открыть Owner Web" для управления ботами

### Для разработчиков

1. Установите `VITE_MINIAPP_MODE=billing` (или оставьте по умолчанию)
2. Для отката установите `VITE_MINIAPP_MODE=legacy`
3. Все старые deep links будут работать (с редиректом)

## Технические детали

### Feature Flag

```typescript
const MINIAPP_MODE = (import.meta.env.VITE_MINIAPP_MODE || 'billing').toLowerCase() as 'billing' | 'legacy';
```

### Routing

**Billing mode:**
- `/` → `/subscription`
- `/subscription` → SubscriptionPage
- `/bots` → BotsPage
- `/bot/:id/*` → LegacyRedirect (с баннером)
- `/templates` → LegacyRedirect (с баннером)

**Legacy mode:**
- Все старые routes работают как раньше

### API Endpoint

Endpoint использует существующие функции:
- `getUserSubscription(userId)` - получение подписки
- `getBotStatsByUserId(userId)` - статистика ботов
- Прямой SQL запрос для списка ботов (read-only)

## Что где находится

| Функция | Где находится |
|---------|---------------|
| Создание бота | Owner Web (`/cabinet`) |
| Редактирование бота | Owner Web (`/cabinet/[botId]/constructor`) |
| Настройки бота | Owner Web (`/cabinet/[botId]/settings`) |
| Публикация бота | Owner Web (`/cabinet/[botId]/settings`) |
| Просмотр подписки | Mini App (`/subscription`) |
| Продление подписки | Owner Web (через Mini App → "Продлить") |
| Список ботов (read-only) | Mini App (`/bots`) |
| Открытие бота в Owner Web | Mini App → кнопка "Открыть" |

## Обратная совместимость

- ✅ Все старые deep links работают (с редиректом)
- ✅ Feature flag позволяет откатиться к legacy режиму
- ✅ Ничего не падает при открытии старых ссылок
- ✅ Admin panel остается доступным в обоих режимах

## Следующие шаги

1. Обновить документацию для пользователей
2. Добавить ссылку на support bot в SubscriptionPage
3. (Опционально) Добавить analytics для отслеживания использования

