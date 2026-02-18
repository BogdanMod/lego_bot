# Полная диагностика React Error #310 в Конструкторе

## 1. Stack Trace (требуется от пользователя)

### Инструкции для получения stack trace:

1. **Включить Source Maps:**
   - Откройте DevTools (F12)
   - Settings (⚙️) → Sources
   - Включите "Enable JavaScript source maps"

2. **Получить полный stack trace:**
   - Откройте Console
   - Очистите консоль (🚫)
   - Кликните на кнопку "Конструктор"
   - Скопируйте **ВСЕ** строки ошибки, включая:
     ```
     Error: Minified React error #310; visit https://react.dev/errors/310
     at ...
     at ...
     at ...
     ```

3. **Воспроизвести в dev режиме:**
   ```bash
   cd packages/owner-web
   pnpm dev
   ```
   - Откройте `http://localhost:3000`
   - Войдите в систему
   - Кликните на "Конструктор"
   - Скопируйте **неминифицированную** ошибку

---

## 2. Полный код файлов

### (a) constructor-client.tsx

```tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerFetch, ownerUpdateBotSchema, type ApiError } from '@/lib/api';
import type { BotSchema } from '@/lib/templates/types';

type ViewMode = 'edit' | 'preview' | 'graph';

export function BotConstructorClient({ wizardEnabled }: { wizardEnabled: boolean }) {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  const queryClient = useQueryClient();
  const isMountedRef = useRef(true);
  
  // Diagnostic logging
  console.log('[constructor] render', { 
    botId, 
    wizardEnabled, 
    hasParams: !!params,
    renderId: Math.random().toString(36).substring(7)
  });
  
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [schema, setSchema] = useState<BotSchema | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [previewState, setPreviewState] = useState<string | null>(null);
  const [draggedButtonIndex, setDraggedButtonIndex] = useState<number | null>(null);
  
  // Safe state setters that check if component is mounted
  const safeSetState = <T,>(setter: (value: T | ((prev: T) => T)) => void, value: T | ((prev: T) => T)) => {
    if (isMountedRef.current) {
      setter(value);
    }
  };
  
  const safeToast = (fn: typeof toast.success, message: string) => {
    if (isMountedRef.current) {
      fn(message);
    }
  };

  const { data: botData, isLoading, error } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => {
      console.log('[constructor] useQuery fetch started', { botId });
      return ownerFetch<any>(`/api/owner/bots/${botId}`);
    },
    enabled: !!botId,
    retry: 1,
    staleTime: 30_000,
  });
  
  console.log('[constructor] useQuery state', { 
    isLoading, 
    hasData: !!botData, 
    hasError: !!error,
    botId 
  });

  const updateSchemaMutation = useMutation({
    mutationFn: async (newSchema: BotSchema) => {
      return ownerUpdateBotSchema(botId, newSchema);
    },
    onSuccess: () => {
      if (isMountedRef.current) {
        queryClient.invalidateQueries({ queryKey: ['bot', botId] });
        safeSetState(setHasChanges, false);
        safeToast(toast.success, 'Схема бота обновлена');
      }
    },
    onError: (error: ApiError) => {
      if (isMountedRef.current) {
        safeToast(toast.error, error?.message || 'Ошибка при сохранении схемы');
      }
    },
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    console.log('[constructor] useEffect[botData] triggered', { 
      hasBotData: !!botData, 
      hasSchema: !!botData?.schema,
      botId 
    });
    
    if (!botData) return;
    
    if (botData.schema) {
      const loadedSchema = botData.schema as BotSchema;
      
      // Validate it's a proper schema
      if (loadedSchema && typeof loadedSchema === 'object' && loadedSchema.states && loadedSchema.initialState) {
        safeSetState(setSchema, loadedSchema);
        safeSetState(setSelectedState, (prev) => prev || loadedSchema.initialState);
        safeSetState(setPreviewState, (prev) => prev || loadedSchema.initialState);
      } else {
        console.error('Invalid schema structure:', botData);
        safeToast(toast.error, 'Неверная структура схемы бота. Создайте схему через Wizard.');
      }
    } else {
      // Bot exists but has no schema - create empty one
      const emptySchema: BotSchema = {
        version: 1,
        initialState: 'start',
        states: {
          start: {
            message: 'Добро пожаловать!',
            buttons: [],
          },
        },
      };
      safeSetState(setSchema, emptySchema);
      safeSetState(setSelectedState, (prev) => prev || 'start');
      safeSetState(setPreviewState, (prev) => prev || 'start');
      safeSetState(setHasChanges, true);
      safeToast(toast.info, 'Создана пустая схема. Настройте бота и сохраните.');
    }
  }, [botData]);

  // ... остальной код (см. полный файл выше)
}
```

**Хуки в порядке использования:**
1. `useParams()` - строка 13
2. `useRouter()` - строка 14
3. `useQueryClient()` - строка 16
4. `useRef()` - строка 17
5. `useState()` x5 - строки 19-24
6. `useQuery()` - строка 39
7. `useMutation()` - строка 47
8. `useEffect()` x2 - строки 65, 71
9. `useMemo()` - строка 269

