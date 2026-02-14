import { Pool, PoolClient } from 'pg';
import { CircuitBreaker, CircuitBreakerOpenError } from '@dialogue-constructor/shared';
import type { Logger } from '@dialogue-constructor/shared';

let pool: Pool | null = null;
let logger: Logger | null = null;
let closePromise: Promise<void> | null = null;
const postgresCircuitBreaker = new CircuitBreaker('postgres', {
  failureThreshold: 5,
  resetTimeout: 30000,
  successThreshold: 2,
  isFailure: (error: unknown) => {
    const err = error as { code?: string; message?: string };
    const code = err?.code || '';
    const message = err?.message || '';
    return /ECONNREFUSED|ETIMEDOUT|ECONNRESET|EPIPE|ENOTFOUND|EAI_AGAIN/i.test(code + message);
  },
});

const postgresRetryStats = { success: 0, failure: 0 };
type PostgresDiagnostics = ReturnType<typeof diagnoseConnectionError>;
let lastPostgresDiagnostics: PostgresDiagnostics | null = null;


export type PostgresRetryConfig = {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
};

export type PostgresPoolConfig = {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
};

export function getPostgresPoolConfig(): PostgresPoolConfig {
  return { max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 };
}

export const POSTGRES_RETRY_CONFIG: PostgresRetryConfig = {
  maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      jitterMs: 2000,
    };

export function getPostgresConnectRetryBudgetMs(): number {
  const { connectionTimeoutMillis } = getPostgresPoolConfig();
  const perAttemptBudgetMs = connectionTimeoutMillis;

  let totalBackoffMs = 0;
  let delayMs = POSTGRES_RETRY_CONFIG.initialDelayMs;

  for (let attempt = 1; attempt < POSTGRES_RETRY_CONFIG.maxRetries; attempt++) {
    totalBackoffMs += Math.min(delayMs, POSTGRES_RETRY_CONFIG.maxDelayMs);
    delayMs = Math.min(delayMs * 2, POSTGRES_RETRY_CONFIG.maxDelayMs);
  }

  return POSTGRES_RETRY_CONFIG.maxRetries * perAttemptBudgetMs + totalBackoffMs;
}

type PostgresConnectionInfo = {
  host: string;
  port: string;
  database: string;
  user: string;
};

const LOCALHOST_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '127.0.1.1',
  '::1',
  '0.0.0.0',
]);

function normalizeHost(host?: string): string {
  if (!host) return '';
  return host.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
}

function isLocalhostHost(host?: string): boolean {
  const normalized = normalizeHost(host);
  return LOCALHOST_HOSTS.has(normalized);
}

function isSupabasePooler(connectionInfo: PostgresConnectionInfo | null): boolean {
  if (!connectionInfo) return false;

  const host = connectionInfo.host;
  const port = connectionInfo.port;

  // Supabase pooler обычно выглядит как *.pooler.supabase.com (формы строк могут отличаться, но suffix стабилен)
  const isPoolerHost = host.endsWith('pooler.supabase.com');

  // В Supabase доках для pooler часто встречается 6543, но в реальных строках иногда бывает и 5432.
  // Принимаем оба, чтобы детект был устойчивым.
  const isPoolerPort = port === '6543' || port === '5432' || port === 'default';

  return isPoolerHost && isPoolerPort;
}

function getSupabasePoolerDiagnostics(connectionString: string): {
  isUrlParsable: boolean;
  hasPgbouncerParam: boolean;
  hasPrepareThresholdParam: boolean;
  hasFragment: boolean;
} {
  try {
    const url = new URL(connectionString);
    const params = new URLSearchParams(url.search);

    return {
      isUrlParsable: true,
      hasPgbouncerParam: params.has('pgbouncer'),
      hasPrepareThresholdParam: params.has('prepare_threshold'),
      hasFragment: Boolean(url.hash),
    };
  } catch {
    // Если URL невалидный, возвращаем диагностические флаги по умолчанию
    return {
      isUrlParsable: false,
      hasPgbouncerParam: false,
      hasPrepareThresholdParam: false,
      hasFragment: false,
    };
  }
}

