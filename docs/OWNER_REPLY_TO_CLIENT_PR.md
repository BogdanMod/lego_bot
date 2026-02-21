# PR: Кнопка «Ответить клиенту» в Owner Web

## Чеклист для проверки

- [ ] Пользователь пишет боту → в таблице `customers` появляется/обновляется запись с `telegram_user_id` (ingest в Router).
- [ ] В аналитике (режим «Анализ», таблица записей/заявок) в строке lead/appointment с `customer_id` отображается кнопка «Ответить».
- [ ] По нажатию «Ответить» открывается модал: textarea + «Отправить» / «Отмена». После отправки сообщение приходит клиенту в Telegram от бота.
- [ ] Если у клиента нет `telegram_user_id` (нельзя написать) → при отправке показывается понятная ошибка в UI: «Нельзя написать: клиент не доступен в Telegram».

## Коммиты (рекомендуемый порядок)

1. **customers telegram_user_id** — проверка: в Core схема `customers` уже содержит `telegram_user_id`; в Router при ingest в `upsertCustomer` передаётся `params.telegramUserId`.
2. **endpoint send message** — Core: `POST /api/owner/bots/:botId/customers/:customerId/message` (auth + CSRF + bot access); Router: `POST /internal/owner/send-customer-message` (x-internal-secret, отправка в Telegram, опционально запись в `bot_events`).
3. **UI кнопка + модал** — аналитика: в выборку добавлены `customerId` для leads/appointments; в таблице колонка «Действия» с кнопкой «Ответить»; модал с textarea и обработкой успеха/ошибки (toast).
