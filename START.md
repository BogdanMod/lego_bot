# 🚀 Команды для запуска продукта

## Быстрый старт (все сервисы)

### 1. Запуск базы данных (PostgreSQL и Redis)

```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot
docker-compose up -d postgres redis
```

Проверка:
```bash
docker-compose ps
```

---

### 2. Установка зависимостей (если еще не установлены)

```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot
npm install
```

---

### 3. Запуск всех сервисов

**Вариант A: Запуск всех сервисов одновременно (рекомендуется)**

```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot
npm run dev
```

Это запустит:
- Core бот (порт 3000)
- Router (порт 3001)
- Frontend (порт 5173)
- Shared (компиляция TypeScript)

---

**Вариант B: Запуск каждого сервиса в отдельном терминале**

#### Терминал 1: Router
```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot/packages/router
npm run dev
```

#### Терминал 2: Core бот
```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot/packages/core
npm run dev
```

#### Терминал 3: Frontend (опционально)
```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot/packages/frontend
npm run dev
```

---

### 4. Запуск Cloudflare Tunnel

**В отдельном терминале:**

```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot
cloudflared tunnel --url http://localhost:3001
```

Или используйте скрипт:
```bash
./start-cloudflare-tunnel.sh
```

---

## Полная последовательность запуска

### Шаг 1: Проверка .env

Убедитесь, что в `.env` есть все необходимые переменные:

```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot
cat .env | grep -E "(TELEGRAM_BOT_TOKEN|DATABASE_URL|ENCRYPTION_KEY|ROUTER_URL)"
```

Если `ENCRYPTION_KEY` отсутствует, сгенерируйте:
```bash
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
```

### Шаг 2: Запуск базы данных

```bash
docker-compose up -d postgres redis
```

Подождите 5-10 секунд для инициализации.

### Шаг 3: Запуск всех сервисов

```bash
npm run dev
```

### Шаг 4: Запуск Cloudflare Tunnel

**В новом терминале:**
```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot
cloudflared tunnel --url http://localhost:3001
```

---

## Проверка работоспособности

### 1. Проверка базы данных

```bash
docker-compose ps
```

Должны быть запущены: `postgres` и `redis`

### 2. Проверка локальных сервисов

```bash
# Core бот
curl http://localhost:3000/health

# Router
curl http://localhost:3001/health
```

### 3. Проверка публичного URL

```bash
curl https://vancouver-dimensional-pushed-condo.trycloudflare.com/health
```

### 4. Проверка бота в Telegram

Отправьте `/start` боту в Telegram.

---

## Остановка всех сервисов

### Остановка npm сервисов
Нажмите `Ctrl+C` в терминале, где запущен `npm run dev`

### Остановка Cloudflare Tunnel
Нажмите `Ctrl+C` в терминале с туннелем, или:
```bash
pkill -f "cloudflared tunnel"
```

### Остановка базы данных
```bash
docker-compose down
```

Или остановить все:
```bash
docker-compose down
pkill -f "cloudflared tunnel"
pkill -f "tsx watch"
```

---

## Troubleshooting

### Роутер не запускается

**Ошибка: порт 3001 занят**
```bash
lsof -ti:3001 | xargs kill -9
```

### База данных не подключается

```bash
# Перезапуск контейнеров
docker-compose restart postgres redis

# Проверка логов
docker-compose logs postgres
```

### Cloudflare Tunnel не работает

```bash
# Остановить все туннели
pkill -f "cloudflared tunnel"

# Запустить заново
cloudflared tunnel --url http://localhost:3001
```

### ENCRYPTION_KEY не установлен

```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
```

---

## Полезные команды

### Просмотр логов

```bash
# Логи Docker
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Проверка портов

```bash
# Какие порты используются
lsof -i :3000
lsof -i :3001
lsof -i :5433
lsof -i :6379
```

### Перезапуск всех сервисов

```bash
# Остановить все
docker-compose down
pkill -f "cloudflared tunnel"
pkill -f "tsx watch"

# Запустить заново
docker-compose up -d postgres redis
npm run dev
# В отдельном терминале:
cloudflared tunnel --url http://localhost:3001
```