export function ensureSupabasePoolerParams(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const params = url.searchParams;

    // Only add if missing, preserve existing params
    if (!params.has('pgbouncer')) {
      params.set('pgbouncer', 'true');
      params.set('prepare_threshold', '0');
    }

    // Keep fragment untouched (URL() preserves it)
    return url.toString();
  } catch {
    return connectionString; // fail-safe: no mutation
  }
}

export function getPostgresConnectionInfo(connectionString: string): PostgresConnectionInfo | null {
  const activePool = pool;

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

function isValidPostgresUrl(connectionString: string | undefined): boolean {
  if (!connectionString) {
    return false;
  }
  try {
    const url = new URL(connectionString);
    return Boolean(url.protocol && url.hostname);
  } catch {
    return false;
  }
}

function diagnoseConnectionError(error: unknown): { category: string; hint: string } {
  const err = error as { code?: string; message?: string };
  const code = (err?.code || '').toString();
  const message = (err?.message || '').toString();
  const combined = `${code} ${message}`.toLowerCase();

  if (combined.includes('enotfound') || combined.includes('eai_again')) {
    return { category: 'dns', hint: 'Database host could not be resolved (check hostname/DNS)' };
  }
  if (combined.includes('etimedout') || combined.includes('timeout')) {
    return { category: 'timeout', hint: 'Connection timed out (check network, firewall)' };
  }
  if (combined.includes('econnrefused')) {
    return { category: 'refused', hint: 'Connection refused (database not reachable or not running)' };
  }
  if (combined.includes('28p01') || combined.includes('password authentication failed')) {
    return { category: 'auth', hint: 'Authentication failed (check username/password)' };
  }
  if (combined.includes('ssl') || combined.includes('self signed')) {
    return { category: 'ssl', hint: 'SSL handshake failed (check sslmode or certs)' };
  }
  return { category: 'unknown', hint: 'Check connection string and database accessibility' };
}

function logConnectionError(service: string, error: unknown, context: Record<string, unknown>) {
  const err = error as { code?: string; message?: string; stack?: string };
  logger?.error({
    timestamp: new Date().toISOString(),
    service,
    code: err?.code,
    message: err?.message || String(error),
    stack: err?.stack,
    ...context,
  }, `${service} connection error`);
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

  logger?.info({
    service: 'postgres',
    connection: connectionInfo,
    environment: 'Railway production',
    maxRetries: POSTGRES_RETRY_CONFIG.maxRetries,
    initialDelayMs: POSTGRES_RETRY_CONFIG.initialDelayMs,
    maxDelayMs: POSTGRES_RETRY_CONFIG.maxDelayMs,
    jitterMs: POSTGRES_RETRY_CONFIG.jitterMs,
  }, 'PostgreSQL connection state: connecting');

  for (let attempt = 1; attempt <= POSTGRES_RETRY_CONFIG.maxRetries; attempt++) {
    const attemptStart = Date.now();
    const attemptStartedAt = new Date(attemptStart).toISOString();
    try {
      const result = await activePool.query('SELECT NOW()');
      postgresRetryStats.success += 1;
      const durationMs = Date.now() - attemptStart;
      const totalDurationMs = Date.now() - startTime;
      logger?.info({
        service: 'postgres',
        attempt,
        attemptStartedAt,
        duration: durationMs,
        durationMs,
        totalDurationMs,
        databaseTime: result.rows?.[0]?.now,
        connection: connectionInfo,
      }, 'PostgreSQL connection state: connected');
      return;
    } catch (error) {
      postgresRetryStats.failure += 1;
      const durationMs = Date.now() - attemptStart;
      const nextDelayMs = Math.min(delayMs, POSTGRES_RETRY_CONFIG.maxDelayMs);
      const jitter = Math.random() * POSTGRES_RETRY_CONFIG.jitterMs;
      const actualDelayMs = nextDelayMs + jitter;
      logConnectionError('postgres', error, {
        service: 'postgres',
        attempt,
        attemptStartedAt,
        duration: durationMs,
        durationMs,
        nextDelayMs: attempt < POSTGRES_RETRY_CONFIG.maxRetries ? nextDelayMs : 0,
        actualDelayMs: attempt < POSTGRES_RETRY_CONFIG.maxRetries ? actualDelayMs : 0,
        connection: connectionInfo,
      });
      if (attempt === POSTGRES_RETRY_CONFIG.maxRetries) {
        const totalDurationMs = Date.now() - startTime;
        const diagnostics = diagnoseConnectionError(error);
        lastPostgresDiagnostics = diagnostics; // Сохраняем для health endpoint
        const urlValid = isValidPostgresUrl(process.env.DATABASE_URL);
        logger?.error({
          service: 'postgres',
          attempts: attempt,
          duration: totalDurationMs,
          totalDurationMs,
          connection: connectionInfo,
          urlValid,
          diagnostics,
        }, 'PostgreSQL connection state: error');
        const localhostHint = '';
        throw new Error(
          `PostgreSQL connection failed after ${attempt} attempts ` +
            `(${formatPostgresConnectionInfo(connectionInfo)}). ` +
            `URL format: ${urlValid ? 'valid' : 'invalid'}. ` +
            `Likely cause: ${diagnostics.category} (${diagnostics.hint}).${localhostHint}`
        );
      }
      logger?.warn({
        service: 'postgres',
        attempt,
        attemptStartedAt,
        delayMs: nextDelayMs,
        actualDelayMs,
        connection: connectionInfo,
      }, 'PostgreSQL connection retry scheduled');
      await sleep(actualDelayMs);
      delayMs = Math.min(delayMs * 2, POSTGRES_RETRY_CONFIG.maxDelayMs);
    }
  }
}

export async function initPostgres(loggerInstance: Logger): Promise<Pool> {
  logger = loggerInstance;
  postgresCircuitBreaker.setLogger(loggerInstance);
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  
  if (!connectionString) {
    logger?.error({
      service: 'postgres',
      environment: 'Railway production',
      availableEnvVars: Object.keys(process.env).filter(
        (key) => key.startsWith('DATABASE')
      ),
    }, '❌ DATABASE_URL not found');
    throw new Error(
      'DATABASE_URL is not set in environment variables.'
    );
  }

  const poolConfig = getPostgresPoolConfig();
  const connectionInfo = getPostgresConnectionInfo(connectionString);


  let finalConnectionString = connectionString;
  let finalPoolConfig = poolConfig;
  let poolOverridesActive = false;
  let urlMutation: 'none' | 'added_params' | 'failed_safe' = 'none';

  if (isSupabasePooler(connectionInfo)) {
    let diag = getSupabasePoolerDiagnostics(finalConnectionString);

    if (diag.isUrlParsable && !diag.hasPgbouncerParam) {
      const original = finalConnectionString;
      finalConnectionString = ensureSupabasePoolerParams(finalConnectionString);
      if (finalConnectionString !== original) {
        urlMutation = 'added_params';
        logger?.info({
          service: 'postgres',
          host: connectionInfo?.host,
          port: connectionInfo?.port,
          urlMutation: 'added_params',
        }, '🔧 Auto-configured Supabase pooler: added pgbouncer=true&prepare_threshold=0');
      }
    }

    const derivedConnectionInfo = getPostgresConnectionInfo(finalConnectionString);
    if (!derivedConnectionInfo && finalConnectionString !== connectionString) {
      finalConnectionString = connectionString;
      urlMutation = 'failed_safe';
      logger?.warn({
        service: 'postgres',
        environment: 'Railway production',
        host: connectionInfo?.host,
        port: connectionInfo?.port,
        urlMutation,
        warning: 'Supabase pooler URL mutation failed; using original DATABASE_URL',
      }, '⚠️ Supabase pooler URL mutation failed; falling back to original DATABASE_URL');
    }

    const usesOriginalConnectionString = finalConnectionString === connectionString;
    const connectionStringHasProtocol = finalConnectionString.includes('://');
    const connectionStringPotentialMisparse =
      !connectionStringHasProtocol && finalConnectionString.includes('?');

    logger?.info({
      service: 'postgres',
      environment: 'Railway production',
      host: connectionInfo?.host,
      urlMutation,
      usesOriginalConnectionString,
      connectionStringHasProtocol,
      connectionStringPotentialMisparse,
    }, 'ℹ️ Supabase pooler detected');

    if (connectionStringPotentialMisparse) {
      logger?.warn({
        service: 'postgres',
        environment: 'Railway production',
        host: connectionInfo?.host,
        urlMutation,
        connectionStringHasProtocol,
        connectionStringPotentialMisparse,
        warning: 'DATABASE_URL may be misparsed (ensure original URL without unexpected fragments)',
      }, '⚠️ Guardrail: DATABASE_URL format may cause dbname misparse (e.g., dbname?...)');
    }

    // 1) Supabase docs для pooler часто показывают 6543; если видим pooler-хост на 5432 — предупреждаем.
    if (connectionInfo?.host.endsWith('pooler.supabase.com') && connectionInfo?.port === '5432') {
      logger?.warn({
        service: 'postgres',
        environment: 'Railway production',
        host: connectionInfo?.host,
        port: connectionInfo?.port,
        effectiveHost: connectionInfo?.host,
        effectivePort: connectionInfo?.port,
        warning: 'Supabase pooler host uses port 5432; verify whether 6543 is intended',
      }, '⚠️ Supabase pooler: похоже, порт не от pooler, проверь 6543');
    }

    if (!diag.isUrlParsable) {
      logger?.warn({
        service: 'postgres',
        environment: 'Railway production',
        host: connectionInfo?.host,
        warning: 'DATABASE_URL is not parsable by URL(); skipping URL-based diagnostics',
      }, '⚠️ DATABASE_URL выглядит не как валидный URL; пропускаю URL-диагностику');
    } else {
      if (diag.hasFragment) {
        logger?.warn({
          service: 'postgres',
          environment: 'Railway production',
          host: connectionInfo?.host,
          warning: 'DATABASE_URL contains #fragment; it will be ignored by URL() and can be misleading',
        }, '⚠️ DATABASE_URL содержит #fragment; это может путать при отладке');
      }

      // pgbouncer/prepare_threshold часто нужны ORM’ам (например Prisma) для transaction pooler.
      // Для node-postgres мы намеренно НЕ инжектим эти query params автоматически (риски парсинга/совместимости).
      if (!diag.hasPgbouncerParam || !diag.hasPrepareThresholdParam) {
        logger?.info({
          service: 'postgres',
          environment: 'Railway production',
          host: connectionInfo?.host,
          hint: 'If you use an ORM that relies on prepared statements (e.g., Prisma), add pgbouncer=true&prepare_threshold=0 to DATABASE_URL manually. Also keep pool size limited on serverless.',
          missingParams: {
            pgbouncer: !diag.hasPgbouncerParam,
            prepare_threshold: !diag.hasPrepareThresholdParam,
          },
        }, 'ℹ️ Supabase pooler detected on serverless: проверь, что prepared statements отключены (если ORM их делает), и что pool size ограничен');
      }
    }

    // 3) Реальные ограничения держим на уровне Pool config (и/или через env), без модификации URL
    const envMax = process.env.PG_POOL_MAX ? Number(process.env.PG_POOL_MAX) : undefined;
    const envIdleTimeoutRaw =
      process.env.PG_IDLE_TIMEOUT_MILLIS ?? process.env.PG_POOL_IDLE_TIMEOUT_MILLIS;
    const envIdleTimeout =
      envIdleTimeoutRaw !== undefined ? Number(envIdleTimeoutRaw) : undefined;
    const envConnectionTimeoutRaw =
      process.env.PG_CONNECTION_TIMEOUT_MILLIS ??
      process.env.PG_POOL_CONNECTION_TIMEOUT_MILLIS;
    const envConnectionTimeout =
      envConnectionTimeoutRaw !== undefined ? Number(envConnectionTimeoutRaw) : undefined;
    const envAcquireTimeout = process.env.PG_POOL_ACQUIRE_TIMEOUT_MILLIS
      ? Number(process.env.PG_POOL_ACQUIRE_TIMEOUT_MILLIS)
      : undefined;
    const resolvedConnectionTimeout = Number.isFinite(envAcquireTimeout)
      ? envAcquireTimeout
      : envConnectionTimeout;
    const hasOverrides =
      Number.isFinite(envMax) ||
      Number.isFinite(envIdleTimeout) ||
      Number.isFinite(resolvedConnectionTimeout);
    poolOverridesActive = hasOverrides;

    finalPoolConfig = {
      ...poolConfig,
      ...(Number.isFinite(envMax) ? { max: envMax } : {}),
      ...(Number.isFinite(envIdleTimeout) ? { idleTimeoutMillis: envIdleTimeout } : {}),
      ...(Number.isFinite(resolvedConnectionTimeout)
        ? { connectionTimeoutMillis: resolvedConnectionTimeout }
        : {}),
    };

    if (hasOverrides) {
      logger?.info({
        service: 'postgres',
        environment: 'Railway production',
        host: connectionInfo?.host,
        appliedPoolOverrides: {
          max: (finalPoolConfig as any).max,
          idleTimeoutMillis: (finalPoolConfig as any).idleTimeoutMillis,
          connectionTimeoutMillis: (finalPoolConfig as any).connectionTimeoutMillis,
        },
      }, '🔧 Applied serverless pool config overrides for Supabase pooler');
    }
  }

  const finalConnectionInfo = getPostgresConnectionInfo(finalConnectionString);

  const { max, idleTimeoutMillis, connectionTimeoutMillis } = finalPoolConfig;
  logger?.info({
    service: 'postgres',
    connection: finalConnectionInfo,
    hasDatabaseUrl: Boolean(finalConnectionString),
    environment: 'Railway production',
    poolConfig: { max, idleTimeoutMillis, connectionTimeoutMillis },
    attachDatabasePool: attachDatabasePoolAvailable,
    retryBudgetMs: getPostgresConnectRetryBudgetMs(),
    retryConfig: POSTGRES_RETRY_CONFIG,
  }, '🔧 PostgreSQL pool configuration:');

  // Логируем части URL для диагностики (без паролей)
  if (finalConnectionInfo) {
    logger?.info({
      service: 'postgres',
      connection: finalConnectionInfo,
    }, '🔍 PostgreSQL connection info:');
    logger?.info({ service: 'postgres', host: finalConnectionInfo.host }, '  Host:');
    logger?.info({ service: 'postgres', port: finalConnectionInfo.port }, '  Port:');
    logger?.info({ service: 'postgres', database: finalConnectionInfo.database }, '  Database:');
    logger?.info({ service: 'postgres', user: finalConnectionInfo.user }, '  User:');
    logger?.info({ service: 'postgres', password: 'not logged' }, '  Password:');
  } else {
    logger?.warn({ service: 'postgres' }, '⚠️ Could not parse DATABASE_URL (might be invalid format)');
  }

  if (poolOverridesActive) {
    logger?.info({
      service: 'postgres',
      pool: {
        max: (finalPoolConfig as any).max,
        idleTimeoutMillis: (finalPoolConfig as any).idleTimeoutMillis,
        connectionTimeoutMillis: (finalPoolConfig as any).connectionTimeoutMillis,
      },
    }, '📦 PostgreSQL pool config:');
  }

  const candidatePool = new Pool({
    connectionString: finalConnectionString,
    ...finalPoolConfig,
  });

  candidatePool.on('error', (err) => {
    logConnectionError('postgres', err, {
      service: 'postgres',
      event: 'idle_client_error',
      connection: finalConnectionInfo,
    });
  });

  try {
    await connectWithRetry(candidatePool, finalConnectionInfo);
  } catch (error) {
    try {
      await candidatePool.end();
    } catch (endError) {
      logConnectionError('postgres', endError, {
        service: 'postgres',
        event: 'pool_end_error',
        connection: finalConnectionInfo,
      });
    }
    throw error;
  }

  pool = candidatePool;


  lastPostgresDiagnostics = null; // Сброс при реальном успехе
  return pool;
}

export async function getPostgresClient(): Promise<PoolClient> {
  const connectionString = process.env.DATABASE_URL;
  const connectionInfo = connectionString ? getPostgresConnectionInfo(connectionString) : null;
  logger?.info({
    service: 'postgres',
    connection: connectionInfo,
    exists: Boolean(pool),
  }, '📊 getPostgresClient - pool exists:');
  
  if (!pool) {
    if (!logger) {
      throw new Error('PostgreSQL logger is not initialized');
    }
    logger.info({
      service: 'postgres',
      connection: connectionInfo,
    }, '📦 Initializing PostgreSQL pool...');
    await initPostgres(logger);
  }
  
  const activePool = pool;
  if (!activePool) {
    logger?.error({
      service: 'postgres',
      connection: connectionInfo,
    }, '❌ PostgreSQL pool is not initialized');
    throw new Error('PostgreSQL pool is not initialized');
  }

  if ((activePool as any).ended) {
    throw new Error(
      `PostgreSQL pool has been closed (${formatPostgresConnectionInfo(connectionInfo)})`
    );
  }

  try {
    logger?.info({
      service: 'postgres',
      connection: connectionInfo,
    }, '🔗 Connecting to PostgreSQL...');
    const client = await postgresCircuitBreaker.execute(() => activePool.connect());
    logger?.info({
      service: 'postgres',
      connection: connectionInfo,
    }, '✅ PostgreSQL client connected');
    return client;
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      logger?.warn({
        service: 'postgres',
        connection: connectionInfo,
      }, 'PostgreSQL circuit breaker open');
      throw new Error('PostgreSQL is temporarily unavailable (circuit breaker open)');
    }
    logConnectionError('postgres', error, {
      service: 'postgres',
      action: 'connect',
      connection: connectionInfo,
    });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `PostgreSQL connection failed (${formatPostgresConnectionInfo(connectionInfo)}): ${message}`
    );
  }
}

