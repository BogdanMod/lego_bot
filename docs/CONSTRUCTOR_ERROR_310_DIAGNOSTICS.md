# Диагностика React Error #310 в Конструкторе

## 1. Route/URL и обработчик клика

### Кнопка "Конструктор" в навигации

**Файл:** `packages/owner-web/src/components/cabinet-layout.tsx`

**Код кнопки:**
```tsx
// Строка 14: Определение секции
{ key: 'constructor', label: 'Конструктор', icon: '⚙️' },

// Строки 147-165: Рендеринг кнопки
{sections.map((section) => {
  const href = currentBotId ? `/cabinet/${currentBotId}/${section.key}` : '/cabinet';
  const active = pathname.startsWith(href);
  const icon = (section as any).icon;
  return (
    <button
      key={section.key}
      onClick={() => router.push(href)}  // ← Обработчик клика
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground'
      }`}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {section.label}
    </button>
  );
})}
```

**URL после клика:**
- Формат: `/cabinet/{botId}/constructor`
- Пример: `/cabinet/b9e0ca48-c9e3-4b26-a6f7-ac4322a2a671/constructor`

**Обработчик:** `router.push(href)` из `next/navigation`

---

## 2. Структура файлов

### (a) Компонент меню/кнопки "Конструктор"

**Файл:** `packages/owner-web/src/components/cabinet-layout.tsx`
- **"use client":** ✅ Да (строка 1)
- **Динамический импорт:** ❌ Нет
- **window/document/localStorage:** ✅ Да (`document.addEventListener` в `useHotkeys`, строка 37, 46, 49)
- **Telegram.WebApp:** ❌ Нет

### (b) Page route конструктора

**Файл:** `packages/owner-web/src/app/cabinet/[botId]/constructor/page.tsx`

```tsx
import { BotConstructorClient } from './constructor-client';
import { isOwnerWizardEnabled } from '@/lib/flags';

export default function BotConstructorPage() {
  const wizardEnabled = isOwnerWizardEnabled();
  
  return <BotConstructorClient wizardEnabled={wizardEnabled} />;
}
```

- **"use client":** ❌ Нет (Server Component)
- **Динамический импорт:** ❌ Нет
- **window/document/localStorage:** ❌ Нет
- **Telegram.WebApp:** ❌ Нет

### (c) Главный компонент конструктора

**Файл:** `packages/owner-web/src/app/cabinet/[botId]/constructor/constructor-client.tsx`

- **"use client":** ✅ Да (строка 1)
- **Динамический импорт:** ❌ Нет
- **window/document/localStorage:** ❌ Нет (но есть `useRef`, `useState`, `useEffect`)
- **Telegram.WebApp:** ❌ Нет

**Ключевые хуки:**
- `useParams()` - получение `botId` из URL
- `useQuery()` - загрузка данных бота
- `useMutation()` - сохранение схемы
- `useEffect()` - инициализация схемы (строки 65-106)
- `useRef()` - отслеживание монтирования (`isMountedRef`)

### (d) Hooks/Store

**Файл:** `packages/owner-web/src/hooks/use-owner-auth.ts`

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerMe } from '@/lib/api';

export function useOwnerAuth() {
  return useQuery({
    queryKey: ['owner-me'],
    queryFn: ownerMe,
    retry: false,
  });
}
```

**Используется в:** `cabinet-layout.tsx` (строка 58)

### (e) API wrapper

**Файл:** `packages/owner-web/src/lib/api.ts`

**Функция загрузки бота:**
```tsx
// Строка 171-187
export async function ownerFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  // Получает CSRF токен
  const csrfToken = await getCsrfToken();
  
  return request<T>(normalizeOwnerPath(path), {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'X-CSRF-Token': csrfToken,
    },
  });
}
```

**Функция обновления схемы:**
```tsx
// Строка 290-295
export async function ownerUpdateBotSchema(botId: string, schema: any) {
  return request<{ ok: boolean }>(normalizeOwnerPath(`/api/owner/bots/${botId}/schema`), {
    method: 'PUT',
    body: JSON.stringify({ schema }),
  });
}
```

**Endpoint:** `PUT /api/core/api/owner/bots/{botId}/schema`

---

## 3. Потенциальные проблемы с React Error #310

### Проблема: Обновление состояния после размонтирования

**Места, где может возникать:**

1. **useQuery в constructor-client.tsx (строка 39-45)**
   ```tsx
   const { data: botData, isLoading, error } = useQuery({
     queryKey: ['bot', botId],
     queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
     enabled: !!botId,
     retry: 1,
     staleTime: 30_000,
   });
   ```
   - **Риск:** React Query может обновить состояние после размонтирования, если запрос завершится после навигации

2. **useEffect с botData (строка 71-106)**
   ```tsx
   useEffect(() => {
     if (!botData) return;
     
     if (botData.schema) {
       // ... обновление состояния через safeSetState
     } else {
       // ... создание пустой схемы
     }
   }, [botData]);
   ```
   - **Риск:** Если `botData` изменится после размонтирования, `useEffect` попытается обновить состояние

3. **useMutation onSuccess/onError (строка 47-63)**
   ```tsx
   onSuccess: () => {
     if (isMountedRef.current) {
       queryClient.invalidateQueries({ queryKey: ['bot', botId] });
       safeSetState(setHasChanges, false);
       safeToast(toast.success, 'Схема бота обновлена');
     }
   },
   ```
   - **Защита:** ✅ Есть проверка `isMountedRef.current`

