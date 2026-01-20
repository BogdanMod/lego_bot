# Настройка Webhook прямо сейчас

## Текущая ситуация

Webhook не установлен (`"url": ""`), поэтому бот не получает обновления на Vercel.

## Решение: Установить webhook вручную

### Вариант 1: Через браузер (быстро)

1. Откройте в браузере (замените `YOUR_BOT_TOKEN` на ваш токен):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://lego-bot-core.vercel.app/api/webhook
   ```

2. Должен вернуться:
   ```json
   {"ok":true,"result":true,"description":"Webhook was set"}
   ```

3. Проверьте снова:
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo
   ```

4. Должно быть:
   ```json
   {
     "ok": true,
     "result": {
       "url": "https://lego-bot-core.vercel.app/api/webhook",
       "has_custom_certificate": false,
       "pending_update_count": 0
     }
   }
   ```

### Вариант 2: Через команду бота

**Важно:** Команда `/setup_webhook` работает только если бот уже получает обновления через webhook. Но так как webhook не установлен, команда не сработает.

Поэтому сначала используйте Вариант 1, а потом команда `/setup_webhook` будет работать для переустановки.

### Вариант 3: Через curl (если предпочитаете терминал)

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://lego-bot-core.vercel.app/api/webhook"
```

## После установки webhook

1. **Отправьте `/start` боту** — он должен ответить
2. **Проверьте логи Vercel** — должны появиться сообщения о получении обновлений
3. **Тестируйте команды** — `/create_bot`, `/my_bots`, `/help`

## Проверка

После установки webhook:
- `pending_update_count` должен стать 0 (обновления обработаются)
- `url` должен быть `https://lego-bot-core.vercel.app/api/webhook`

## Если не работает

1. Проверьте, что URL правильный (может отличаться в Vercel)
2. Убедитесь, что `/api/webhook` endpoint доступен (проверьте Vercel логи)
3. Проверьте, что `TELEGRAM_BOT_TOKEN` установлен в Vercel

