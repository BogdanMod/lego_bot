# Mini App - Dialogue Constructor

Telegram Mini App для визуального создания и редактирования схем диалогов ботов.

## Технологии

- **React 18** - UI библиотека
- **TypeScript** - типизация
- **Vite** - сборщик
- **Telegram WebApp SDK** - интеграция с Telegram
- **React Router** - роутинг
- **TON Connect** - интеграция с TON для платежей

## Установка

```bash
npm install
```

## Разработка

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:5174`

## Сборка

```bash
npm run build
```

## Настройка

1. Создайте `.env` на основе `.env.example`:

```env
VITE_API_URL=https://lego-bot-core.vercel.app
VITE_TON_CONNECT_MANIFEST_URL=https://ваш-домен.vercel.app/tonconnect-manifest.json
```

2. Обновите `public/tonconnect-manifest.json` с правильными URL вашего домена.

3. Настройте бота через @BotFather:

```
/newbot - создать бота
/setmenubutton - установить кнопку меню с web_app
```

## Структура

```
src/
├── components/     # React компоненты
│   ├── SchemaEditor.tsx  # Редактор схемы
│   ├── StateEditor.tsx   # Редактор состояния
│   └── Preview.tsx       # Предпросмотр
├── pages/          # Страницы приложения
│   ├── BotList.tsx       # Список ботов
│   ├── BotEditor.tsx     # Редактор бота
│   └── Templates.tsx     # Шаблоны
├── utils/          # Утилиты
│   └── api.ts      # API клиент
└── types/          # TypeScript типы
```

## Деплой на Vercel

### Быстрый старт:

1. **Подключите репозиторий в Vercel:**
   - Перейдите на [vercel.com](https://vercel.com)
   - Нажмите "Add New Project"
   - Выберите репозиторий `lego_bot`

2. **Настройте проект:**
   - **Root Directory**: `packages/mini-app`
   - **Framework**: Vite (определится автоматически)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Добавьте переменные окружения:**
   - `VITE_API_URL` = `https://lego-bot-core.vercel.app`
   - `VITE_TON_CONNECT_MANIFEST_URL` = `https://your-project.vercel.app/tonconnect-manifest.json`

4. **Деплой:**
   - Нажмите "Deploy"
   - После деплоя обновите `tonconnect-manifest.json` с вашим URL
   - Сделайте Redeploy

**Подробная инструкция:** см. [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)

### Через CLI:

```bash
cd packages/mini-app
vercel
vercel --prod
```

### После деплоя:

1. Скопируйте URL вашего проекта (например: `https://lego-bot-mini-app.vercel.app`)
2. Настройте бота через @BotFather (см. [BOT_SETUP.md](./BOT_SETUP.md))
3. Обновите `public/tonconnect-manifest.json` с правильным URL

