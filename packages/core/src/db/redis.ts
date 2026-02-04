import { createClient, RedisClientType } from 'redis';
import { CircuitBreaker, CircuitBreakerOpenError } from '@dialogue-constructor/shared';
import type { Logger } from '@dialogue-constructor/shared';

type AnyRedisClient = RedisClientType<any, any, any>;

let redisClient: AnyRedisClient | null = null;
let logger: Logger | null = null;
const redisCircuitBreaker = new CircuitBreaker('redis', {
  failureThreshold: 3,
  resetTimeout: 20000,
  successThreshold: 2,
});

const redisRetryStats = { success: 0, failure: 0 };

let forceRedisUnavailable = false;
let lastRedisInitOutcome: 'ready' | 'skipped' | 'failed' = 'failed';
let lastRedisSkipReason: 'missing_url' | 'localhost_on_vercel' | null = null;
type RedisDiagnosticsCategory = 'timeout' | 'auth' | 'refused' | 'dns' | 'unknown';

function redactSecrets(input: string): string {
  return input
    // Убираем userinfo из URL (redis://user:pass@host:port, postgres://user:pass@...)
    .replace(/(redis|rediss|postgres|postgresql):\/\/([^:@\s]+):([^@\s]+)@/gi, '$1://***:***@')
    // Redact распространённые query-параметры
    .replace(/(password=)[^&\s]+/gi, '$1***')
    .replace(/(access_token=)[^&\s]+/gi, '$1***')
    .replace(/(token=)[^&\s]+/gi, '$1***');
}

function diagnoseRedisError(
  rawMessage: string,
  safeMessage: string
): { category: RedisDiagnosticsCategory; hint: string } {
  const msg = rawMessage.toLowerCase();

  if (msg.includes('wrongpass') || msg.includes('noauth') || msg.includes('auth')) {
    return { category: 'auth', hint: 'Redis authentication failed' };
  }
  if (msg.includes('etimedout') || msg.includes('timed out') || msg.includes('timeout')) {
    return { category: 'timeout', hint: 'Redis connection timed out' };
  }
  if (msg.includes('econnrefused') || msg.includes('refused')) {
    return { category: 'refused', hint: 'Redis connection refused' };
  }
  if (msg.includes('enotfound') || msg.includes('getaddrinfo') || msg.includes('dns')) {
    return { category: 'dns', hint: 'Redis DNS/host resolution failed' };
  }

  return { category: 'unknown', hint: safeMessage };
}

let lastRedisDiagnostics: { category: RedisDiagnosticsCategory; hint: string } | null = null;
let lastRedisErrorMessage: string | null = null; // Текст ошибки (sanitized)

const isVercel = process.env.VERCEL === '1';

export function getRedisInitOutcome(): 'ready' | 'skipped' | 'failed' {
  return lastRedisInitOutcome;
}

export function getRedisSkipReason(): 'missing_url' | 'localhost_on_vercel' | null {
  return lastRedisSkipReason;
}

const REDIS_RETRY_CONFIG = isVercel
  ? {
      maxRetries: 7,
      initialDelayMs: 500,
      maxDelayMs: 10000,
      connectTimeoutMs: 5000,
      readyTimeoutMs: 10000,
      jitterMs: 1000,
    }
  : {
      maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      connectTimeoutMs: 5000,
      readyTimeoutMs: 5000,
      jitterMs: 2000,
    };

type RedisConnectionInfo = {
  url: string;
  host: string;
  port: string;
};

function sanitizeRedisUrl(redisUrl: string): string {
  try {
    const url = new URL(redisUrl);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return 'invalid_redis_url';
  }
}

function getRedisConnectionInfo(redisUrl: string): RedisConnectionInfo {
  try {
    const url = new URL(redisUrl);
    return {
      url: sanitizeRedisUrl(redisUrl),
      host: url.hostname,
      port: url.port || 'default',
    };
  } catch {
    return {
      url: 'invalid_redis_url',
      host: 'unknown',
      port: 'unknown',
    };
  }
}

function getRedisState(client: AnyRedisClient | null): string {
  if (!client) {
    return 'closed';
  }
  if (client.isReady) {
    return 'ready';
  }
  if (client.isOpen) {
    return 'connecting';
  }
  return 'closed';
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timeoutId);
      });
  });
}

