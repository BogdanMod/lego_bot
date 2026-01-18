# Router Service

Сервис для обработки webhook-ов от Telegram.

## Описание

Router сервис принимает POST запросы от Telegram API на `/webhook/:botId`, находит токен бота в базе данных по `botId`, расшифровывает его и отправляет стандартный ответ пользователю.

## Функциональность

- ✅ Прием webhook-ов от Telegram
- ✅ Поиск бота по ID в PostgreSQL
- ✅ Расшифровка токенов (AES-256)
- ✅ Отправка сообщений через Telegram API
- ✅ Логирование всех запросов
- ✅ Обработка ошибок

## Установка

```bash
cd packages/router
npm install
```

## Настройка

1. Скопируйте `.env.example` в `.env`:
```bash
cp .env.example .env
```

2. Заполните переменные окружения:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/dialogue_constructor
ENCRYPTION_KEY=your-encryption-key-here (минимум 32 символа)
PORT=3001
```

3. Сгенерируйте ключ шифрования:
```bash
openssl rand -base64 32
```

## Запуск

### Режим разработки

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```bash
docker-compose up -d
```

## API

### POST /webhook/:botId

Принимает webhook от Telegram API для указанного бота.

**Параметры:**
- `botId` (path) - UUID бота в базе данных

**Тело запроса:**
Стандартный объект Update от Telegram API

**Ответ:**
```json
{
  "status": "ok"
}
```

### GET /health

Проверка работоспособности сервиса.

**Ответ:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-18T...",
  "service": "router"
}
```

## Структура

```
packages/router/
├── src/
│   ├── index.ts              # Главный файл сервера
│   ├── db/
│   │   └── postgres.ts       # Подключение к PostgreSQL
│   ├── services/
│   │   └── telegram.ts       # Работа с Telegram API
│   └── utils/
│       └── encryption.ts     # Шифрование токенов
├── docker-compose.yml        # Docker конфигурация
├── Dockerfile               # Образ Docker
└── package.json
```

## Безопасность

- Токены хранятся в зашифрованном виде (AES-256-GCM)
- Используется пул соединений к PostgreSQL
- Все ошибки логируются без раскрытия чувствительных данных
- Ключ шифрования хранится в переменных окружения

