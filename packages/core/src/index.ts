import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Telegraf, session } from 'telegraf';
import { Scenes } from 'telegraf';
import { initPostgres, closePostgres, getPostgresConnectRetryBudgetMs, POSTGRES_RETRY_CONFIG } from './db/postgres';
import { initRedis, closeRedis } from './db/redis';
import { initializeBotsTable, getBotsByUserId, getBotById, updateBotSchema } from './db/bots';
import { createBotScene } from './bot/scenes';
import { handleStart, handleCreateBot, handleMyBots, handleHelp, handleSetupMiniApp, handleCheckWebhook } from './bot/commands';
import { handleSetWebhook, handleDeleteWebhook } from './bot/webhook-commands';
import { handleEditSchema } from './bot/schema-commands';
import path from 'path';
import * as crypto from 'crypto';

/**
 * Core Server - Основной сервер приложения
 * 
 * Функциональность:
 * - Express API для фронтенда (/api/bots, /api/bot/:id/schema)
 * - Telegram бот (Telegraf) с командами /start, /create_bot, /my_bots, etc.
 * - PostgreSQL для хранения ботов (токены зашифрованы)
 * - Redis для кеширования
 */

// Загрузка .env файла из корня проекта
const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });
console.log('📄 Загрузка .env из:', envPath);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database connections
let dbInitialized = false;
let dbInitializationPromise: Promise<void> | null = null;
let redisAvailable = true;
let dbInitializationStage: string | null = null;
let lastDatabaseInitialization: {
  startedAt: string | null;
  finishedAt: string | null;
  success: boolean | null;
  durationMs: number | null;
  error: string | null;
} = {
  startedAt: null,
  finishedAt: null,
  success: null,
  durationMs: null,
  error: null,
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, createTimeoutError: () => Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(createTimeoutError());
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timeoutId);
      });
  });
}