function attachRedisEventHandlers(client: AnyRedisClient, connectionInfo: RedisConnectionInfo) {
  client.on('error', (err) => {
    logConnectionError('redis', err, {
      state: getRedisState(client),
      connection: connectionInfo,
    });
  });

  client.on('connect', () => {
    logger?.info({
      service: 'redis',
      host: connectionInfo.host,
      port: connectionInfo.port,
      connection: connectionInfo,
    }, 'Redis connection state: connecting');
  });

  client.on('ready', () => {
    logger?.info({
      service: 'redis',
      host: connectionInfo.host,
      port: connectionInfo.port,
      connection: connectionInfo,
    }, 'Redis connection state: ready');
  });

  client.on('reconnecting', () => {
    logger?.warn({
      service: 'redis',
      host: connectionInfo.host,
      port: connectionInfo.port,
      connection: connectionInfo,
    }, 'Redis connection state: reconnecting');
  });

  client.on('end', () => {
    logger?.info({
      service: 'redis',
      host: connectionInfo.host,
      port: connectionInfo.port,
      connection: connectionInfo,
    }, 'Redis connection state: closed');
  });
}

function waitForRedisReady(client: AnyRedisClient, timeoutMs: number): Promise<void> {
  if (client.isReady) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Redis ready timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      client.off('ready', onReady);
      client.off('error', onError);
    };

    client.once('ready', onReady);
    client.once('error', onError);
  });
}

async function connectRedisWithRetry(
  redisUrl: string,
  connectionInfo: RedisConnectionInfo
): Promise<AnyRedisClient> {
  const startTime = Date.now();
  let delayMs = REDIS_RETRY_CONFIG.initialDelayMs;

  logger?.info({
    service: 'redis',
    host: connectionInfo.host,
    port: connectionInfo.port,
    connection: connectionInfo,
    maxRetries: REDIS_RETRY_CONFIG.maxRetries,
    connectTimeoutMs: REDIS_RETRY_CONFIG.connectTimeoutMs,
    readyTimeoutMs: REDIS_RETRY_CONFIG.readyTimeoutMs,
    jitterMs: REDIS_RETRY_CONFIG.jitterMs,
  }, 'Redis connection state: connecting');

  for (let attempt = 1; attempt <= REDIS_RETRY_CONFIG.maxRetries; attempt++) {
    const attemptStart = Date.now();
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: REDIS_RETRY_CONFIG.connectTimeoutMs,
      },
    });
    attachRedisEventHandlers(client, connectionInfo);
    try {
      await withTimeout(
        client.connect(),
        REDIS_RETRY_CONFIG.connectTimeoutMs,
        `Redis connect timeout after ${REDIS_RETRY_CONFIG.connectTimeoutMs}ms`
      );
      await waitForRedisReady(client, REDIS_RETRY_CONFIG.readyTimeoutMs);
      redisRetryStats.success += 1;
      const durationMs = Date.now() - attemptStart;
      const totalDurationMs = Date.now() - startTime;
      logger?.info({
        service: 'redis',
        host: connectionInfo.host,
        port: connectionInfo.port,
        attempt,
        duration: durationMs,
        durationMs,
        totalDurationMs,
        connection: connectionInfo,
      }, 'Redis connection state: ready');
      return client;
    } catch (error) {
      redisRetryStats.failure += 1;
      const durationMs = Date.now() - attemptStart;
      const nextDelayMs = Math.min(delayMs, REDIS_RETRY_CONFIG.maxDelayMs);
      const jitter = Math.random() * REDIS_RETRY_CONFIG.jitterMs;
      const actualDelayMs = nextDelayMs + jitter;

      try {
        await withTimeout(
          Promise.resolve(client.disconnect()),
          1000,
          'Redis disconnect timeout'
        );
      } catch {
        // best-effort cleanup
      }

      logConnectionError('redis', error, {
        service: 'redis',
        host: connectionInfo.host,
        port: connectionInfo.port,
        attempt,
        duration: durationMs,
        durationMs,
        nextDelayMs: attempt < REDIS_RETRY_CONFIG.maxRetries ? nextDelayMs : 0,
        actualDelayMs: attempt < REDIS_RETRY_CONFIG.maxRetries ? actualDelayMs : 0,
        state: getRedisState(client),
        connection: connectionInfo,
      });
      if (attempt === REDIS_RETRY_CONFIG.maxRetries) {
        const totalDurationMs = Date.now() - startTime;
        logger?.warn({
          service: 'redis',
          host: connectionInfo.host,
          port: connectionInfo.port,
          attempts: attempt,
          duration: totalDurationMs,
          totalDurationMs,
          connection: connectionInfo,
        }, 'Redis connection state: error');
        throw new Error(
          `Redis connection failed after ${attempt} attempts (${connectionInfo.url})`
        );
      }
      logger?.warn({
        service: 'redis',
        host: connectionInfo.host,
        port: connectionInfo.port,
        attempt,
        delayMs: nextDelayMs,
        actualDelayMs,
        connection: connectionInfo,
      }, 'Redis connection retry scheduled');
      await sleep(actualDelayMs);
      delayMs = Math.min(delayMs * 2, REDIS_RETRY_CONFIG.maxDelayMs);
    }
  }

  throw new Error(
    `Redis connection failed after ${REDIS_RETRY_CONFIG.maxRetries} attempts (${connectionInfo.url})`
  );
}

