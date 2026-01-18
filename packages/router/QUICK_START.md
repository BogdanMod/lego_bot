# Быстрый старт: Получение публичного URL

## Самый простой способ (ngrok)

### 1. Установите ngrok

```bash
# macOS
brew install ngrok

# Или скачайте с https://ngrok.com/download
```

### 2. Зарегистрируйтесь

1. Перейдите на https://ngrok.com
2. Зарегистрируйтесь (бесплатно)
3. Скопируйте токен авторизации из dashboard

### 3. Авторизуйтесь

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 4. Запустите ngrok

В отдельном терминале:

```bash
ngrok http 3001
```

### 5. Скопируйте HTTPS URL

Вы увидите что-то вроде:
```
Forwarding  https://abc123def456.ngrok-free.app -> http://localhost:3001
```

Скопируйте HTTPS URL (без `/` в конце).

### 6. Обновите .env

В корневом `.env` файле:

```bash
ROUTER_URL=https://abc123def456.ngrok-free.app
```

### 7. Перезапустите core сервис

```bash
# Остановите (Ctrl+C) и запустите снова
npm run dev
```

### 8. Создайте бота или настройте webhook

Теперь при создании бота webhook автоматически настроится на ваш ngrok URL.

---

## Альтернатива: Cloudflare Tunnel (постоянный URL)

### 1. Установите cloudflared

```bash
brew install cloudflared
```

### 2. Запустите туннель

```bash
cloudflared tunnel --url http://localhost:3001
```

### 3. Скопируйте URL

Вы получите URL вида:
```
https://random-words-1234.trycloudflare.com
```

### 4. Обновите .env

```bash
ROUTER_URL=https://random-words-1234.trycloudflare.com
```

### 5. Перезапустите core сервис

---

## Важно!

⚠️ **URL ngrok меняется при каждом перезапуске**

Если вы перезапустите ngrok, вам нужно будет:
1. Получить новый URL
2. Обновить `ROUTER_URL` в `.env`
3. Перезапустить core сервис
4. Настроить webhook снова: `/setwebhook <bot_id>`

---

## Проверка

### 1. Проверьте, что роутер доступен:

```bash
curl https://your-ngrok-url.ngrok-free.app/health
```

Должен вернуть:
```json
{
  "status": "ok",
  "service": "router",
  "timestamp": "..."
}
```

### 2. Проверьте webhook в боте:

Используйте команду `/setwebhook <bot_id>` или создайте нового бота.

---

## Следующие шаги

Для production используйте:
- Реальный домен
- SSL сертификат (Let's Encrypt)
- Reverse proxy (nginx)

Подробная инструкция в `PUBLIC_URL_SETUP.md`

