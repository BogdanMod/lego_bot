import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;
const isVercel = process.env.VERCEL === '1';

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

const POSTGRES_RETRY_CONFIG = isVercel
  ? {
      maxRetries: 7,
      initialDelayMs: 500,
      maxDelayMs: 15000,
    }
  : {
      maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
    };

type PostgresConnectionInfo = {
  host: string;
  port: string;
  database: string;
  user: string;
};

function getPostgresConnectionInfo(connectionString: string): PostgresConnectionInfo | null {
  try {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: url.port || 'default',
      database: url.pathname ? url.pathname.substring(1) : 'not specified',
      user: url.username || 'not specified',
    };
  } catch {
    return null;
  }
}

function formatPostgresConnectionInfo(connectionInfo: PostgresConnectionInfo | null): string {
  if (!connectionInfo) {
    return 'unknown';
  }
  return `${connectionInfo.host}:${connectionInfo.port}/${connectionInfo.database}`;
}

function logConnectionError(service: string, error: unknown, context: Record<string, unknown>) {
  const err = error as { code?: string; message?: string; stack?: string };
  console.error(`${service} connection error`, {
    timestamp: new Date().toISOString(),
    service,
    code: err?.code,
    message: err?.message || String(error),
    stack: err?.stack,
    ...context,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(
  activePool: Pool,
  connectionInfo: PostgresConnectionInfo | null
): Promise<void> {
  const startTime = Date.now();
  let delayMs = POSTGRES_RETRY_CONFIG.initialDelayMs;

  console.log('PostgreSQL connection state: connecting', {
    connection: connectionInfo,
    environment: isVercel ? 'Vercel serverless' : 'Local/traditional',
    maxRetries: POSTGRES_RETRY_CONFIG.maxRetries,
    initialDelayMs: POSTGRES_RETRY_CONFIG.initialDelayMs,
    maxDelayMs: POSTGRES_RETRY_CONFIG.maxDelayMs,
  });

  for (let attempt = 1; attempt <= POSTGRES_RETRY_CONFIG.maxRetries; attempt++) {
    const attemptStart = Date.now();
    const attemptStartedAt = new Date(attemptStart).toISOString();
    try {
      const result = await activePool.query('SELECT NOW()');
      const durationMs = Date.now() - attemptStart;
      const totalDurationMs = Date.now() - startTime;
      console.log('PostgreSQL connection state: connected', {
        attempt,
        attemptStartedAt,
        durationMs,
        totalDurationMs,
        databaseTime: result.rows?.[0]?.now,
        connection: connectionInfo,
      });
      return;
    } catch (error) {
      const durationMs = Date.now() - attemptStart;
      const nextDelayMs = Math.min(delayMs, POSTGRES_RETRY_CONFIG.maxDelayMs);
      logConnectionError('postgres', error, {
        attempt,
        attemptStartedAt,
        durationMs,
        nextDelayMs: attempt < POSTGRES_RETRY_CONFIG.maxRetries ? nextDelayMs : 0,
        connection: connectionInfo,
      });
      if (attempt === POSTGRES_RETRY_CONFIG.maxRetries) {
        const totalDurationMs = Date.now() - startTime;
        console.error('PostgreSQL connection state: error', {
          attempts: attempt,
          totalDurationMs,
          connection: connectionInfo,
        });
        throw new Error(
          `PostgreSQL connection failed after ${attempt} attempts (${formatPostgresConnectionInfo(connectionInfo)})`
        );
      }
      console.warn('PostgreSQL connection retry scheduled', {
        attempt,
        attemptStartedAt,
        delayMs: nextDelayMs,
        connection: connectionInfo,
      });
      await sleep(nextDelayMs);
      delayMs = Math.min(delayMs * 2, POSTGRES_RETRY_CONFIG.maxDelayMs);
    }
  }
}

/**
 * Инициализация пула подключений PostgreSQL
 */
export async function initPostgres(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  const poolConfig = isVercel
    ? { max: 3, idleTimeoutMillis: 5000, connectionTimeoutMillis: 15000 }
    : { max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 };

  const { max, idleTimeoutMillis, connectionTimeoutMillis } = poolConfig;
  console.log('🔧 PostgreSQL pool configuration:', {
    hasDatabaseUrl: Boolean(connectionString),
    vercel: process.env.VERCEL,
    environment: isVercel ? 'Vercel serverless' : 'Local/traditional',
    vercelEnv: process.env.VERCEL_ENV,
    poolConfig: { max, idleTimeoutMillis, connectionTimeoutMillis },
    attachDatabasePool: false,
  });

  const connectionInfo = getPostgresConnectionInfo(connectionString);

  const candidatePool = new Pool({
    connectionString,
    ...poolConfig,
  });

  candidatePool.on('error', (err) => {
    logConnectionError('postgres', err, {
      event: 'idle_client_error',
      connection: connectionInfo,
    });
  });

  try {
    await connectWithRetry(candidatePool, connectionInfo);
  } catch (error) {
    try {
      await candidatePool.end();
    } catch (endError) {
      logConnectionError('postgres', endError, {
        event: 'pool_end_error',
        connection: connectionInfo,
      });
    }
    throw error;
  }

  pool = candidatePool;
  return pool;
}

/**
 * Получить клиент из пула
 */
export async function getPostgresClient(): Promise<PoolClient> {
  const connectionString = process.env.DATABASE_URL;
  const connectionInfo = connectionString ? getPostgresConnectionInfo(connectionString) : null;

  if (!pool) {
    await initPostgres();
  }
  
  if (!pool) {
    throw new Error('PostgreSQL pool is not initialized');
  }

  if ((pool as any).ended) {
    throw new Error(
      `PostgreSQL pool has been closed (${formatPostgresConnectionInfo(connectionInfo)})`
    );
  }

  try {
    return await pool.connect();
  } catch (error) {
    logConnectionError('postgres', error, {
      action: 'connect',
      connection: connectionInfo,
    });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `PostgreSQL connection failed (${formatPostgresConnectionInfo(connectionInfo)}): ${message}`
    );
  }
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