**Всего хуков: 13**

### (b) page.tsx

```tsx
import { BotConstructorClient } from './constructor-client';
import { isOwnerWizardEnabled } from '@/lib/flags';

export default function BotConstructorPage() {
  const wizardEnabled = isOwnerWizardEnabled();
  
  return <BotConstructorClient wizardEnabled={wizardEnabled} />;
}
```

**Хуки:** 0 (Server Component)

### (c) Импорты первого уровня в constructor-client.tsx

**Из `@/lib/api`:**
- `ownerFetch` - функция для API запросов
- `ownerUpdateBotSchema` - функция для обновления схемы
- `type ApiError` - тип ошибки

**Из `@/lib/templates/types`:**
- `type BotSchema` - тип схемы бота

**Из React:**
- `useState`, `useEffect`, `useMemo`, `useRef` - стандартные хуки

**Из `@tanstack/react-query`:**
- `useQuery`, `useMutation`, `useQueryClient` - хуки для запросов

**Из `next/navigation`:**
- `useParams`, `useRouter` - хуки Next.js

**Из `sonner`:**
- `toast` - для уведомлений

### (d) cabinet-layout.tsx

```tsx
'use client';

import { ownerFetch, ownerLogout } from '@/lib/api';
import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { useSSEStream } from '@/hooks/use-sse-stream';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { BotSelector } from '@/components/bot-selector';
import { CommandPalette } from '@/components/command-palette';
import { i18n } from '@/lib/i18n';

const sections = [
  { key: 'overview', label: i18n.nav.overview },
  { key: 'constructor', label: 'Конструктор', icon: '⚙️' },
  // ... остальные секции
];

export function CabinetLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { data, isLoading, isError } = useOwnerAuth();

  const currentBotId = params?.botId as string | undefined;
  const activeBot = data?.bots?.find((b) => b.botId === currentBotId) || data?.bots?.[0];
  
  useHotkeys(currentBotId);
  useSSEStream(currentBotId);

  // ... остальной код

  return (
    <>
      <CommandPalette botId={currentBotId} />
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        {/* ... */}
        {sections.map((section) => {
          const href = currentBotId ? `/cabinet/${currentBotId}/${section.key}` : '/cabinet';
          const active = pathname.startsWith(href);
          const icon = (section as any).icon;
          return (
            <button
              key={section.key}
              onClick={() => router.push(href)}  // ← Обработчик клика
              className={/* ... */}
            >
              {icon && <span className="mr-2">{icon}</span>}
              {section.label}
            </button>
          );
        })}
        {/* ... */}
      </div>
    </>
  );
}
```

---

## 3. Git Diff/Commit

### Первый коммит, добавивший конструктор

**Commit:** `8ad71eb` - `feat(owner-web): add bot constructor with visual editor for states, messages, and buttons`

```bash
git show 8ad71eb
```

**Файлы, добавленные в этом коммите:**
- `packages/owner-web/src/app/cabinet/[botId]/constructor/page.tsx`
- `packages/owner-web/src/app/cabinet/[botId]/constructor/constructor-client.tsx`

**Изменения в существующих файлах:**
- `packages/owner-web/src/components/cabinet-layout.tsx` - добавлена секция `constructor`

### Последующие коммиты с исправлениями:

1. `6e7dfaf` - `feat(owner-web): enhance bot constructor with preview, graph visualization, drag & drop, and fix schema loading`
2. `19582fe` - `fix(owner-web): fix constructor client-side errors - add null checks and safe schema access`
3. `2982f44` - `fix(owner-web): fix React error #310 - prevent state updates after unmount in constructor`
4. `7ba0b7e` - `fix(owner-web): comprehensive fix for React error #310 - use useRef for mount tracking and safe state setters`
5. `737497d` - `fix(owner-web): fix remaining setViewMode call in constructor`
6. `3b1f899` - `fix(owner-web): fix setViewMode('edit') call in constructor`

---

## 4. Логи рендеров

### Добавленное логирование:

В `constructor-client.tsx` добавлены следующие логи:

1. **При каждом рендере:**
   ```tsx
   console.log('[constructor] render', { 
     botId, 
     wizardEnabled, 
     hasParams: !!params,
     renderId: Math.random().toString(36).substring(7)
   });
   ```

2. **При изменении состояния useQuery:**
   ```tsx
   console.log('[constructor] useQuery state', { 
     isLoading, 
     hasData: !!botData, 
     hasError: !!error,
     botId 
   });
   ```

3. **При запуске fetch:**
   ```tsx
   console.log('[constructor] useQuery fetch started', { botId });
   ```

4. **При срабатывании useEffect:**
   ```tsx
   console.log('[constructor] useEffect[botData] triggered', { 
     hasBotData: !!botData, 
     hasSchema: !!botData?.schema,
     botId 
   });
   ```

### Ожидаемый вывод для первого рендера:

```
[constructor] render { botId: "xxx", wizardEnabled: true, hasParams: true, renderId: "abc123" }
[constructor] useQuery state { isLoading: true, hasData: false, hasError: false, botId: "xxx" }
[constructor] useQuery fetch started { botId: "xxx" }
```

