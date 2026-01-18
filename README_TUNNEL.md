# Быстрая настройка публичного URL для роутера

## Вариант 1: Ngrok (рекомендуется для разработки)

### Установка:
```bash
./scripts/install-ngrok.sh
```

### Регистрация:
1. Зарегистрируйтесь на https://ngrok.com (бесплатно)
2. Получите токен авторизации
3. Авторизуйтесь:
```bash
ngrok config add-authtoken YOUR_TOKEN
```

### Запуск:
```bash
./scripts/setup-ngrok.sh
```

### Получение URL:
```bash
./scripts/get-ngrok-url.sh
```

---

## Вариант 2: Быстрый туннель (без регистрации)

### Запуск интерактивного меню:
```bash
./scripts/quick-setup-tunnel.sh
```

Выберите один из вариантов:
- **localtunnel** - не требует регистрации
- **cloudflared** - стабилee.app
```

2. Перезапустите core бота:
```bash
# Ctrl+C и затем:
npm run dev
```

3. Создайте бота или настройте webhook:
```bash
/setwebhook <bot_id>
```

---

## Важные замечания:

⚠️ **Для Telegram webhook требуется HTTPS!**
- ngrok (HTTPS) ✅
- cloudflared (HTTPS) ✅
- localtunnel (HTTPS) ✅
- serveo (HTTPS) ✅

⚠️ **Бесплатные туннели могут менять URL:**
- ngrok (бесплатный) - меняет URL при перезапуске
- cloudflared - стабильный домен
- localtunnel - меняет URL при перезапуске

⚠️ **Для production используйте реальный домен!**
