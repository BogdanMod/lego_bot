# UI Components

Набор базовых UI компонентов на Tailwind CSS с поддержкой светлой и темной темы.

## Theme

Тема управляется через `ThemeProvider` и сохраняется в `localStorage` по ключу `lego-bot-theme`.

При изменении темы:
- выставляется `document.documentElement.setAttribute('data-theme', theme)`
- переключается класс `document.documentElement.classList.toggle('dark', theme === 'dark')`

## Button

Props:
- `variant?: 'primary' | 'secondary' | 'danger' | 'ghost'`
- `size?: 'sm' | 'md' | 'lg'`
- `icon?: React.ReactNode`
- `loading?: boolean`
- остальные props: `React.ButtonHTMLAttributes<HTMLButtonElement>`

Пример:
```tsx
import { Button } from '@/components/ui';

export function Buttons() {
  return (
    <div className="flex gap-2">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost">Ghost</Button>
      <Button loading>Loading</Button>
    </div>
  );
}
```

## Card

Props:
- `children: React.ReactNode`
- `className?: string`
- `onClick?: () => void`
- `gradient?: string`

Пример:
```tsx
import { Card } from '@/components/ui';

export function Cards() {
  return (
    <div className="grid gap-4">
      <Card>Default</Card>
      <Card gradient="from-indigo-500/20 to-rose-500/20">Gradient</Card>
    </div>
  );
}
```

## Input

Props:
- `label?: string`
- `error?: string`
- `icon?: React.ReactNode`
- остальные props: `React.InputHTMLAttributes<HTMLInputElement>`

Пример:
```tsx
import { Input } from '@/components/ui';

export function Inputs() {
  return (
    <div className="grid gap-4">
      <Input label="Name" placeholder="Type your name..." />
      <Input label="Email" placeholder="name@example.com" error="Invalid email" />
    </div>
  );
}
```

## Textarea

Props:
- `label?: string`
- `error?: string`
- `icon?: React.ReactNode`
- `rows?: number` (по умолчанию 4)
- остальные props: `React.TextareaHTMLAttributes<HTMLTextAreaElement>`

Пример:
```tsx
import { Textarea } from '@/components/ui';

export function Textareas() {
  return <Textarea label="Message" rows={6} placeholder="Type your message..." />;
}
```

## Badge

Props:
- `children: React.ReactNode`
- `variant?: 'success' | 'error' | 'warning' | 'info'`
- `size?: 'sm' | 'md'`

Пример:
```tsx
import { Badge } from '@/components/ui';

export function Badges() {
  return (
    <div className="flex gap-2">
      <Badge variant="success">Success</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  );
}
```

## Рекомендации по стилизации и кастомизации

- Для темы используйте `ThemeProvider` и `ThemeToggle`.
- Для локальной кастомизации используйте `className` там, где он доступен (например, в `Card`).
- Для цветов используйте Tailwind utility классы и CSS переменные из `src/index.css`.

