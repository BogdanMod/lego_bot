import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

/**
 * Инициализация Redis клиента
 */
export function initRedis(): RedisClientType {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || process.env.REDIS_PORT 
    ? `redis://localhost:${process.env.REDIS_PORT || 6379}`
    : 'redis://localhost:6379';

  redisClient = createClient({
    url: redisUrl,
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('🔄 Connecting to Redis...');
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis connected successfully');
  });

  redisClient.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
  });

  // Подключаемся к Redis
  redisClient.connect().catch((err) => {
    console.error('❌ Failed to connect to Redis:', err);
  });

  return redisClient;
}

/**
 * Получить Redis клиент
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    initRedis();
  }
  if (!redisClient) {
    throw new Error('Redis client is not initialized');
  }
  return redisClient;
}

/**
 * Закрыть соединение с Redis
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    console.log('🛑 Closing Redis connection...');
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Получить текущее состояние пользователя
 */
export async function getUserState(botId: string, userId: number): Promise<string | null> {
  const client = getRedisClient();
  const key = `bot:${botId}:user:${userId}:state`;
  
  try {
    const state = await client.get(key);
    return state;
  } catch (error) {
    console.error('Error getting user state from Redis:', error);
    return null;
  }
}

/**
 * Установить состояние пользователя
 */
export async function setUserState(botId: string, userId: number, state: string): Promise<void> {
  const client = getRedisClient();
  const key = `bot:${botId}:user:${userId}:state`;
  
  try {
    // Устанавливаем состояние с TTL 30 дней (в секундах)
    await client.setEx(key, 30 * 24 * 60 * 60, state);
  } catch (error) {
    console.error('Error setting user state in Redis:', error);
  }
}

/**
 * Сбросить состояние пользователя
 */
export async function resetUserState(botId: string, userId: number): Promise<void> {
  const client = getRedisClient();
  const key = `bot:${botId}:user:${userId}:state`;
  
  try {
    await client.del(key);
  } catch (error) {
    console.error('Error resetting user state in Redis:', error);
  }
}

