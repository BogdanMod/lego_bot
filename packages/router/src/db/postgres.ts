import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

import { BotSchema } from '@dialogue-constructor/shared/types/bot-schema';

export interface Bot {
  id: string;
  user_id: number;
  token: string;
  name: string;
  schema: BotSchema | null;
  schema_version: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Инициализация пула подключений PostgreSQL
 */
export function initPostgres(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  // Тест подключения
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('PostgreSQL connection error:', err);
    } else {
      console.log('✅ PostgreSQL connected successfully');
      console.log('Database time:', res.rows[0].now);
    }
  });

  return pool;
}

/**
 * Получить клиент из пула
 */
export async function getPostgresClient(): Promise<PoolClient> {
  if (!pool) {
    initPostgres();
  }
  
  if (!pool) {
    throw new Error('PostgreSQL pool is not initialized');
  }

  return pool.connect();
}

/**
 * Получить бота по ID
 */
export async function getBotById(botId: string): Promise<Bot | null> {
  const client = await getPostgresClient();
  
  try {
    const result = await client.query<Bot>(
      `SELECT id, user_id, token, name, schema, schema_version, created_at, updated_at
       FROM bots
       WHERE id = $1`,
      [botId]
    );
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Получить схему бота
 */
export async function getBotSchema(botId: string): Promise<BotSchema | null> {
  const bot = await getBotById(botId);
  return bot?.schema || null;
}

/**
 * Закрыть пул подключений
 */
export function closePostgres(): Promise<void> {
  if (pool) {
    return pool.end();
  }
  return Promise.resolve();
}