export async function initRedis(loggerInstance: Logger): Promise<AnyRedisClient | null> {
  logger = loggerInstance;
  redisCircuitBreaker.setLogger(loggerInstance);
  if (redisClient && redisClient.isReady) {
    return redisClient;
  }

  logger?.info({
    service: 'redis',
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
    environment: isVercel ? 'Vercel serverless' : 'Local/traditional',
    retryConfig: {
      maxRetries: REDIS_RETRY_CONFIG.maxRetries,
      initialDelayMs: REDIS_RETRY_CONFIG.initialDelayMs,
      connectTimeoutMs: REDIS_RETRY_CONFIG.connectTimeoutMs,
      readyTimeoutMs: REDIS_RETRY_CONFIG.readyTimeoutMs,
    },
  }, '🔧 Redis retry configuration:');

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const connectionInfo = getRedisConnectionInfo(redisUrl);

  // Early exit for Vercel with localhost/missing Redis
  if (isVercel) {
    const isLocalhost = connectionInfo.host === 'localhost' || connectionInfo.host === '127.0.0.1';
    const noRedisUrl = !process.env.REDIS_URL;

    if (noRedisUrl || isLocalhost) {
      lastRedisInitOutcome = 'skipped';
      lastRedisSkipReason = noRedisUrl ? 'missing_url' : 'localhost_on_vercel';
      lastRedisDiagnostics = null;
      lastRedisErrorMessage = null; // Не ошибка, а skip
      logger?.info({
        service: 'redis',
        reason: noRedisUrl ? 'missing_url' : 'localhost_on_vercel',
        host: connectionInfo.host,
        environment: 'Vercel serverless',
      }, '⏭️ Redis skipped on Vercel (localhost or missing URL)');
      return null;
    }
  }

  if (redisClient) {
    try {
      await withTimeout(
        Promise.resolve(redisClient.disconnect()),
        1000,
        'Redis disconnect timeout'
      );
    } catch {
      // best-effort cleanup
    }
    redisClient = null;
  }

  try {
    redisClient = await connectRedisWithRetry(redisUrl, connectionInfo);
    lastRedisInitOutcome = 'ready';
    lastRedisSkipReason = null;
    lastRedisDiagnostics = null;
    lastRedisErrorMessage = null; // Сброс при успехе
    return redisClient;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastRedisInitOutcome = 'failed';
    lastRedisSkipReason = null;
    const safeMessage = redactSecrets(message);
    lastRedisErrorMessage = safeMessage; // Текст ошибки (без секретов)
    lastRedisDiagnostics = diagnoseRedisError(message, safeMessage); // category + hint для /health
    logger?.warn({
      service: 'redis',
      host: connectionInfo.host,
      port: connectionInfo.port,
      message,
    }, 'Redis initialization failed, continuing without cache:');
    logger?.warn({
      service: 'redis',
      host: connectionInfo.host,
      port: connectionInfo.port,
      connection: connectionInfo,
      state: getRedisState(redisClient),
    }, 'Redis connection details:');
    redisClient = null;
    return null;
  }
}

export async function getRedisClient(): Promise<AnyRedisClient> {
  return redisCircuitBreaker.execute(async () => {
    if (!redisClient || !redisClient.isReady) {
      if (!logger) {
        throw new Error('Redis logger is not initialized');
      }
      const client = await initRedis(logger);
      if (client && client.isReady) {
        return client;
      }
    }

    if (!redisClient) {
      throw new Error('Redis client is not initialized');
    }

    if (!redisClient.isReady) {
      throw new Error(
        `Redis client is not ready (isOpen=${redisClient.isOpen}, isReady=${redisClient.isReady})`
      );
    }

    return redisClient;
  });
}

export async function getRedisClientOptional(): Promise<AnyRedisClient | null> {
  if (forceRedisUnavailable) {
    return null;
  }
  if (getRedisInitOutcome() === 'skipped') {
    return null;
  }
  if (redisCircuitBreaker.getState() === 'open') {
    return null;
  }
  try {
    return await getRedisClient();
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      return null;
    }
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export function getRedisCircuitBreakerStats() {
  return redisCircuitBreaker.getStats();
}

export function getRedisRetryStats() {
  return { ...redisRetryStats };
}

export function getRedisDiagnostics(): { category: RedisDiagnosticsCategory; hint: string } | null {
  return lastRedisDiagnostics;
}

export function getRedisErrorMessage(): string | null {
  return lastRedisErrorMessage;
}

export function setRedisUnavailableForTests(unavailable: boolean): void {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }
  forceRedisUnavailable = unavailable;
}
