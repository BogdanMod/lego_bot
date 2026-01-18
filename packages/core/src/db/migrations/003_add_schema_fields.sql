-- Добавление полей для хранения схемы бота
ALTER TABLE bots ADD COLUMN IF NOT EXISTS schema JSONB DEFAULT NULL;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS schema_version INTEGER DEFAULT 0;

-- Комментарии к полям
COMMENT ON COLUMN bots.schema IS 'JSON схема диалогов бота (состояния, сообщения, кнопки)';
COMMENT ON COLUMN bots.schema_version IS 'Версия схемы для контроля изменений';

-- Индекс для поиска по schema (GIN индекс для JSONB)
CREATE INDEX IF NOT EXISTS idx_bots_schema ON bots USING GIN (schema);

