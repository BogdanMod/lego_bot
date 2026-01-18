# Настройка Cloudflare Tunnel для роутера

## ✅ Уже настроено

- ✅ URL добавлен в `.env`: `ROUTER_URL=https://vancouver-dimensional-pushed-condo.trycloudflare.com`
- ✅ Скрипт для запуска создан: `start-cloudflare-tunnel.sh`

## Запуск туннеля

### Вариант 1: Простой запуск (временный туннель)

В отдельном терминале:

```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot
cloudflared tunnel --url http://localhost:3001
```

Туннель будет работать пока запущен процесс.

### Вариант 2: Использование скрипта

```bash
cd /Users/bogdan.rudenko/Desktop/lego_bot
./start-cloudflare-tunnel.sh
```

### Вариант 3: Запуск в фоне

```bash
./start-cloudflare-tunnel.sh > cloudflare-tunnel.log 2>&1 &
```

Для остановки:
```bash
pkill -f "cloudflared tunnel"
```

## Проверка

1. **Проверьте доступность туннеля:**
   ```bash
   curl https://vancouver-dimensional-pushed-condo.trycloudflare.com/health
   ```

   Ожидаемый ответ:
   ```json
   {
     "status": "ok",
     "service": "router",
     "timestamp": "..."
   }
   ```

2. **Проверьте, что роутер запущен:**
   ```bash
   curl http://localhost:3001/health
   ```

## Важно!

⚠️ **Туннель Cloudflare работает только пока запущен процесс**

- Если вы закроете терминал или остановите процесс, туннель прекратит работу
- URL изменится при следующем запуске (для trycloudflare.com)

## Настройка постоянного туннеля (опционально)

Если нужен постоянный URL, настройте именованный туннель:

1. Создайте туннель:
   ```bash
   cloudflared tunnel create router-tunnel
   ```

2. Конфигурация уже создана в `~/.cloudflared/config.yml`

3. Запустите именованный туннель:
   ```bash
   cloudflared tunnel run router-tunnel
   ```

## Использование в production

После настройки туннеля:

1. Обновите `ROUTER_URL` в `.env` (уже сделано ✅)
2. Перезапустите core сервис для применения изменений
3. Создайте нового бота или настройте webhook существующего:
   ```bash
   /setwebhook <bot_id>
   ```

## Автозапуск при старте системы (macOS)

Создайте LaunchAgent:

```bash
# Создайте plist файл
cat > ~/Library/LaunchAgents/com.cloudflared.router.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cloudflared.router</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/cloudflared</string>
        <string>tunnel</string>
        <string>--url</string>
        <string>http://localhost:3001</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/bogdan.rudenko/Desktop/lego_bot/cloudflare-tunnel.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/bogdan.rudenko/Desktop/lego_bot/cloudflare-tunnel-error.log</string>
</dict>
</plist>
EOF

# Загрузите агент
launchctl load ~/Library/LaunchAgents/com.cloudflared.router.plist

# Запустите сейчас
launchctl start com.cloudflared.router
```

Для остановки:
```bash
launchctl stop com.cloudflared.router
launchctl unload ~/Library/LaunchAgents/com.cloudflared.router.plist
```

