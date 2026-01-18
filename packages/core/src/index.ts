import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { Telegraf, session } from 'telegraf';
import { Scenes } from 'telegraf';
import { initPostgres, closePostgres } from './db/postgres';
import { initRedis, closeRedis } from './db/redis';
import { initializeBotsTable } from './db/bots';
import { createBotScene } from './bot/scenes';
import { handleStart, handleCreateBot, handleMyBots, handleHelp } from './bot/commands';
import path from 'path';

// Загрузка .env файла из корня проекта
const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });
console.log('📄 Загрузка .env из:', envPath);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database connections
async function initializeDatabases() {
  try {
    initPostgres();
    initRedis();
    
    // Инициализация таблицы bots
    await initializeBotsTable();
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('Failed to initialize databases:', error);
    throw error;
  }
}

// Инициализация БД при запуске
initializeDatabases().catch((error) => {
  console.error('Failed to initialize databases:', error);
});

// Middleware
app.use(express.json());

// Health check
app.get('/health', async (req: Request, res: Response) => {
  const { getPool } = await import('./db/postgres');
  const { getRedisClient } = await import('./db/redis');
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    databases: {
      postgres: 'unknown',
      redis: 'unknown',
    },
  };

  // Check PostgreSQL
  try {
    const pool = getPool();
    if (pool) {
      await pool.query('SELECT 1');
      health.databases.postgres = 'connected';
    } else {
      health.databases.postgres = 'not initialized';
    }
  } catch (error) {
    health.databases.postgres = 'error';
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const redis = getRedisClient();
    await redis.ping();
    health.databases.redis = 'connected';
  } catch (error) {
    health.databases.redis = 'error';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
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
  
  // Регистрация команд
  botInstance.command('start', async (ctx) => {
    try {
      await handleStart(ctx as any);
    } catch (error) {
      console.error('Error in /start command:', error);
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch(console.error);
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
  
  // Логирование всех входящих сообщений для отладки
  botInstance.on('message', (ctx, next) => {
    console.log('📨 Получено сообщение:', {
      from: ctx.from?.id,
      username: ctx.from?.username,
      text: 'text' in ctx.message ? ctx.message.text : 'не текст',
      chatId: ctx.chat?.id,
    });
    return next();
  });
  
  // Обработка ошибок
  botInstance.catch((err, ctx) => {
    console.error('Error in bot:', err);
    ctx.reply('❌ Произошла ошибка. Попробуйте позже.').catch(console.error);
  });
  
  // Запуск бота
  botInstance.launch().then(() => {
    console.log('✅ Telegram bot started successfully');
    console.log('✅ Бот готов к работе');
    // Получаем информацию о боте
    botInstance?.telegram.getMe().then((botInfo) => {
      console.log('🤖 Bot info:', {
        id: botInfo.id,
        username: botInfo.username,
        firstName: botInfo.first_name,
      });
    }).catch(console.error);
  }).catch((error) => {
    console.error('❌ Failed to launch bot:', error);
    console.error('Проверьте:');
    console.error('1. Правильность токена в .env файле');
    console.error('2. Подключение к интернету');
    console.error('3. Доступность Telegram API');
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

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

