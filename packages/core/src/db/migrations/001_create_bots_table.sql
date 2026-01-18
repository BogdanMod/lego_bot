-- Создание таблицы bots
CREATE TABLE IF NOT EXISTS bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    token TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по user_id
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);

-- Индекс для поиска по token (для проверки уникальности)
CREATE INDEX IF NOT EXISTS idx_bots_token ON bots(token);

-- Комментарии к таблице
COMMENT ON TABLE bots IS 'Таблица для хранения информации о созданных ботах';
COMMENT ON COLUMN bots.id IS 'Уникальный идентификатор бота (UUID)';
COMMENT ON COLUMN bots.user_id IS 'Telegram ID пользователя, создавшего бота';
COMMENT ON COLUMN bots.token IS 'Токен бота (зашифрованный)';
COMMENT ON COLUMN bots.name IS 'Название бота';