function getSafePostgresConnectionInfo(connectionString: string | undefined): Record<string, string> | null {
  if (!connectionString) {
    return null;
  }

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

async function initializeDatabases() {
  const isVercel = process.env.VERCEL === '1';
  const initializationTimeoutMs = isVercel ? getPostgresConnectRetryBudgetMs() + 2000 : 0;

  if (dbInitialized) {
    console.log('✅ Databases already initialized');
    return;
  }
  
  if (dbInitializationPromise) {
    console.log('⏳ Database initialization in progress, waiting...');
    return initializationTimeoutMs
      ? withTimeout(dbInitializationPromise, initializationTimeoutMs, () => {
          return new Error(
            `Database initialization timed out after ${initializationTimeoutMs}ms (stage: ${dbInitializationStage || 'unknown'})`
          );
        })
      : dbInitializationPromise;
  }
  
  console.log('🚀 Initializing databases...');
  console.log('🔧 Environment variables:');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  console.log('  REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'NOT SET');
  console.log('  VERCEL:', process.env.VERCEL);
  console.log('  VERCEL_ENV:', process.env.VERCEL_ENV);
  
  const initializationStartedAt = Date.now();
  lastDatabaseInitialization = {
    startedAt: new Date(initializationStartedAt).toISOString(),
    finishedAt: null,
    success: null,
    durationMs: null,
    error: null,
  };
  dbInitializationStage = 'postgres';

  dbInitializationPromise = (async () => {
    try {
      console.log('🐘 Initializing PostgreSQL...');
      const postgresStart = Date.now();
      try {
        await initPostgres();
        console.log('✅ PostgreSQL initialized', { durationMs: Date.now() - postgresStart });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const postgresError = new Error(`PostgreSQL initialization failed: ${message}`);
        (postgresError as any).database = 'postgres';
        throw postgresError;
      }
      
      dbInitializationStage = 'redis';
      console.log('🔴 Initializing Redis...');
      const redisStart = Date.now();
      try {
        const redisClient = await initRedis();
        if (redisClient) {
          console.log('✅ Redis initialized', { durationMs: Date.now() - redisStart });
          redisAvailable = true;
        } else {
          redisAvailable = false;
          console.warn('⚠️ Redis initialization failed, continuing without cache');
        }
      } catch (error) {
        redisAvailable = false;
        console.warn('⚠️ Redis initialization failed, continuing without cache:', error);
      }

      dbInitializationStage = 'validate_postgres';
      console.log('🔍 Validating PostgreSQL connection...');
      const postgresValidationStart = Date.now();
      const { getPool } = await import('./db/postgres');
      const pool = getPool();
      if (!pool) {
        const postgresError = new Error('PostgreSQL pool is not initialized');
        (postgresError as any).database = 'postgres';
        throw postgresError;
      }

      try {
        await pool.query('SELECT 1');
        console.log('✅ PostgreSQL connection verified', {
          durationMs: Date.now() - postgresValidationStart,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const postgresError = new Error(`PostgreSQL connection validation failed: ${message}`);
        (postgresError as any).database = 'postgres';
        throw postgresError;
      }

      if (redisAvailable) {
        dbInitializationStage = 'validate_redis';
        try {
          const redisValidationStart = Date.now();
          const { getRedisClient } = await import('./db/redis');
          const redisClient = await getRedisClient();
          await redisClient.ping();
          console.log('✅ Redis connection verified', {
            durationMs: Date.now() - redisValidationStart,
          });
        } catch (error) {
          redisAvailable = false;
          console.warn('⚠️ Redis ping failed, continuing without cache:', error);
        }
      }
      
      dbInitializationStage = 'tables';
      console.log('📊 Initializing bots table...');
      const tablesStart = Date.now();
      // Инициализируем таблицу bots
      await initializeBotsTable();
      console.log('✅ Database tables initialized', { durationMs: Date.now() - tablesStart });
      dbInitialized = true;

      const totalDurationMs = Date.now() - initializationStartedAt;
      lastDatabaseInitialization = {
        ...lastDatabaseInitialization,
        finishedAt: new Date().toISOString(),
        success: true,
        durationMs: totalDurationMs,
        error: null,
      };
      dbInitializationStage = 'done';
      console.log('✅ All databases initialized successfully', { totalDurationMs });
    } catch (error) {
      const totalDurationMs = Date.now() - initializationStartedAt;
      const message = error instanceof Error ? error.message : String(error);
      lastDatabaseInitialization = {
        ...lastDatabaseInitialization,
        finishedAt: new Date().toISOString(),
        success: false,
        durationMs: totalDurationMs,
        error: message,
      };
      console.error('❌ Failed to initialize databases:', error);
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', message);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      dbInitializationPromise = null; // Reset to allow retry
      throw error;
    }
  })();
  
  return initializationTimeoutMs
    ? withTimeout(dbInitializationPromise, initializationTimeoutMs, () => {
        return new Error(
          `Database initialization timed out after ${initializationTimeoutMs}ms (stage: ${dbInitializationStage || 'unknown'})`
        );
      })
    : dbInitializationPromise;
}

// Middleware для проверки инициализации БД
async function ensureDatabasesInitialized(req: Request, res: Response, next: Function) {
  const middlewareStart = Date.now();
  try {
    console.log('🔍 ensureDatabasesInitialized - checking DB initialization...');
    console.log('📊 DB initialized flag:', dbInitialized);
    
    await initializeDatabases();
    console.log('✅ Databases initialized, proceeding with request', {
      durationMs: Date.now() - middlewareStart,
    });
    next();
  } catch (error) {
    const durationMs = Date.now() - middlewareStart;
    console.error('❌ Database initialization error in middleware:', error);
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');

    const postgresConnectionInfo = getSafePostgresConnectionInfo(process.env.DATABASE_URL);
    let poolState: Record<string, unknown> = { exists: false };
    try {
      const { getPool } = await import('./db/postgres');
      const pool = getPool();
      if (pool) {
        poolState = {
          exists: true,
          ended: Boolean((pool as any).ended),
          totalCount: (pool as any).totalCount,
          idleCount: (pool as any).idleCount,
          waitingCount: (pool as any).waitingCount,
        };
      }
    } catch (poolError) {
      poolState = {
        exists: 'unknown',
        error: poolError instanceof Error ? poolError.message : String(poolError),
      };
    }
    
    // Логируем переменные окружения (без секретов)
    console.log('🔍 Environment check:');
    console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    console.log('  REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'NOT SET');
    console.log('  VERCEL:', process.env.VERCEL);
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    console.log('🔍 PostgreSQL pool state:', poolState);
    console.log('🔍 PostgreSQL connection info:', postgresConnectionInfo);
    const failedDatabase = (error as any)?.database || 'postgres';
    const maxRetries = POSTGRES_RETRY_CONFIG.maxRetries;

    res.status(503).json({ 
      error: 'Service temporarily unavailable',
      message: 'Database initialization failed',
      database: failedDatabase,
      stage: dbInitializationStage,
      attempts: maxRetries,
      totalDurationMs: lastDatabaseInitialization.durationMs ?? durationMs,
      lastError: error instanceof Error ? error.message : String(error),
      recommendation: 'Retry in 5 seconds',
    });
  }
}

// Инициализация БД при запуске (не блокирующая)
if (process.env.VERCEL !== '1') {
  // Локально инициализируем сразу
  initializeDatabases().catch((error) => {
    console.error('Failed to initialize databases on startup:', error);
  });
} else {
  // На Vercel инициализируем лениво при первом запросе
  console.log('📦 Vercel environment detected - databases will be initialized on first request');
}

// CORS configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://lego-bot-miniapp.vercel.app';
const MINI_APP_DEV_URL = 'http://localhost:5174';
const MINI_APP_DEV_URL_127 = 'http://127.0.0.1:5174';
const allowedOrigins = [FRONTEND_URL, MINI_APP_URL, MINI_APP_DEV_URL, MINI_APP_DEV_URL_127].filter(Boolean);

console.log('🌐 CORS configuration:');
console.log('  FRONTEND_URL:', FRONTEND_URL);
console.log('  MINI_APP_URL:', MINI_APP_URL);
console.log('  MINI_APP_DEV_URL:', MINI_APP_DEV_URL);
console.log('  MINI_APP_DEV_URL_127:', MINI_APP_DEV_URL_127);
console.log('  Allowed origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    console.log('🔍 CORS check - origin:', origin);
    // Разрешаем запросы без origin (например, мобильные приложения, Telegram)
    if (!origin) {
      console.log('✅ CORS: No origin, allowing');
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log('✅ CORS: Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('✅ CORS: Allowing all origins (permissive mode):', origin);
      callback(null, true); // Разрешаем все для упрощения
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Логирование всех входящих запросов
app.use((req: Request, res: Response, next: Function) => {
  console.log('📨 Incoming request:', {
    method: req.method,
    path: req.path,
    url: req.url,
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent']?.substring(0, 50),
  });
  next();
});

// Webhook endpoint для основного бота (должен быть ДО express.json() для raw body)
// Регистрируем сразу, но обработчик будет работать только если botInstance инициализирован
app.post('/api/webhook', express.raw({ type: 'application/json' }), ensureDatabasesInitialized as any, async (req: Request, res: Response) => {
  try {
    console.log('✅ Webhook DB initialization complete, processing update');
    // Проверяем, что бот инициализирован
    if (!botInstance) {
      console.error('❌ Bot instance not initialized in webhook handler');
      return res.status(503).json({ error: 'Bot not initialized' });
    }
    
    const update = JSON.parse(req.body.toString());
    console.log('📨 Webhook received:', {
      updateId: update.update_id,
      type: update.message ? 'message' : update.callback_query ? 'callback_query' : 'unknown',
    });
    
    await botInstance.handleUpdate(update);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    // Всегда возвращаем 200 для Telegram, чтобы не было повторных запросов
    res.status(200).json({ ok: true });
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Обработка OPTIONS запросов (CORS preflight) - должен быть после CORS middleware
app.options('*', (req: Request, res: Response) => {
  console.log('🔧 CORS preflight request:', {
    path: req.path,
    origin: req.headers.origin,
    method: req.headers['access-control-request-method'],
    headers: req.headers['access-control-request-headers'],
  });
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
});

// Health check
app.get('/health', async (req: Request, res: Response) => {
  const isVercel = process.env.VERCEL === '1';
  const postgresPoolConfig = isVercel
    ? { max: 3, idleTimeoutMillis: 5000, connectionTimeoutMillis: 15000 }
    : { max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 };

  const { getPool } = await import('./db/postgres');
  const { getRedisClientOptional } = await import('./db/redis');

  const pool = getPool();
  const poolInfo = pool
    ? {
        totalCount: (pool as any).totalCount,
        idleCount: (pool as any).idleCount,
        waitingCount: (pool as any).waitingCount,
      }
    : {
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
      };
  
  let postgresState: 'connecting' | 'ready' | 'error' = 'connecting';
  if (!dbInitialized) {
    postgresState = dbInitializationPromise ? 'connecting' : 'error';
  } else {
    try {
      const pool = getPool();
      if (pool) {
        await pool.query('SELECT 1');
        postgresState = 'ready';
      } else {
        postgresState = 'error';
      }
    } catch (error) {
      postgresState = 'error';
    }
  }

  let redisState: 'connecting' | 'ready' | 'error' = 'connecting';
  if (!dbInitialized) {
    redisState = dbInitializationPromise ? 'connecting' : 'error';
  } else if (!redisAvailable) {
    redisState = 'error';
  } else {
    try {
      const redisClient = await getRedisClientOptional();
      if (redisClient) {
        await redisClient.ping();
        redisState = 'ready';
      } else {
        redisState = 'error';
      }
    } catch (error) {
      redisState = 'error';
    }
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      vercel: isVercel,
      vercelEnv: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV,
    },
    initialization: {
      last: lastDatabaseInitialization,
      stage: dbInitializationStage,
      initialized: dbInitialized,
      inProgress: Boolean(dbInitializationPromise) && !dbInitialized,
    },
    databases: {
      postgres: {
        status: postgresState,
        pool: poolInfo,
        poolConfig: postgresPoolConfig,
      },
      redis: {
        status: redisState,
      },
    },
  };

  if (postgresState === 'ready') {
    health.status = redisState === 'ready' ? 'ok' : 'degraded';
  } else {
    health.status = 'error';
  }

  const statusCode = postgresState === 'ready' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Middleware для проверки user_id (упрощенная авторизация без Telegram)
async function requireUserId(req: Request, res: Response, next: Function) {
  // user_id может быть в query (GET) или в query (POST через URL)
  const userId = req.query.user_id as string;
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing user_id parameter in query string' });
  }

  const userIdNum = parseInt(userId, 10);
  if (isNaN(userIdNum)) {
    return res.status(400).json({ error: 'Invalid user_id format. Must be a number' });
  }

  (req as any).user = { id: userIdNum };
  next();
}

// API Routes

// GET /api/bots - получить список ботов пользователя
app.get('/api/bots', ensureDatabasesInitialized as any, requireUserId as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    console.log('📋 GET /api/bots - userId:', userId);
    
    const bots = await getBotsByUserId(userId);
    console.log('✅ Found bots:', bots.length);
    
    // Убираем токены из ответа
    const safeBots = bots.map(bot => ({
      id: bot.id,
      name: bot.name,
      webhook_set: bot.webhook_set,
      schema_version: bot.schema_version,
      created_at: bot.created_at,
    }));
    
    console.log('✅ Returning safe bots:', safeBots.length);
    res.json(safeBots);
  } catch (error) {
    console.error('❌ Error fetching bots:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/bot/:id/schema - получить схему бота
app.get('/api/bot/:id/schema', ensureDatabasesInitialized as any, requireUserId as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;
    
    const bot = await getBotById(botId, userId);
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    if (!bot.schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    
    res.json(bot.schema);
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bot/:id/schema - обновить схему бота
app.post('/api/bot/:id/schema', ensureDatabasesInitialized as any, requireUserId as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;
    const schema = req.body;
    
    // Валидация схемы
    if (!schema || typeof schema !== 'object') {
      return res.status(400).json({ error: 'Invalid schema format' });
    }
    
    if (schema.version !== 1) {
      return res.status(400).json({ error: 'Invalid schema version. Must be 1' });
    }
    
    if (!schema.states || typeof schema.states !== 'object') {
      return res.status(400).json({ error: 'Invalid states format' });
    }
    
    if (!schema.initialState || typeof schema.initialState !== 'string') {
      return res.status(400).json({ error: 'Invalid initialState' });
    }
    
    // Проверяем, что бот принадлежит пользователю
    const bot = await getBotById(botId, userId);
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    // Обновляем схему
    const success = await updateBotSchema(botId, userId, schema);
    if (!success) {
      return res.status(500).json({ error: 'Failed to update schema' });
    }
    
    res.json({ 
      success: true, 
      message: 'Schema updated successfully',
      schema_version: (bot.schema_version || 0) + 1
    });
  } catch (error) {
    console.error('Error updating schema:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize Telegram bot
const botToken = process.env.TELEGRAM_BOT_TOKEN;
let botInstance: Telegraf<Scenes.SceneContext> | null = null;

if (!botToken) {
  console.warn('⚠️  TELEGRAM_BOT_TOKEN is not set');
  console.warn('⚠️  Бот не будет запущен. Установите TELEGRAM_BOT_TOKEN в .env файле');
} else {
  console.log('🔑 Токен бота найден:', botToken.substring(0, 10) + '...');
  // Создание бота с поддержкой сцен (FSM)
  botInstance = new Telegraf<Scenes.SceneContext>(botToken);
  
  // Настройка сессий (используем память для простоты, в продакшене лучше Redis)
  botInstance.use(session());
  
  // Регистрация сцен
  const stage = new Scenes.Stage<Scenes.SceneContext>([createBotScene as any]);
  botInstance.use(stage.middleware());
  
  // Логирование всех входящих обновлений для отладки (ПОСЛЕ middleware, НО перед командами)
  botInstance.use(async (ctx, next) => {
    console.log('📨 Получено обновление:', {
      updateId: ctx.update.update_id,
      type: ctx.updateType,
      from: ctx.from?.id,
      username: ctx.from?.username,
      text: ctx.message && 'text' in ctx.message ? ctx.message.text : undefined,
      chatId: ctx.chat?.id,
      command: ctx.message && 'text' in ctx.message && ctx.message.text?.startsWith('/') ? ctx.message.text : undefined,
    });
    return next();
  });
  
  // Регистрация команд
  botInstance.command('start', async (ctx) => {
    console.log('🎯 Команда /start получена от:', ctx.from?.id, ctx.from?.username);
    try {
      await handleStart(ctx as any);
      console.log('✅ Команда /start обработана успешно');
    } catch (error) {
      console.error('❌ Error in /start command:', error);
      try {
        await ctx.reply('❌ Произошла ошибка при обработке команды.');
      } catch (replyError) {
        console.error('❌ Failed to send error message:', replyError);
      }
    }
  });
  
  botInstance.command('create_bot', async (ctx) => {
    try {
      if (ctx.scene) {
        await handleCreateBot(ctx as Scenes.SceneContext);
      } else {
        ctx.reply('❌ Сцены не инициализированы.').catch(console.error);
      }
    } catch (error) {
      console.error('Error in /create_bot command:', error);
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch(console.error);
    }
  });
  
  botInstance.command('my_bots', async (ctx) => {
    try {
      await handleMyBots(ctx as any);
    } catch (error) {
      console.error('Error in /my_bots command:', error);
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch(console.error);
    }
  });
  
  botInstance.command('help', async (ctx) => {
    try {
      await handleHelp(ctx as any);
    } catch (error) {
      console.error('Error in /help command:', error);
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch(console.error);
    }
  });
  
  // Обработка callback_query (кнопки)
  botInstance.action('back_to_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await handleStart(ctx as any);
      console.log('✅ Возврат в главное меню');
    } catch (error) {
      console.error('Error handling back_to_menu:', error);
      ctx.answerCbQuery('Ошибка при возврате в меню').catch(console.error);
    }
  });
  
  botInstance.action('create_bot', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      if (ctx.scene) {
        await handleCreateBot(ctx as Scenes.SceneContext);
      } else {
        await ctx.reply('❌ Сцены не инициализированы.');
      }
    } catch (error) {
      console.error('Error handling create_bot action:', error);
      ctx.answerCbQuery('Ошибка').catch(console.error);
    }
  });
  
  botInstance.action('my_bots', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await handleMyBots(ctx as any);
    } catch (error) {
      console.error('Error handling my_bots action:', error);
      ctx.answerCbQuery('Ошибка').catch(console.error);
    }
  });
  
  botInstance.action('help', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await handleHelp(ctx as any);
    } catch (error) {
      console.error('Error handling help action:', error);
      ctx.answerCbQuery('Ошибка').catch(console.error);
    }
  });

  // Команда для настройки webhook основного бота
  botInstance.command('setup_webhook', async (ctx) => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        await ctx.reply('❌ TELEGRAM_BOT_TOKEN не установлен в переменных окружения.');
        return;
      }

      // Проверка прав доступа
      // Уточнение (компромиссный режим): если `ADMIN_USER_IDS` не задан/пустой,
      // не блокируйте команду полностью. Либо разрешите выполнение с явным предупреждением,
      // либо применяйте настройку только для текущего чата (chat_id = ctx.chat.id) и сообщайте об этом.
      const adminUserIds = (process.env.ADMIN_USER_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
      const userId = ctx.from?.id;

      const isAllowlistConfigured = adminUserIds.length > 0;

      if (isAllowlistConfigured && (!userId || !adminUserIds.includes(userId))) {
        await ctx.reply('⛔ Недостаточно прав');
        return;
      }

      const apiUrl = process.env.API_URL || 'https://lego-bot-core.vercel.app';
      const webhookUrl = `${apiUrl}/api/webhook`;
      const secretToken = process.env.TELEGRAM_SECRET_TOKEN;
      
      console.log(`🔗 Setting webhook to: ${webhookUrl}`);
      console.log(`🔐 Secret token: ${secretToken ? 'SET' : 'NOT SET'}`);

      const { setWebhook } = await import('./services/telegram-webhook');
      const result = await setWebhook(botToken, webhookUrl, secretToken, ['message', 'callback_query']);

      if (result.ok) {
        await ctx.reply(
          `✅ <b>Webhook для основного бота настроен!</b>\n\n` +
          `🔗 URL: <code>${webhookUrl}</code>\n` +
          `🔐 Secret Token: ${secretToken ? '✅ Установлен' : '⚠️ Не установлен'}\n\n` +
          `Теперь бот будет работать на Vercel.\n\n` +
          (secretToken ? '' : '⚠️ Рекомендуется установить TELEGRAM_SECRET_TOKEN для безопасности.'),
          { parse_mode: 'HTML' }
        );
        console.log(`✅ Main bot webhook configured: ${webhookUrl}`);
      } else {
        throw new Error(result.description || 'Unknown error');
      }
    } catch (error) {
      console.error('Error setting main bot webhook:', error);
      await ctx.reply(
        `❌ Ошибка настройки webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { parse_mode: 'HTML' }
      );
    }
  });

  botInstance.command('setup_miniapp', async (ctx) => {
    try {
      await handleSetupMiniApp(ctx as any);
    } catch (error) {
      console.error('Error in /setup_miniapp command:', error);
      ctx.reply('❌ Произошла ошибка при настройке Mini App.').catch(console.error);
    }
  });

  botInstance.command('check_webhook', async (ctx) => {
    try {
      await handleCheckWebhook(ctx as any);
    } catch (error) {
      console.error('Error in /check_webhook command:', error);
      ctx.reply('❌ Произошла ошибка при проверке webhook.').catch(console.error);
    }
  });

  // Команда /setwebhook <bot_id>
  botInstance.command('setwebhook', async (ctx) => {
    try {
      const message = ctx.message;
      if (!('text' in message)) return;
      
      const parts = message.text.split(' ');
      const botId = parts[1]; // Второй аргумент после команды
      
      await handleSetWebhook(ctx as any, botId);
    } catch (error) {
      console.error('Error in /setwebhook command:', error);
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch(console.error);
    }
  });

  // Команда /deletewebhook <bot_id>
  botInstance.command('deletewebhook', async (ctx) => {
    try {
      const message = ctx.message;
      if (!('text' in message)) return;
      
      const parts = message.text.split(' ');
      const botId = parts[1]; // Второй аргумент после команды
      
      await handleDeleteWebhook(ctx as any, botId);
    } catch (error) {
      console.error('Error in /deletewebhook command:', error);
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch(console.error);
    }
  });

  // Команда /editschema <bot_id> <json>
  botInstance.command('editschema', async (ctx) => {
    try {
      const message = ctx.message;
      if (!('text' in message)) return;
      
      const text = message.text;
      // Разделяем команду и аргументы
      // Формат: /editschema <bot_id> <json>
      const parts = text.split(' ');
      if (parts.length < 3) {
        await handleEditSchema(ctx as any);
        return;
      }
      
      const botId = parts[1];
      // JSON может содержать пробелы, берем все после bot_id
      const jsonStart = text.indexOf(botId) + botId.length + 1;
      const schemaJson = text.substring(jsonStart).trim();
      
      await handleEditSchema(ctx as any, botId, schemaJson);
    } catch (error) {
      console.error('Error in /editschema command:', error);
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch(console.error);
    }
  });
  
  // Обработка ошибок
  botInstance.catch((err, ctx) => {
    console.error('Error in bot:', err);
    ctx.reply('❌ Произошла ошибка. Попробуйте позже.').catch(console.error);
  });
  

  // Запуск бота через long polling (только локально, не на Vercel)
  if (process.env.VERCEL !== '1') {
    botInstance.launch({
      allowedUpdates: ['message', 'callback_query'],
      dropPendingUpdates: false,
    }).then(() => {
      console.log('✅ Telegram bot started successfully (long polling)');
      console.log('✅ Бот готов к работе');
      botInstance?.telegram.getMe().then((botInfo) => {
        console.log('🤖 Bot info:', {
          id: botInfo.id,
          username: botInfo.username,
          firstName: botInfo.first_name,
        });
        console.log('💬 Отправьте боту /start для проверки');
      }).catch(console.error);
    }).catch((error) => {
      console.error('❌ Failed to launch bot:', error);
      console.error('Проверьте:');
      console.error('1. Правильность токена в .env файле');
      console.error('2. Подключение к интернету');
      console.error('3. Доступность Telegram API');
    });
  } else {
    console.log('🔗 Bot configured for webhook mode (Vercel serverless)');
    console.log('📡 Webhook endpoint: /api/webhook');
    console.log('⚠️  Не забудьте настроить webhook через Telegram API');
    console.log('💡 Используйте: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://lego-bot-core.vercel.app/api/webhook');
  }
}

// Start server (only in non-serverless environment)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Export app for Vercel serverless functions
export default app;
module.exports = app; // Also export as CommonJS for compatibility

// Export botInstance for webhook endpoint
export { botInstance };
if (typeof module !== 'undefined') {
  (module.exports as any).botInstance = botInstance;
}

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down gracefully...');
  
  if (botInstance) {
    await botInstance.stop('SIGTERM');
  }
  
  await closePostgres();
  await closeRedis();
  
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