4. **React Query invalidation (строка 53)**
   ```tsx
   queryClient.invalidateQueries({ queryKey: ['bot', botId] });
   ```
   - **Риск:** Может вызвать обновление других компонентов, которые уже размонтированы

### Текущие защиты:

✅ `isMountedRef` используется для проверки монтирования
✅ `safeSetState` и `safeToast` проверяют `isMountedRef.current`
✅ Cleanup функция устанавливает `isMountedRef.current = false` (строка 65-69)

### Потенциальные проблемы:

❌ **React Query может обновить состояние после размонтирования**, даже если компонент размонтирован
❌ **queryClient.invalidateQueries** может вызвать обновления в других компонентах
❌ **useQuery может завершиться после размонтирования**, если запрос долгий

---

## 4. Network запросы

### Ожидаемые запросы после клика "Конструктор":

1. **GET /api/core/api/owner/bots/{botId}**
   - **Статус:** 200 OK (успех) или 401/403/500 (ошибка)
   - **Когда:** При монтировании `BotConstructorClient`, через `useQuery`
   - **Ответ:** `{ botId, name, schema, ... }`

2. **GET /api/core/api/owner/auth/me** (если не закэширован)
   - **Статус:** 200 OK или 401
   - **Когда:** При загрузке `CabinetLayout` через `useOwnerAuth`

### Возможные ошибки:

- **401 Unauthorized:** Сессия истекла → редирект на `/login`
- **403 Forbidden:** Нет доступа к боту
- **500 Internal Server Error:** Ошибка на сервере
- **Timeout:** Запрос превысил 3000ms (см. `api.ts`, строка 36)

---

## 5. Инструкции для диагностики

### Шаг 1: Включить Source Maps

1. Откройте DevTools (F12)
2. Settings (⚙️) → Sources
3. Включите "Enable JavaScript source maps"
4. Включите "Enable CSS source maps"

### Шаг 2: Получить полный лог ошибки

1. Откройте DevTools → Console
2. Очистите консоль (🚫)
3. Кликните на кнопку "Конструктор"
4. Скопируйте **ВСЕ** сообщения из консоли:
   - Ошибки (красные)
   - Предупреждения (желтые)
   - Логи (белые)
   - Stack traces

### Шаг 3: Получить original stack trace

1. В консоли кликните на ошибку
2. Откройте вкладку "Sources"
3. Найдите файл из stack trace (должен быть `.tsx` или `.ts`)
4. Скопируйте полный stack trace с номерами строк

### Шаг 4: Проверить Network запросы

1. Откройте DevTools → Network
2. Очистите запросы (🚫)
3. Кликните на кнопку "Конструктор"
4. Найдите запросы:
   - `/api/core/api/owner/bots/{botId}`
   - `/api/core/api/owner/auth/me`
5. Проверьте:
   - **Status code** (200, 401, 403, 500)
   - **Response body** (есть ли ошибки)
   - **Timing** (сколько времени занял запрос)

### Шаг 5: Проверить в dev режиме

```bash
cd packages/owner-web
pnpm dev
```

1. Откройте `http://localhost:3000`
2. Войдите в систему
3. Откройте конструктор
4. Скопируйте **неминифицированную** ошибку из консоли

---

## 6. Чек-лист для проверки

- [ ] Source Maps включены в DevTools
- [ ] Полный лог ошибки скопирован из Console
- [ ] Original stack trace с переходами в TS/TSX файлы
- [ ] URL после клика на "Конструктор" записан
- [ ] Network запросы проверены (статусы, тела ответов)
- [ ] Ошибка воспроизведена в `pnpm dev` режиме
- [ ] Неминифицированная ошибка скопирована

---

## 7. Дополнительная информация

### Версии зависимостей:

- **Next.js:** 15.0.3
- **React:** 18.3.1
- **React-DOM:** 18.3.1
- **@tanstack/react-query:** 5.62.7

### Структура компонентов:

```
CabinetLayout (client)
  └─ BotConstructorPage (server)
      └─ BotConstructorClient (client)
          ├─ useQuery (загрузка бота)
          ├─ useMutation (сохранение схемы)
          └─ useEffect (инициализация схемы)
```

### Поток выполнения:

1. Клик на "Конструктор" → `router.push('/cabinet/{botId}/constructor')`
2. Next.js загружает `page.tsx` (Server Component)
3. Рендерится `BotConstructorClient` (Client Component)
4. `useQuery` запускает запрос `GET /api/owner/bots/{botId}`
5. `useEffect` обрабатывает `botData` и обновляет состояние
6. **Ошибка #310 может возникнуть на шагах 4-5**, если компонент размонтирован до завершения запроса

---

## 8. Рекомендации для исправления

1. **Отменить запросы при размонтировании:**
   ```tsx
   const { data: botData, isLoading, error } = useQuery({
     queryKey: ['bot', botId],
     queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
     enabled: !!botId && isMountedRef.current,
     retry: 1,
     staleTime: 30_000,
   });
   ```

2. **Использовать AbortController для отмены запросов:**
   ```tsx
   useEffect(() => {
     const controller = new AbortController();
     // ... запрос с signal: controller.signal
     return () => controller.abort();
   }, []);
   ```

3. **Проверять монтирование перед invalidateQueries:**
   ```tsx
   onSuccess: () => {
     if (isMountedRef.current) {
       queryClient.invalidateQueries({ queryKey: ['bot', botId] });
     }
   },
   ```

