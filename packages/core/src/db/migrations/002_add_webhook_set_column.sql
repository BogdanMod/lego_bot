-- Добавление поля webhook_set в таблицу bots
ALTER TABLE bots ADD COLUMN IF NOT EXISTS webhook_set BOOLEAN DEFAULT FALSE;

-- Комментарий к полю
COMMENT ON COLUMN bots.webhook_set IS 'Флаг, указывающий, настроен ли webhook для бота';