export function closePostgres(): Promise<void> {
  if (!pool) {
    return Promise.resolve();
  }
  if (closePromise) {
    logger?.info(
      { service: 'postgres', state: 'already_closing' },
      'PostgreSQL pool already closing'
    );
    return closePromise;
  }
  const isEnding = Boolean((pool as any).ending || (pool as any)._ending);
  if (isEnding) {
    logger?.info(
      { service: 'postgres', state: 'already_ending' },
      'Pool already ending'
    );
    return Promise.resolve();
  }
  const activePool = pool;
  closePromise = activePool.end().finally(() => {
    closePromise = null;
    pool = null;
  });
  return closePromise;
}

export function getPool(): Pool | null {
  return pool;
}

export function getPoolStats() {
  if (!pool) {
    return { totalCount: 0, idleCount: 0, waitingCount: 0 };
  }
  return {
    totalCount: (pool as any).totalCount ?? 0,
    idleCount: (pool as any).idleCount ?? 0,
    waitingCount: (pool as any).waitingCount ?? 0,
  };
}

export function getPostgresCircuitBreakerStats() {
  return postgresCircuitBreaker.getStats();
}

export function getPostgresRetryStats() {
  return { ...postgresRetryStats };
}

export function getPostgresDiagnostics(): PostgresDiagnostics | null {
  return lastPostgresDiagnostics;
}
