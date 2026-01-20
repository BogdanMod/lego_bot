# Установка webhook на Production URL

## Проблема

Webhook установлен на preview URL, который требует аутентификацию (401 Unauthorized).

## Решение

### Установите webhook на Production URL

Откройте в браузере:

```
https://api.telegram.org/bot8585269589:AAGNheAjAdj5p6FJ6Xi-NCZk-fW3g1wYFDQ/setWebhook?url=https://lego-bot-core.vercel.app/api/webhook
```

Должен вернуться:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### Проверьте установку

```
https://api.telegram.org/bot8585269589:AAGNheAjAdj5p6FJ6Xi-NCZk-fW3g1wYFDQ/getWebhookInfo
```

Должно быть:
- `url`: `https://lego-bot-core.vercel.app/api/webhook` (production URL)
- `pending_update_count`: должно уменьшиться после обработки
- `last_error_message`: должно быть пустым или отсутствовать

### Протестируйте бота

После установки:
1. Отправьте команду `/start` боту
2. Бот должен ответить
3. Проверьте логи Vercel - должны появиться записи о получении webhook

