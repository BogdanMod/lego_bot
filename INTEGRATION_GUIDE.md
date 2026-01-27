# Руководство по интеграциям

## Google Sheets через Apps Script

1. Откройте Google Sheets и создайте таблицу.
2. Меню **Расширения → Apps Script**.
3. Вставьте код:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Лист1');
  const data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    data.timestamp,
    data.user_id,
    data.user?.first_name || '',
    data.user?.phone_number || '',
    data.user?.email || ''
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. Нажмите **Deploy → New deployment**.
5. Тип: **Web app**. Доступ: **Anyone**.
6. Скопируйте URL деплоя — это и есть webhook URL.
7. В Mini App включите webhook для нужного состояния и вставьте URL.

## Telegram канал

1. Создайте бота через @BotFather.
2. Добавьте бота администратором в канал.
3. Используйте Bot API `sendMessage`:

```
POST https://api.telegram.org/bot<token>/sendMessage
{
  "chat_id": "@channel_name",
  "text": "📩 Новая запись\n👤 {first_name}\n📱 {phone_number}\n📧 {email}"
}
```

4. Проверьте права бота и правильность `chat_id`.

## Custom webhook endpoint

Webhook получает JSON:

```json
{
  "bot_id": "uuid",
  "user_id": 123456,
  "state_key": "confirm_booking",
  "timestamp": "2026-01-27T12:00:00.000Z",
  "user": {
    "first_name": "Анна",
    "phone_number": "+79990001122",
    "email": "anna@example.com"
  },
  "context": {
    "previous_state": "collect_contact"
  }
}
```

### Подпись запроса

Если задан `signingSecret`, заголовки:
- `X-Bot-Timestamp`
- `X-Bot-Signature` = HMAC-SHA256 от `${timestamp}.${body}`

На стороне сервиса проверяйте подпись и отклоняйте неверные запросы.

## Troubleshooting

- **401/403**: проверьте URL, токены, права доступа.
- **Timeout**: уменьшите время ответа, проверьте сетевую доступность.
- **5xx**: ошибка внешнего сервиса — смотрите логи webhook.
- **Signature invalid**: убедитесь в совпадении `signingSecret` и формуле подписи.
