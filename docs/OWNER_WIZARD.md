# Owner Wizard - Мощный Wizard для создания ботов

## Обзор

Owner Wizard - это feature-flagged система для создания ботов через веб-интерфейс Owner Web. Система полностью backward compatible и не ломает существующий формат ботов.

## Feature Flag

Wizard активируется только при установке переменной окружения:

```bash
ENABLE_OWNER_WIZARD=1
NEXT_PUBLIC_ENABLE_OWNER_WIZARD=1  # Для клиентской части
```

Если флаг не установлен:
- Старое поведение owner-web не меняется
- Wizard UI не отображается
- API endpoints работают в legacy режиме

## Архитектура

### Структура шаблонов

```
packages/owner-web/src/lib/templates/
├── types.ts          # TypeScript типы
├── engine.ts         # Template Engine (подстановки, валидация, модули)
├── base.ts           # Базовые утилиты
├── feature-flag.ts   # Проверка feature flag
├── index.ts          # Registry шаблонов
├── coffee-shop.ts    # Шаблон кофейни
├── beauty-salon.ts  # Шаблон салона красоты
└── __tests__/        # Unit-тесты
```

### Template Engine

Template Engine обрабатывает:
1. **Подстановку переменных**: `{{businessName}}` → значение из answers
2. **Валидацию**: проверка обязательных полей, min/max, patterns
3. **Модули**: handoff, schedule, faq, payments, catalog, leads

### Формат шаблона

```typescript
interface TemplateDefinition {
  manifest: {
    id: string;
    name: string;
    description: string;
    icon: string;
    version: string;
    category: 'business' | 'education' | 'entertainment' | 'other';
  };
  wizard: {
    steps: WizardStep[];
    modules: {
      handoff?: boolean;
      schedule?: boolean;
      faq?: boolean;
      payments?: boolean;
      catalog?: boolean;
      leads?: boolean;
    };
  };
  buildBotConfig: (answers: TemplateAnswers) => BotConfig;
}
```

### Backward Compatibility

Созданные боты используют тот же формат `BotSchema`, что и существующие:
- `schema.version: 1`
- `schema.initialState: string`
- `schema.states: { [key: string]: State }`

Дополнительно сохраняется `metadata.template` (необязательно):
```json
{
  "template": {
    "id": "coffee_shop",
    "version": "1.0.0"
  }
}
```

Это поле не влияет на runtime и используется только для отслеживания источника создания.

## API Endpoints

### POST /api/owner/bots

Создание бота через Wizard:

```json
{
  "name": "Моя кофейня",
  "timezone": "Europe/Moscow",
  "language": "ru",
  "templateId": "coffee_shop",
  "templateVersion": "1.0.0",
  "config": {
    "schema": { /* BotSchema */ },
    "metadata": {
      "template": {
        "id": "coffee_shop",
        "version": "1.0.0"
      }
    }
  }
}
```

Legacy формат (без `config`):
```json
{
  "name": "Мой бот",
  "templateId": "coffee-shop-rf",
  "inputs": {
    "businessName": "Кафе"
  }
}
```

### GET /api/owner/bots

Список ботов владельца (без изменений).

### DELETE /api/owner/bots/:id

Удаление бота (без изменений).

## UI Маршруты

### /cabinet/bots

Список ботов с кнопкой "Создать бота".

### /cabinet/bots/new

Wizard создания бота:
- Если `?template=true` и `ENABLE_OWNER_WIZARD=1`: выбор шаблона
- Затем: многошаговая форма
- Финальный шаг: выбор модулей
- Создание и редирект на `/cabinet/:botId/overview`

## Модули

### handoff
Добавляет состояние `handoff` для передачи администратору и кнопку в стартовом меню.

### schedule
Добавляет состояние `schedule` для записи/расписания.

### faq
Добавляет состояние `faq` с частыми вопросами.

### payments
Добавляет состояние `payment` для оплаты.

### catalog
Добавляет состояние `catalog` для каталога товаров/услуг.

### leads
Добавляет состояние `lead` для сбора лидов.

## Тестирование

### Unit-тесты

```bash
pnpm --filter @dialogue-constructor/owner-web test
```

Тесты покрывают:
- Подстановку переменных
- Валидацию ответов
- Применение модулей

### Smoke-тесты

1. Создать бота через Wizard
2. Проверить что бот появился в списке
3. Открыть бота и проверить схему
4. Удалить бота

## Переменные окружения

### Core
```bash
ENABLE_OWNER_WIZARD=1  # Опционально, для логирования
```

### Owner-Web
```bash
ENABLE_OWNER_WIZARD=1           # Server-side проверка
NEXT_PUBLIC_ENABLE_OWNER_WIZARD=1  # Client-side проверка
CORE_API_ORIGIN=https://core-production.up.railway.app
```

## Миграция

Нет необходимости в миграции БД. Система полностью backward compatible:
- Старые боты работают как раньше
- Новые боты создаются через Wizard (если флаг включен)
- `metadata.template` сохраняется в `bot_settings.metadata` (graceful degradation если колонка не существует)

## Ограничения

1. LLM генерация FAQ/текстов по умолчанию выключена (можно добавить чекбокс в Wizard)
2. Шаблоны загружаются статически (не из БД)
3. Модули применяются последовательно (порядок важен)

## Roadmap

- [ ] Добавить оставшиеся 13 шаблонов
- [ ] LLM интеграция для генерации текстов (опционально)
- [ ] Визуальный редактор flows после создания
- [ ] Экспорт/импорт шаблонов
- [ ] A/B тестирование шаблонов