### Ожидаемый вывод для второго рендера:

```
[constructor] render { botId: "xxx", wizardEnabled: true, hasParams: true, renderId: "def456" }
[constructor] useQuery state { isLoading: false, hasData: true, hasError: false, botId: "xxx" }
[constructor] useEffect[botData] triggered { hasBotData: true, hasSchema: true, botId: "xxx" }
```

**Если количество хуков изменилось между рендерами, будет ошибка #310.**

---

## 5. Network запросы

### Ожидаемые запросы после клика "Конструктор":

#### 1. GET /api/core/api/owner/bots/{botId}

**URL:** `https://owner-web-production-xxxx.up.railway.app/api/core/api/owner/bots/{botId}`

**Headers:**
```
GET /api/core/api/owner/bots/{botId} HTTP/1.1
Host: owner-web-production-xxxx.up.railway.app
Cookie: owner_session=...
Content-Type: application/json
credentials: include
```

**Ожидаемый статус:** 200 OK

**Ожидаемое тело ответа:**
```json
{
  "botId": "b9e0ca48-c9e3-4b26-a6f7-ac4322a2a671",
  "name": "My Bot",
  "schema": {
    "version": 1,
    "initialState": "start",
    "states": {
      "start": {
        "message": "Добро пожаловать!",
        "buttons": []
      }
    }
  },
  "metadata": {},
  "createdAt": "2026-02-17T...",
  "updatedAt": "2026-02-17T..."
}
```

**Возможные ошибки:**
- **401 Unauthorized:** Сессия истекла
- **403 Forbidden:** Нет доступа к боту
- **500 Internal Server Error:** Ошибка на сервере
- **Timeout:** Запрос превысил 3000ms

#### 2. GET /api/core/api/owner/auth/me (если не закэширован)

**URL:** `https://owner-web-production-xxxx.up.railway.app/api/core/api/owner/auth/me`

**Ожидаемый статус:** 200 OK

**Ожидаемое тело ответа:**
```json
{
  "user": {
    "telegramUserId": 123456789,
    "username": "username",
    "firstName": "First",
    "lastName": "Last"
  },
  "bots": [
    {
      "botId": "b9e0ca48-c9e3-4b26-a6f7-ac4322a2a671",
      "name": "My Bot",
      "role": "owner"
    }
  ],
  "csrfToken": "xxx"
}
```

---

## 6. Анализ проблемы React Error #310

### Ошибка #310: "Rendered more hooks than during the previous render"

**Причина:** Количество хуков изменилось между рендерами.

### Потенциальные проблемы в коде:

1. **Условное использование хуков:**
   - ❌ Нет условных хуков в `constructor-client.tsx`
   - ✅ Все хуки вызываются на верхнем уровне

2. **Ранний return перед хуками:**
   - ❌ В `constructor-client.tsx` есть ранние returns (строки 106-137)
   - ✅ Но они **после** всех хуков, не перед

3. **Динамический импорт компонентов:**
   - ❌ Нет динамических импортов

4. **Изменение количества хуков в зависимости от props:**
   - ❌ `wizardEnabled` не влияет на количество хуков

5. **Проблема с React Query:**
   - ⚠️ `useQuery` может быть отключен через `enabled: !!botId`
   - ⚠️ Но это не должно менять количество хуков

### Возможная причина:

**Проблема может быть в том, что компонент рендерится дважды с разными условиями:**

1. **Первый рендер:** `botId` undefined → `useQuery` disabled
2. **Второй рендер:** `botId` определен → `useQuery` enabled

Но `useQuery` всегда вызывается, независимо от `enabled`, так что это не должно быть проблемой.

**Более вероятная причина:** Компонент размонтируется и монтируется заново, и между рендерами меняется структура компонента.

---

## 7. Инструкции для диагностики

### Шаг 1: Воспроизвести в dev режиме

```bash
cd packages/owner-web
pnpm dev
```

### Шаг 2: Открыть DevTools

1. F12 → Console
2. Включить Source Maps (Settings → Sources)
3. Очистить консоль

### Шаг 3: Кликнуть на "Конструктор"

### Шаг 4: Скопировать логи

Скопируйте все логи, начинающиеся с `[constructor]`:

```
[constructor] render { ... }
[constructor] useQuery state { ... }
[constructor] useQuery fetch started { ... }
[constructor] useEffect[botData] triggered { ... }
```

### Шаг 5: Скопировать stack trace

Скопируйте полный stack trace ошибки, включая все строки `at ...`.

### Шаг 6: Проверить Network

1. DevTools → Network
2. Найти запросы:
   - `/api/core/api/owner/bots/{botId}`
   - `/api/core/api/owner/auth/me`
3. Проверить:
   - Status code
   - Response body
   - Timing

---

## 8. Чек-лист

- [ ] Source Maps включены
- [ ] Логи `[constructor] render` скопированы (первый и второй рендер)
- [ ] Stack trace скопирован (полный, со всеми `at ...`)
- [ ] Network запросы проверены (статусы, тела ответов)
- [ ] Ошибка воспроизведена в `pnpm dev`
- [ ] Неминифицированная ошибка скопирована

