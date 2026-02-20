# Денежный дашборд для режима "Анализ"

## Описание

Денежный дашборд — это главный экран режима "Анализ" в Owner Web. Он показывает финансовые метрики и последние заявки/заказы по выбранному боту.

## URL и навигация

- **URL:** `/cabinet/[botId]?mode=manage&tab=overview`
- **По умолчанию:** При входе в режим "Анализ" открывается вкладка "Обзор" (overview)
- **Навигация:** Боковое меню → "Обзор" (первый пункт в режиме "Анализ")

## API Endpoint

### GET `/api/owner/bots/:botId/analytics`

**Query параметры:**
- `range` (optional): `'today'` | `'7d'` (по умолчанию: `'today'`)

**Ответ:**
```json
{
  "summaryToday": {
    "leadsCount": 12,
    "ordersCount": 7,
    "revenuePotentialRub": 24000,
    "conversionPct": 58,
    "confirmedOrdersCount": 4
  },
  "summary7d": {
    "leadsCount": 45,
    "ordersCount": 28,
    "revenuePotentialRub": 120000,
    "avgCheckRub": 4285.71
  },
  "latestOrders": [...],
  "latestLeads": [...]
}
```

**Авторизация:** Требуется owner auth + доступ к боту через `bot_admins`

## Метрики

### Сегодня (range=today)

1. **Новые заявки сегодня** — `COUNT(leads)` где `created_at` в текущий день
2. **Новые заказы сегодня** — `COUNT(orders)` где `created_at` в текущий день
3. **Потенциальный доход сегодня** — `SUM(orders.amount)` где `currency = 'RUB'` и `created_at` в текущий день
4. **Конверсия сегодня** — `(confirmed + completed) / all_orders * 100` за текущий день

### 7 дней (range=7d)

1. **Новые заявки (7д)** — `COUNT(leads)` за последние 7 дней
2. **Новые заказы (7д)** — `COUNT(orders)` за последние 7 дней
3. **Потенциальный доход (7д)** — `SUM(orders.amount)` где `currency = 'RUB'` за последние 7 дней
4. **Средний чек (7д)** — `SUM(amount) / COUNT(orders)` за последние 7 дней

## SQL запросы для проверки в Neon

### Заявки сегодня
```sql
SELECT COUNT(*) as count
FROM leads
WHERE bot_id = 'YOUR_BOT_ID'
  AND created_at >= date_trunc('day', now())
  AND created_at < date_trunc('day', now()) + interval '1 day';
```

### Заказы сегодня
```sql
SELECT 
  COUNT(*) as count,
  COALESCE(SUM(CASE WHEN currency = 'RUB' AND amount IS NOT NULL THEN amount ELSE 0 END), 0) as revenue,
  COUNT(*) FILTER (WHERE status IN ('confirmed', 'completed')) as confirmed
FROM orders
WHERE bot_id = 'YOUR_BOT_ID'
  AND created_at >= date_trunc('day', now())
  AND created_at < date_trunc('day', now()) + interval '1 day';
```

### Заявки за 7 дней
```sql
SELECT COUNT(*) as count
FROM leads
WHERE bot_id = 'YOUR_BOT_ID'
  AND created_at >= now() - interval '7 days';
```

### Заказы за 7 дней
```sql
SELECT 
  COUNT(*) as count,
  COALESCE(SUM(CASE WHEN currency = 'RUB' AND amount IS NOT NULL THEN amount ELSE 0 END), 0) as revenue,
  CASE 
    WHEN COUNT(*) > 0 THEN 
      COALESCE(ROUND(AVG(CASE WHEN currency = 'RUB' AND amount IS NOT NULL THEN amount ELSE NULL END)::numeric, 2), 0)
    ELSE 0
  END as avgCheck
FROM orders
WHERE bot_id = 'YOUR_BOT_ID'
  AND created_at >= now() - interval '7 days';
```

## Компоненты

- **`AnalysisDashboard.tsx`** — главный компонент дашборда
- **`LiveModeView.tsx`** — контейнер с вкладками (обновлен для поддержки "Обзор")
- **`cabinet-sidebar.tsx`** — боковое меню (обновлено для режима "Анализ")

## Важные замечания

1. **Потенциальный доход** — это сумма заказов, не реальные платежи. Оплата проходит вне бота.
2. **Конверсия** — рассчитывается как процент подтвержденных/завершенных заказов от всех заказов за период.
3. **Валюты** — учитываются только заказы с `currency = 'RUB'`. Другие валюты не включаются в расчет дохода.
4. **Пустые значения** — если нет данных, показывается "—" вместо процентов/сумм.

## Проверка работы

1. Откройте Owner Web в режиме "Анализ"
2. Выберите бота
3. Должна открыться вкладка "Обзор" с метриками
4. Переключите диапазон "Сегодня" / "7 дней"
5. Проверьте, что метрики совпадают с SQL запросами в Neon
6. Проверьте таблицы "Последние заказы" и "Последние заявки"

