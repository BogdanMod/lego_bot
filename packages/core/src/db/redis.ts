import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

export function initRedis(): RedisClientType {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  redisClient = createClient({
    url: redisUrl,
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis client connected');
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis client ready');
  });

  redisClient.on('reconnecting', () => {
    console.log('🔄 Redis client reconnecting...');
  });

  // Connect to Redis
  redisClient.connect().catch((err) => {
    console.error('Redis connection error:', err);
  });

  return redisClient;
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    initRedis();
  }
  
  if (!redisClient) {
    throw new Error('Redis client is not initialized');
  }

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

