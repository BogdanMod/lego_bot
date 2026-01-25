/**
 * CRUD операции для таблицы bots
 * 
 * Боты хранятся в PostgreSQL с зашифрованными токенами.
 * Схемы диалогов хранятся в JSONB поле schema.
 */

import { Pool, PoolClient } from 'pg';
import { getPool, getPostgresClient } from './postgres';
import { BotSchema } from '@dialogue-constructor/shared';

export interface Bot {
  id: string;
  user_id: number;
  token: string;
  name: string;
  webhook_set: boolean;
  schema: BotSchema | null;
  schema_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBotData {
  user_id: number;
  token: string;
  name: string;
}

/**
 * Создать бота в базе данных
 */
export async function createBot(data: CreateBotData): Promise<Bot> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query<Bot>(
      `INSERT INTO bots (user_id, token, name, webhook_set, schema, schema_version)
       VALUES ($1, $2, $3, false, NULL, 0)
       RETURNING id, user_id, token, name, webhook_set, schema, schema_version, created_at, updated_at`,
      [data.user_id, data.token, data.name]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Получить всех ботов пользователя
 */
export async function getBotsByUserId(userId: number): Promise<Bot[]> {
  console.log('🔍 getBotsByUserId - userId:', userId);
  
  try {
    const client = await getPostgresClient();
    console.log('✅ PostgreSQL client obtained');
    
    try {
      const result = await client.query<Bot>(
        `SELECT id, user_id, token, name, webhook_set, schema, schema_version, created_at, updated_at
         FROM bots
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
      
      console.log('✅ Query executed, rows:', result.rows.length);
      return result.rows;
    } catch (queryError) {
      console.error('❌ Query error:', queryError);
      throw queryError;
    } finally {
      client.release();
      console.log('✅ PostgreSQL client released');
    }
  } catch (error) {
    console.error('❌ getBotsByUserId error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
}

/**
 * Получить бота по ID
 */
export async function getBotById(botId: string, userId: number): Promise<Bot | null> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query<Bot>(
      `SELECT id, user_id, token, name, webhook_set, schema, schema_version, created_at, updated_at
       FROM bots
       WHERE id = $1 AND user_id = $2`,
      [botId, userId]
    );
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Проверить, существует ли бот с таким токеном
 */
export async function botExistsByToken(token: string): Promise<boolean> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query(
      `SELECT 1 FROM bots WHERE token = $1 LIMIT 1`,
      [token]
    );
    
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Удалить бота
 */
export async function deleteBot(botId: string, userId: number): Promise<boolean> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query(
      `DELETE FROM bots WHERE id = $1 AND user_id = $2`,
      [botId, userId]
    );
    
    return result.rowCount ? result.rowCount > 0 : false;
  } finally {
    client.release();
  }
}

/**
 * Обновить статус webhook для бота
 */
export async function updateWebhookStatus(
  botId: string,
  userId: number,
  webhookSet: boolean
): Promise<boolean> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query(
      `UPDATE bots 
       SET webhook_set = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3`,
      [webhookSet, botId, userId]
    );
    
    return result.rowCount ? result.rowCount > 0 : false;
  } finally {
    client.release();
  }
}

/**
 * Обновить схему бота
 */
export async function updateBotSchema(
  botId: string,
  userId: number,
  schema: BotSchema
): Promise<boolean> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query(
      `UPDATE bots 
       SET schema = $1, schema_version = schema_version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(schema), botId, userId]
    );
    
    return result.rowCount ? result.rowCount > 0 : false;
  } finally {
    client.release();
  }
}

/**
 * SQL миграции (встроены в код для совместимости с Vercel serverless)
 */
const MIGRATIONS = {
  '001_create_bots_table': `
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
`,
  '002_add_webhook_set_column': `
-- Добавление поля webhook_set в таблицу bots
ALTER TABLE bots ADD COLUMN IF NOT EXISTS webhook_set BOOLEAN DEFAULT FALSE;

-- Комментарий к полю
COMMENT ON COLUMN bots.webhook_set IS 'Флаг, указывающий, настроен ли webhook для бота';
`,
  '003_add_schema_fields': `
-- Добавление полей для хранения схемы бота
ALTER TABLE bots ADD COLUMN IF NOT EXISTS schema JSONB DEFAULT NULL;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS schema_version INTEGER DEFAULT 0;

-- Комментарии к полям
COMMENT ON COLUMN bots.schema IS 'JSON схема диалогов бота (состояния, сообщения, кнопки)';
COMMENT ON COLUMN bots.schema_version IS 'Версия схемы для контроля изменений';

-- Индекс для поиска по schema (GIN индекс для JSONB)
CREATE INDEX IF NOT EXISTS idx_bots_schema ON bots USING GIN (schema);
`,
};

/**
 * Инициализация таблицы bots (создание таблицы если не существует)
 */
export async function initializeBotsTable(): Promise<void> {
  const pool = getPool();
  if (!pool) {
    throw new Error('PostgreSQL pool is not initialized');
  }

  // Применяем все миграции (встроены в код для совместимости с Vercel serverless)
  const migrationKeys = [
    '001_create_bots_table',
    '002_add_webhook_set_column',
    '003_add_schema_fields',
  ];
  
  for (const migrationKey of migrationKeys) {
    try {
      const migrationSQL = MIGRATIONS[migrationKey as keyof typeof MIGRATIONS];
      if (!migrationSQL) {
        throw new Error(`Migration ${migrationKey} not found`);
      }
      
      await pool.query(migrationSQL);
      console.log(`✅ Migration applied: ${migrationKey}`);
    } catch (error: any) {
      // Если ошибка связана с тем, что поле уже существует - это нормально
      if (error?.message?.includes('already exists') || error?.message?.includes('duplicate')) {
        console.log(`ℹ️  Migration ${migrationKey} already applied`);
      } else {
        console.error(`❌ Error applying migration ${migrationKey}:`, error);
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
        throw error;
      }
    }
  }
  
  console.log('✅ Bots table initialized');
}

