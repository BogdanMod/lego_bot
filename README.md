# Dialogue Constructor

Telegram-бот и Mini App для создания диалоговых конструкторов.

## Структура проекта

Проект организован как monorepo с использованием npm workspaces и Turbo:

```
dialogue-constructor/
├── packages/
│   ├── core/           # Основной сервер (Express + Telegraf)
│   ├── bot-router/     # Роутер для управления несколькими ботами
│   ├── frontend/       # Mini App на React + Vite
│   └── shared/         # Общие типы и утилиты
├── docker-compose.yml  # PostgreSQL и Redis
├── package.json        # Workspace конфигурация
└── README.md
```

## Требования

- Node.js >= 18.0.0
- Docker и Docker Compose
- npm или yarn

## Установка

1. Клонируйте репозиторий и перейдите в директорию проекта:
```bash
cd dialogue-constructor
```

2. Установите зависимости:
```bash
npm install
```

3. Скопируйте `.env.example` в `.env` и заполните необходимые переменные:
```bash
cp .env.example .env
```

4. Запустите PostgreSQL и Redis через Docker Compose:
```bash
docker-compose up -d
```

## Разработка

Запуск всех сервисов в режиме разработки:
```bash
npm run dev
```

Запуск отдельных пакетов:
```bash
# Core сервер
cd packages/core && npm run dev

# Bot Router
cd packages/bot-router && npm run dev

# Frontend
cd packages/frontend && npm run dev
```

## Сборка

Сборка всех пакетов:
```bash
npm run build
```

## Пакеты

### @dialogue-constructor/core
Основной сервер приложения, обрабатывает запросы от Telegram бота и предоставляет API.

### @dialogue-constructor/bot-router
Сервис для маршрутизации и управления несколькими ботами.

### @dialogue-constructor/frontend
React приложение для Mini App в Telegram.

### @dialogue-constructor/shared
Общие TypeScript типы и утилиты, используемые во всех пакетах.

## Переменные окружения

См. `.env.example` для списка всех необходимых переменных окружения.

Основные переменные:
- `TELEGRAM_BOT_TOKEN` - токен Telegram бота
- `DATABASE_URL` - строка подключения к PostgreSQL
- `REDIS_URL` - строка подключения к Redis

## Лицензия

MIT

