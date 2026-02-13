/**
 * CRUD операции для таблицы bots
 * 
 * Боты хранятся в PostgreSQL с зашифрованными токенами.
 * Схемы диалогов хранятся в JSONB поле schema.
 */

import { Pool, PoolClient } from 'pg';
import { getPool, getPostgresClient } from './postgres';
import { BotSchema, WEBHOOK_LIMITS, createLogger } from '@dialogue-constructor/shared';
import crypto from 'crypto';
import { logAuditEvent } from './audit-log';

const logger = createLogger('bots');

/**
 * Ошибка достижения лимита ботов
 */
export class BotLimitError extends Error {
  public readonly userId: number;
  public readonly activeCount: number;
  public readonly limit: number;
  public readonly code = 'BOT_LIMIT_REACHED';

  constructor(userId: number, activeCount: number, limit: number) {
    super(`Bot limit reached: ${activeCount}/${limit}`);
    this.name = 'BotLimitError';
    this.userId = userId;
    this.activeCount = activeCount;
    this.limit = limit;
  }
}

export interface Bot {
  id: string;
  user_id: number;
  token: string;
  name: string;
  webhook_set: boolean;
  webhook_secret: string | null;
  schema: BotSchema | null;
  schema_version: number;
  is_active: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBotData {
  user_id: number;
  token: string;
  name: string;
}

export interface AuditContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Создать бота в базе данных
 */
export async function createBot(data: CreateBotData, context?: AuditContext): Promise<Bot> {
  const client = await getPostgresClient();

  // Генерация webhook secret
  const webhookSecret = crypto.randomBytes(WEBHOOK_LIMITS.SECRET_TOKEN_LENGTH).toString('hex');

  // Примечание: `SECRET_TOKEN_LENGTH` здесь фактически означает **байты**, а `.toString('hex')` удваивает длину строки.
  // Например, 32 байта -> 64 hex-символа. Опции: переименовать в `SECRET_TOKEN_BYTES` или генерировать base64url.

  try {
    await client.query('BEGIN');
    
    // Advisory lock для защиты от race condition: блокируем создание ботов для одного user_id
    // pg_advisory_xact_lock автоматически освобождается при COMMIT/ROLLBACK
    // Используем bigint cast для безопасности (user_id может быть большим числом)
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [data.user_id]);
    
    // В тестовом окружении добавляем небольшую задержку для гарантии конкуренции
    if (process.env.NODE_ENV === 'test') {
      await client.query('SELECT pg_sleep(0.05)');
    }
    
    // Проверка лимита после получения lock (без FOR UPDATE, т.к. advisory lock уже защищает)
    const { BOT_LIMITS } = await import('@dialogue-constructor/shared');
    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM bots
       WHERE user_id = $1 AND is_active = true`,
      [data.user_id]
    );
    const activeCount = parseInt(countResult.rows[0]?.count || '0', 10);
    
    logger.info({ userId: data.user_id, activeCount, limit: BOT_LIMITS.MAX_BOTS_PER_USER, requestId: context?.requestId }, 'Checking bot limit');
    if (activeCount >= BOT_LIMITS.MAX_BOTS_PER_USER) {
      // Получаем список последних 10 активных ботов для диагностики
      const botIdsResult = await client.query<{ id: string }>(
        `SELECT id FROM bots WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 10`,
        [data.user_id]
      );
      const botIds = botIdsResult.rows.map(row => row.id);
      
      logger.warn({ 
        userId: data.user_id, 
        activeCount, 
        limit: BOT_LIMITS.MAX_BOTS_PER_USER, 
        botIds,
        requestId: context?.requestId 
      }, 'Bot limit reached - active bots in DB');
      
      // Не делаем ROLLBACK здесь - он будет в catch
      throw new BotLimitError(data.user_id, activeCount, BOT_LIMITS.MAX_BOTS_PER_USER);
    }
    
    const result = await client.query<Bot>(
      `INSERT INTO bots (user_id, token, name, webhook_set, schema, schema_version, webhook_secret, is_active)
       VALUES ($1, $2, $3, false, NULL, 0, $4, true)
       RETURNING id, user_id, token, name, webhook_set, schema, schema_version, webhook_secret, is_active, deleted_at, created_at, updated_at`,
      [data.user_id, data.token, data.name, webhookSecret]
    );
    
    const bot = result.rows[0];
    // Owner Cabinet: создатель автоматически получает роль owner для нового bot_id.
    await client.query(
      `INSERT INTO bot_admins (bot_id, telegram_user_id, role, created_by)
       VALUES ($1, $2, 'owner', $2)
       ON CONFLICT (bot_id, telegram_user_id) DO NOTHING`,
      [bot.id, data.user_id]
    );
    await client.query(
      `INSERT INTO bot_settings (
        bot_id,
        timezone,
        notify_new_leads,
        notify_new_orders,
        notify_new_appointments,
        notify_chat_id
      ) VALUES ($1, 'Europe/Moscow', true, true, true, NULL)
      ON CONFLICT (bot_id) DO NOTHING`,
      [bot.id]
    );
    try {
      await logAuditEvent({
        userId: data.user_id,
        requestId: context?.requestId,
        action: 'create_bot',
        resourceType: 'bot',
        resourceId: bot.id,
        metadata: { name: data.name },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    } catch (error) {
      console.error('Audit log failed:', error);
    }
    await client.query('COMMIT');
    return bot;
  } catch (error) {
    // Safe rollback: если транзакция уже не активна, не падаем
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError: any) {
      // Строго игнорируем только 25P01 (no_active_sql_transaction) и сообщение /no transaction/i
      const isNoTransactionError = 
        rollbackError?.code === '25P01' ||
        /no transaction/i.test(rollbackError?.message || '');
      
      if (!isNoTransactionError) {
        logger.error({ error: rollbackError, originalError: error }, 'Failed to rollback transaction');
      }
    }
    throw error;
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
        `SELECT id, user_id, token, name, webhook_set, schema, schema_version, webhook_secret, 
                is_active, deleted_at, created_at, updated_at
         FROM bots
         WHERE user_id = $1 AND is_active = true
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

export interface CursorPaginationParams {
  limit: number;
  cursor?: string;
}

export interface PaginatedBots {
  bots: Bot[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

type BotCursor = { created_at: string; id: string };

function encodeCursor(cursor: BotCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64');
}

function decodeCursor(cursor?: string): BotCursor | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as BotCursor;
  } catch {
    return null;
  }
}

export async function getBotsByUserIdPaginated(
  userId: number,
  params: CursorPaginationParams
): Promise<PaginatedBots> {
  const client = await getPostgresClient();

  try {
    const limit = Math.min(Math.max(params.limit, 1), 100);
    const decoded = decodeCursor(params.cursor);

    const values: any[] = [userId, limit + 1];
    let where = 'WHERE user_id = $1';

    if (decoded) {
      values.push(decoded.created_at, decoded.id);
      where += ' AND (created_at, id) < ($3, $4)';
    }

    const result = await client.query<Bot>(
      `SELECT id, user_id, token, name, webhook_set, schema, schema_version, webhook_secret, 
              is_active, deleted_at, created_at, updated_at
       FROM bots
       ${where} AND is_active = true
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      values
    );

    const rows = result.rows;
    const hasMore = rows.length > limit;
    const bots = hasMore ? rows.slice(0, limit) : rows;

    const last = bots[bots.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ created_at: String((last as any).created_at), id: String((last as any).id) })
        : null;

    return { bots, nextCursor, hasMore };
  } finally {
    client.release();
  }
}

/**
 * Получить бота по ID
 */
export async function getBotById(botId: string, userId: number): Promise<Bot | null> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query<Bot>(
      `SELECT id, user_id, token, name, webhook_set, schema, schema_version, webhook_secret, 
              is_active, deleted_at, created_at, updated_at
       FROM bots
       WHERE id = $1 AND user_id = $2 AND is_active = true`,
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
 * Получить бота по webhook_secret
 */
export async function getBotByWebhookSecret(webhookSecret: string): Promise<Bot | null> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query<Bot>(
      `SELECT id, user_id, token, name, webhook_set, schema, schema_version, webhook_secret, 
              is_active, deleted_at, created_at, updated_at
       FROM bots
       WHERE webhook_secret = $1 AND is_active = true`,
      [webhookSecret]
    );
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Получить бота по ID без проверки пользователя
 */
export async function getBotByIdAnyUser(botId: string): Promise<Bot | null> {
  const client = await getPostgresClient();

  try {
    const result = await client.query<Bot>(
      `SELECT id, user_id, token, name, webhook_set, schema, schema_version, webhook_secret, 
              is_active, deleted_at, created_at, updated_at
       FROM bots
       WHERE id = $1`,
      [botId]
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function setBotWebhookSecret(
  botId: string,
  userId: number,
  webhookSecret: string
): Promise<boolean> {
  const client = await getPostgresClient();

  try {
    const result = await client.query(
      `UPDATE bots
       SET webhook_secret = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3`,
      [webhookSecret, botId, userId]
    );

    return result.rowCount ? result.rowCount > 0 : false;
  } finally {
    client.release();
  }
}

/**
 * Сбросить всех активных ботов пользователя (soft delete)
 * Используется для админских операций и отладки
 */
export async function resetUserBots(userId: number, context?: AuditContext): Promise<number> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query<{ id: string }>(
      `UPDATE bots 
       SET is_active = false, 
           deleted_at = NOW(), 
           webhook_set = false,
           updated_at = NOW()
       WHERE user_id = $1 AND is_active = true
       RETURNING id`,
      [userId]
    );
    
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      logger.info({ userId, deletedCount, requestId: context?.requestId }, 'User bots reset (soft delete)');
      
      try {
        await logAuditEvent({
          userId,
          requestId: context?.requestId,
          action: 'reset_user_bots',
          resourceType: 'bot',
          resourceId: undefined,
          metadata: { deletedCount },
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        });
      } catch (error) {
        logger.error({ error }, 'Audit log failed');
      }
    }
    return deletedCount;
  } finally {
    client.release();
  }
}

/**
 * Подсчитать количество активных ботов пользователя
 * Примечание: для защиты от race condition используйте pg_advisory_xact_lock в транзакции перед вызовом
 */
export async function countActiveBotsByUserId(userId: number, client?: PoolClient): Promise<number> {
  const dbClient = client || await getPostgresClient();
  const shouldRelease = !client;
  
  try {
    const result = await dbClient.query<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM bots
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    
    return parseInt(result.rows[0]?.count || '0', 10);
  } finally {
    if (shouldRelease) {
      dbClient.release();
    }
  }
}

export async function deleteBot(botId: string, userId: number, context?: AuditContext): Promise<boolean> {
  const client = await getPostgresClient();
  
  try {
    // Soft delete: устанавливаем is_active = false, deleted_at = NOW(), webhook_set = false
    const result = await client.query(
      `UPDATE bots 
       SET is_active = false, 
           deleted_at = NOW(), 
           webhook_set = false,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND is_active = true
       RETURNING id`,
      [botId, userId]
    );
    
    const deleted = result.rowCount ? result.rowCount > 0 : false;
    if (deleted) {
      try {
        await logAuditEvent({
          userId,
          requestId: context?.requestId,
          action: 'delete_bot',
          resourceType: 'bot',
          resourceId: botId,
          metadata: null,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        });
      } catch (error) {
        console.error('Audit log failed:', error);
      }
    }
    return deleted;
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
  schema: BotSchema,
  context?: AuditContext
): Promise<boolean> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query(
      `UPDATE bots 
       SET schema = $1, schema_version = schema_version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(schema), botId, userId]
    );
    
    const updated = result.rowCount ? result.rowCount > 0 : false;
    if (updated) {
      try {
        await logAuditEvent({
          userId,
          requestId: context?.requestId,
          action: 'update_schema',
          resourceType: 'schema',
          resourceId: botId,
          metadata: { statesCount: Object.keys(schema.states || {}).length },
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        });
      } catch (error) {
        console.error('Audit log failed:', error);
      }
    }
    return updated;
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
  '004_add_webhook_secret': `
-- Добавление поля webhook_secret для валидации webhook'ов
ALTER TABLE bots ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(64) DEFAULT NULL;

-- Индекс для быстрого поиска по webhook_secret
CREATE INDEX IF NOT EXISTS idx_bots_webhook_secret ON bots(webhook_secret);

COMMENT ON COLUMN bots.webhook_secret IS 'Secret token для валидации webhook запросов от Telegram';
`,
  '005_optimize_indexes': `
-- Индекс для списка ботов пользователя (ускоряет getBotsByUserId* + сортировку по created_at)
-- Примечание: (id) уже индексирован как PK, поэтому отдельные индексы на id и (id, user_id) обычно избыточны.
CREATE INDEX IF NOT EXISTS idx_bots_user_id_created_at ON bots(user_id, created_at DESC, id DESC);

-- (Опционально) добавлять только если реально есть запросы с фильтром по schema:
--   WHERE user_id = $1 AND schema IS NOT NULL
-- Тогда индекс должен соответствовать этому фильтру:
-- CREATE INDEX IF NOT EXISTS idx_bots_user_id_with_schema ON bots(user_id) WHERE schema IS NOT NULL;
`,
  '006_create_audit_logs': `
-- Создание таблицы audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    request_id TEXT, -- correlation id (например req.id из логгера)
    action VARCHAR(50) NOT NULL, -- 'create_bot', 'delete_bot', 'update_schema'
    resource_type VARCHAR(50) NOT NULL, -- 'bot', 'schema'
    resource_id UUID,
    metadata JSONB, -- ограничивать размер на уровне кода (например <= 4KB после JSON.stringify)
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
`,
  '007_create_bot_users_table': `
-- Создание таблицы bot_users
CREATE TABLE IF NOT EXISTS bot_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    phone_number TEXT,
    email TEXT,
    language_code TEXT,
    first_interaction_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_interaction_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    interaction_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_users_bot_id_telegram_user_id ON bot_users(bot_id, telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_bot_id ON bot_users(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_first_interaction_at ON bot_users(first_interaction_at DESC);
`,
  '008_create_webhook_logs': `
-- Создание таблицы webhook_logs
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    state_key VARCHAR(100) NOT NULL,
    telegram_user_id BIGINT NOT NULL,
    webhook_url TEXT NOT NULL,
    request_payload JSONB,
    response_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_bot_id ON webhook_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
`,
  '009_create_bot_analytics': `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bot_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    -- Idempotency: prevents duplicate inserts on Telegram webhook retries
    source_update_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    state_from VARCHAR(100),
    state_to VARCHAR(100),
    button_text TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency (retry-safe): one row per (bot, update, event_type)
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_analytics_bot_update_event
  ON bot_analytics(bot_id, source_update_id, event_type);

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_bot_analytics_bot_id ON bot_analytics(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_analytics_created_at ON bot_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_analytics_bot_id_created_at ON bot_analytics(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_analytics_bot_event_created_at ON bot_analytics(bot_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_analytics_state_to ON bot_analytics(state_to);
`,
  '010_create_broadcasts_tables': `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bot_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    media JSONB,
    parse_mode VARCHAR(20) DEFAULT 'HTML',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_bot_id ON bot_broadcasts(bot_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON bot_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled_at ON bot_broadcasts(scheduled_at);

CREATE TABLE IF NOT EXISTS broadcast_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID NOT NULL REFERENCES bot_broadcasts(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    sending_started_at TIMESTAMPTZ,
    telegram_message_id BIGINT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    click_count INTEGER NOT NULL DEFAULT 0,
    engaged_count INTEGER NOT NULL DEFAULT 0,
    last_engaged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_messages_broadcast_id ON broadcast_messages(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_status ON broadcast_messages(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_messages_broadcast_user ON broadcast_messages(broadcast_id, telegram_user_id);
`,
  '011_add_broadcast_message_sending_started_at': `
ALTER TABLE broadcast_messages
  ADD COLUMN IF NOT EXISTS sending_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_broadcast_messages_sending_started_at
  ON broadcast_messages(status, sending_started_at);
`,
  '012_add_broadcast_message_metrics': `
ALTER TABLE broadcast_messages
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT,
  ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engaged_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_engaged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_broadcast_messages_telegram_message_id
  ON broadcast_messages(telegram_message_id);
`,
  '013_create_promo_codes': `
CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    duration_days INTEGER NOT NULL,
    max_redemptions INTEGER NOT NULL DEFAULT 1,
    redemption_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_active
  ON promo_codes(is_active, expires_at);
`,
  '014_create_user_subscriptions': `
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    plan VARCHAR(30) NOT NULL DEFAULT 'premium',
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    source VARCHAR(30) NOT NULL DEFAULT 'manual',
    promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status
  ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_ends_at
  ON user_subscriptions(ends_at);
`,
  '015_create_promo_code_redemptions': `
CREATE TABLE IF NOT EXISTS promo_code_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    subscription_ends_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_code_redemptions_unique
  ON promo_code_redemptions(promo_code_id, telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_promo
  ON promo_code_redemptions(promo_code_id);
`,
  '016_create_system_settings': `
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at
  ON system_settings(updated_at DESC);
`,
  '017_create_owner_cabinet_tables': `
CREATE TABLE IF NOT EXISTS bot_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'viewer')),
    permissions_json JSONB,
    created_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_admins_bot_user_unique
  ON bot_admins(bot_id, telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_admins_user
  ON bot_admins(telegram_user_id);

CREATE TABLE IF NOT EXISTS bot_settings (
    bot_id UUID PRIMARY KEY REFERENCES bots(id) ON DELETE CASCADE,
    timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
    business_name TEXT,
    brand_json JSONB,
    working_hours_json JSONB,
    notify_new_leads BOOLEAN NOT NULL DEFAULT true,
    notify_new_orders BOOLEAN NOT NULL DEFAULT true,
    notify_new_appointments BOOLEAN NOT NULL DEFAULT true,
    notify_chat_id BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`,
  '018_create_owner_operational_tables': `
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    telegram_user_id BIGINT,
    name TEXT,
    phone TEXT,
    email TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_bot_tg_user_unique
  ON customers(bot_id, telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_bot_created_at
  ON customers(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_bot_phone
  ON customers(bot_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_bot_email
  ON customers(bot_id, email);

CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_bot_id
  ON staff(bot_id);

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration_min INTEGER,
    price NUMERIC(12,2),
    active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_bot_id
  ON services(bot_id);

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'new',
    assignee BIGINT,
    title TEXT,
    message TEXT,
    source TEXT,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_bot_status_created_at
  ON leads(bot_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'new',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    amount NUMERIC(12,2),
    currency TEXT DEFAULT 'RUB',
    tracking TEXT,
    assignee BIGINT,
    items_json JSONB,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_bot_status_created_at
  ON orders(bot_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_bot_payment_status
  ON orders(bot_id, payment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'new',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_bot_starts_at
  ON appointments(bot_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_bot_status_starts_at
  ON appointments(bot_id, status, starts_at);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    amount NUMERIC(12,2),
    currency TEXT DEFAULT 'RUB',
    provider TEXT,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_bot_status_created_at
  ON payments(bot_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'telegram',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_bot_customer
  ON conversations(bot_id, customer_id);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    status TEXT NOT NULL DEFAULT 'new',
    text TEXT,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_bot_created_at
  ON messages(bot_id, created_at DESC);
`,
  '019_create_owner_events_and_audit': `
CREATE TABLE IF NOT EXISTS bot_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    status TEXT NOT NULL DEFAULT 'new',
    priority TEXT NOT NULL DEFAULT 'normal',
    assignee BIGINT,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bot_events_bot_created_at
  ON bot_events(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_events_bot_status_created_at
  ON bot_events(bot_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_events_bot_type_created_at
  ON bot_events(bot_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_events_payload_gin
  ON bot_events USING GIN (payload_json);

CREATE TABLE IF NOT EXISTS event_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES bot_events(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    author_telegram_user_id BIGINT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_notes_event
  ON event_notes(event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS entity_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    author_telegram_user_id BIGINT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entity_notes_entity
  ON entity_notes(bot_id, entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_entity
  ON attachments(bot_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS event_dedup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_dedup_unique
  ON event_dedup(bot_id, source_id);

CREATE TABLE IF NOT EXISTS owner_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
    actor_telegram_user_id BIGINT NOT NULL,
    entity TEXT NOT NULL,
    entity_id UUID,
    action TEXT NOT NULL,
    before_json JSONB,
    after_json JSONB,
    request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_owner_audit_bot_created_at
  ON owner_audit_log(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_audit_actor
  ON owner_audit_log(actor_telegram_user_id, created_at DESC);
`,
  '020_create_bot_usage_daily': `
-- v2: Billing-ready usage counters
CREATE TABLE IF NOT EXISTS bot_usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    events_count INTEGER NOT NULL DEFAULT 0,
    messages_count INTEGER NOT NULL DEFAULT 0,
    customers_count INTEGER NOT NULL DEFAULT 0,
    leads_count INTEGER NOT NULL DEFAULT 0,
    orders_count INTEGER NOT NULL DEFAULT 0,
    appointments_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_usage_daily_unique
  ON bot_usage_daily(bot_id, date);
CREATE INDEX IF NOT EXISTS idx_bot_usage_daily_bot_date
  ON bot_usage_daily(bot_id, date DESC);
`,
  '021_add_bot_soft_delete': `
-- Добавление полей для soft delete ботов
ALTER TABLE bots ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Комментарии к полям
COMMENT ON COLUMN bots.is_active IS 'Флаг активности бота (false = удален)';
COMMENT ON COLUMN bots.deleted_at IS 'Время удаления бота (soft delete)';

-- Индекс для быстрого подсчета активных ботов пользователя
CREATE INDEX IF NOT EXISTS idx_bots_user_id_active
  ON bots(user_id)
  WHERE is_active = true;

-- Обновление существующих записей: все существующие боты считаются активными
UPDATE bots SET is_active = true, deleted_at = NULL WHERE is_active IS NULL OR deleted_at IS NOT NULL;
`,
  '022_create_admin_security_tables': `
-- Admin users table (replaces ADMIN_USER_IDS from ENV)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  role VARCHAR(30) NOT NULL CHECK (role IN ('super_admin', 'security_admin', 'billing_admin', 'support_admin', 'read_only_admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_telegram_user_id ON admin_users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active) WHERE is_active = true;

-- Admin secrets table (rotating secrets)
CREATE TABLE IF NOT EXISTS admin_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_secrets_active ON admin_secrets(is_active, expires_at) WHERE is_active = true;

-- Security events table (for logging security violations)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
`,
  '023_make_audit_logs_immutable': `
-- Add hash chain fields to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS prev_hash TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entry_hash TEXT NOT NULL DEFAULT '';

-- Create index for hash chain verification
CREATE INDEX IF NOT EXISTS idx_audit_logs_entry_hash ON audit_logs(entry_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_prev_hash ON audit_logs(prev_hash);

-- Make audit_logs immutable (revoke UPDATE and DELETE)
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_logs FROM CURRENT_USER;

-- Create trigger to prevent UPDATE/DELETE
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs table is immutable. Use INSERT only.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_prevent_modification ON audit_logs;
CREATE TRIGGER audit_logs_prevent_modification
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- Log trigger violations to security_events
CREATE OR REPLACE FUNCTION log_audit_modification_attempt()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO security_events (event_type, metadata)
  VALUES (
    'audit_log_modification_attempt',
    jsonb_build_object(
      'operation', TG_OP,
      'table', 'audit_logs',
      'id', COALESCE(OLD.id::text, NEW.id::text)
    )
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_log_modification_attempt ON audit_logs;
CREATE TRIGGER audit_logs_log_modification_attempt
  AFTER UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_modification_attempt();
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
    '004_add_webhook_secret',
    '005_optimize_indexes',
    '006_create_audit_logs',
    '007_create_bot_users_table',
    '008_create_webhook_logs',
    '009_create_bot_analytics',
    '010_create_broadcasts_tables',
    '011_add_broadcast_message_sending_started_at',
    '012_add_broadcast_message_metrics',
    '013_create_promo_codes',
    '014_create_user_subscriptions',
    '015_create_promo_code_redemptions',
    '016_create_system_settings',
    '017_create_owner_cabinet_tables',
    '018_create_owner_operational_tables',
    '019_create_owner_events_and_audit',
    '020_create_bot_usage_daily',
    '021_add_bot_soft_delete',
    '022_create_admin_security_tables',
    '023_make_audit_logs_immutable',
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
