import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import cors, { CorsOptions } from 'cors';
import axios from 'axios';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { Telegraf, session } from 'telegraf';
import { Scenes } from 'telegraf';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { BOT_LIMITS, RATE_LIMITS, WEBHOOK_INTEGRATION_LIMITS, BotIdSchema, BroadcastIdSchema, CreateBotSchema, CreateBroadcastSchema, PaginationSchema, UpdateBotSchemaSchema, createLogger, getTelegramBotToken, validateTelegramWebAppData } from '@dialogue-constructor/shared';
import { createRateLimiter, errorMetricsMiddleware, getErrorMetrics, logBroadcastCreated, logRateLimitMetrics, metricsMiddleware, requestContextMiddleware, requestIdMiddleware, requireBotOwnership, validateBody, validateParams, validateQuery, getRequestId } from './middleware/shared/index.js';
import { validateBotSchema } from '@dialogue-constructor/shared/server';
import { initPostgres, closePostgres, getPoolStats, getPostgresCircuitBreakerStats, getPostgresConnectRetryBudgetMs, getPostgresRetryStats, POSTGRES_RETRY_CONFIG, getPostgresClient, getPostgresPoolConfig, getPostgresConnectionInfo } from './db/postgres';
import { initRedis, closeRedis, getRedisCircuitBreakerStats, getRedisClientOptional, getRedisRetryStats, getRedisInitOutcome, getRedisSkipReason, getRedisClient } from './db/redis';
import { initializeBotsTable, getBotsByUserId, getBotsByUserIdPaginated, getBotById, getBotByIdAnyUser, updateBotSchema, createBot, deleteBot, countActiveBotsByUserId, BotLimitError, resetUserBots } from './db/bots';
import { exportBotUsersToCSV, getBotTelegramUserIds, getBotUsers, getBotUserStats } from './db/bot-users';
import { exportAnalyticsToCSV, getAnalyticsEvents, getAnalyticsStats, getFunnelData, getPopularPaths, getTimeSeriesData } from './db/bot-analytics';
import { getWebhookLogsByBotId, getWebhookStats } from './db/webhook-logs';
import { cancelBroadcast, createBroadcast, createBroadcastMessages, getBroadcastById, getBroadcastStats, getBroadcastsByBotId, updateBroadcast } from './db/broadcasts';
import { createPromoCode, getAdminStats, getMaintenanceState, grantSubscriptionByAdmin, listPromoCodes, redeemPromoCode, setMaintenanceState, type MaintenanceState } from './db/admin';
import {
  addEventNote,
  createAppointment,
  getAvailability,
  getBotRoleForUser,
  getBotRoleAndPermissions,
  getBotSettings,
  getBotUsage,
  getCustomer,
  getCustomerTimeline,
  getEventsSummary,
  getOrder,
  getOwnerAccessibleBots,
  insertOwnerAudit,
  listAppointments,
  listBotTeam,
  listCustomers,
  listExportRows,
  listInboxEvents,
  listLeads,
  listOrders,
  listOwnerAudit,
  patchAppointment,
  patchCustomer,
  patchEvent,
  patchLead,
  patchOrder,
  removeBotTeamMember,
  updateBotSettings,
  upsertBotTeamMember,
  type OwnerRole,
} from './db/owner';
import { createBotScene } from './bot/scenes';
import { handleStart, handleHelp, handleInstruction, handleSetupMiniApp, handleCheckWebhook, handleCabinet } from './bot/commands';
import { handleSetWebhook, handleDeleteWebhook } from './bot/webhook-commands';
import { handleEditSchema } from './bot/schema-commands';
import path from 'path';
import * as crypto from 'crypto';
import { decryptToken, encryptToken } from './utils/encryption';
import { processBroadcastAsync } from './services/broadcast-processor';
import {
  generateCsrfToken,
  parseCookies,
  serializeCookie,
  signOwnerSession,
  verifyOwnerBotlinkToken,
  verifyOwnerSession,
  verifyTelegramLoginPayload,
} from './utils/owner-auth';

/**
 * Core Server - Основной сервер приложения
 *
 * Функциональность:
 * - Express API для фронтенда (/api/bots, /api/bot/:id/schema)
 * - Telegram бот (Telegraf) с командами /start, /help, /instruction, etc.
 * - PostgreSQL для хранения ботов (токены зашифрованы)
 * - Redis для кеширования
 */

// Загрузка .env файла из корня проекта (skip in test environment)
const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.JEST_WORKER_ID) ||
  Boolean(process.env.VITEST);

if (!isTestEnv) {
  const envPath = path.resolve(__dirname, '../../../.env');
  dotenv.config({ path: envPath });
}
const logger = createLogger('core');
if (!isTestEnv) {
  const envPath = path.resolve(__dirname, '../../../.env');
  logger.info({ path: envPath }, '📄 Загрузка .env из:');
}

// v2: Observability - Sentry initialization
if (process.env.SENTRY_DSN && !isTestEnv) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event, hint) {
      // Безопасность: не отправляем чувствительные данные
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });
  logger.info('✅ Sentry initialized');
}

let app: ReturnType<typeof express> | null = null;
let appInitialized = false;
const PORT = process.env.PORT || 3000;
let botInstance: Telegraf<Scenes.SceneContext> | null = null;

// Global cache for Vercel serverless (процесс переиспользуется между запросами)
declare global {
  var __CACHED_BOT_INSTANCE__: Telegraf<Scenes.SceneContext> | undefined;
  var __BOT_INITIALIZED__: boolean | undefined;
}

let botInitialized = false;
const registeredCommands: string[] = [];
let lastProcessedUpdate: {
  updateId: number | null;
  updateType: string | null;
  userId: number | null;
  command: string | null;
  processedAt: string | null;
} | null = null;

const OWNER_SESSION_COOKIE = 'owner_session';
const OWNER_COOKIE_PATH = '/';
const OWNER_SESSION_TTL_SEC = 60 * 60 * 12; // 12h

const ownerAuthRateWindowMs = 60_000;
const ownerAuthRateMax = 20;
const ownerAuthHits = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_ADMIN_USER_IDS = [1217607615];
const MAINTENANCE_CACHE_MS = 10000;
let maintenanceCache: MaintenanceState = {
  enabled: false,
  message: null,
  updatedBy: null,
  updatedAt: null,
};
let maintenanceCacheLoadedAt = 0;

function getAdminUserIds(): number[] {
  const adminUserIds = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  return adminUserIds.length > 0 ? adminUserIds : DEFAULT_ADMIN_USER_IDS;
}

function isAdminUser(userId?: number | null): boolean {
  if (!userId) return false;
  return getAdminUserIds().includes(userId);
}

async function getMaintenanceStateCached(force = false): Promise<MaintenanceState> {
  if (!dbInitialized && !force) {
    return maintenanceCache;
  }

  const now = Date.now();
  if (!force && maintenanceCacheLoadedAt && now - maintenanceCacheLoadedAt < MAINTENANCE_CACHE_MS) {
    return maintenanceCache;
  }

  try {
    const state = await getMaintenanceState();
    maintenanceCache = state;
    maintenanceCacheLoadedAt = now;
    return state;
  } catch (error) {
    logger.warn({ error }, 'Failed to load maintenance state, using cached value');
    return maintenanceCache;
  }
}

async function initBot(): Promise<void> {
  // Проверка глобального кеша (Vercel warm start)
  if (global.__CACHED_BOT_INSTANCE__) {
    logger.info('♻️ Reusing cached bot instance (Vercel warm start)');
    botInstance = global.__CACHED_BOT_INSTANCE__;
    botInitialized = global.__BOT_INITIALIZED__ || false;
    return;
  }

  // Проверка токена
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.warn('⚠️ TELEGRAM_BOT_TOKEN is not set, bot disabled');
    return;
  }

  logger.info('🤖 Initializing bot instance...');
  
  // Инициализация DB ПЕРЕД ботом
  await initializeDatabases();
  
  logger.info({ tokenPrefix: botToken.substring(0, 10) + '...' }, '🔑 Токен бота найден:');
    // Создание бота с поддержкой сцен (FSM)
    botInstance = new Telegraf<Scenes.SceneContext>(botToken);
    global.__CACHED_BOT_INSTANCE__ = botInstance;
    logger.info('🤖 Bot instance created');
    
    // Настройка сессий (используем память для простоты, в продакшене лучше Redis)
    botInstance.use(session());
    
    // Регистрация сцен
    const stage = new Scenes.Stage<Scenes.SceneContext>([createBotScene as any]);
    botInstance.use(stage.middleware());
    logger.info('✅ Scenes registered');
    
    // Логирование всех входящих обновлений для отладки (ПОСЛЕ middleware, НО перед командами)
    botInstance.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const updateType = ctx.updateType;
      const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
      const isCommand = Boolean(messageText && messageText.startsWith('/'));
      const commandText = isCommand ? messageText : undefined;
      const updateId = ctx.update.update_id;
      logger.info(
        { userId, chatId, updateType, isCommand, commandText, updateId },
        '📨 Bot middleware: Update received'
      );
      const maintenance = await getMaintenanceStateCached();
      if (maintenance.enabled && !isAdminUser(userId)) {
        const message = maintenance.message || 'Бот временно на технических работах. Попробуйте позже.';
        if (userId) {
          try {
            await botInstance?.telegram.sendMessage(userId, message);
          } catch (sendError) {
            logger.warn({ userId, sendError }, 'Failed to send maintenance message');
          }
        }
        return;
      }
      try {
        const result = await next();
        
        // Сохраняем информацию о последнем обработанном update
        lastProcessedUpdate = {
          updateId,
          updateType,
          userId: userId || null,
          command: commandText || null,
          processedAt: new Date().toISOString(),
        };
        
        logger.info(
          { userId, chatId, updateType, updateId },
          '✅ Bot middleware: Update processed successfully'
        );
        
        return result;
      } catch (error) {
        logger.error({ userId, chatId, updateType, updateId, error }, '❌ Bot middleware error');
        throw error;
      }
    });
    
    // Регистрация команд
    botInstance.command('start', async (ctx) => {
      const userId = ctx.from?.id;
      const command = '/start';
      logger.info({ userId, command, username: ctx.from?.username }, '🎯 Команда /start получена');
      try {
        await handleStart(ctx as any);
      logger.info({ userId, command }, '✅ Команда /start обработана успешно');
    } catch (error) {
      logger.error({ userId, command, error }, '❌ Error in /start command:');
      try {
        await ctx.reply('❌ Произошла ошибка при обработке команды.');
      } catch (replyError) {
        logger.error({ userId, command, error: replyError }, '❌ Failed to send error message:');
      }
    }
  });
  registeredCommands.push('/start');
  logger.info({ command: '/start' }, '✅ Command registered');
  
  botInstance.command('create_bot', async (ctx) => {
    const userId = ctx.from?.id;
    const command = '/create_bot';
    logger.info({ userId, command }, 'ℹ️ Legacy command received');
    await ctx.reply(
      'Создание бота через чат отключено.\n\n' +
        'Используйте Mini App: кнопка "🚀 Open Mini App".\n' +
        'Подробная инструкция: /instruction'
    ).catch((error) => {
      logger.error({ userId, command, error }, 'Failed to send legacy command message');
    });
  });

  botInstance.command('my_bots', async (ctx) => {
    const userId = ctx.from?.id;
    const command = '/my_bots';
    logger.info({ userId, command }, 'ℹ️ Legacy command received');
    await ctx.reply(
      'Список ботов в чате отключен.\n\n' +
        'Управление ботами теперь доступно только в Mini App: "🚀 Open Mini App".\n' +
        'Подробная инструкция: /instruction'
    ).catch((error) => {
      logger.error({ userId, command, error }, 'Failed to send legacy command message');
    });
  });

  botInstance.command('help', async (ctx) => {
    const userId = ctx.from?.id;
    const command = '/help';
    logger.info({ userId, command }, '🎯 Команда /help получена');
    try {
      await handleHelp(ctx as any);
    } catch (error) {
      logger.error({ userId, command, error }, 'Error in /help command:');
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch((replyError) => {
        logger.error({ userId, command, error: replyError }, 'Failed to send error message');
      });
    }
  });
  registeredCommands.push('/help');
  logger.info({ command: '/help' }, '✅ Command registered');

  botInstance.command('instruction', async (ctx) => {
    const userId = ctx.from?.id;
    const command = '/instruction';
    logger.info({ userId, command }, '🎯 Команда /instruction получена');
    try {
      await handleInstruction(ctx as any);
    } catch (error) {
      logger.error({ userId, command, error }, 'Error in /instruction command:');
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch((replyError) => {
        logger.error({ userId, command, error: replyError }, 'Failed to send error message');
      });
    }
  });
  registeredCommands.push('/instruction');
  logger.info({ command: '/instruction' }, '✅ Command registered');

  botInstance.command('cabinet', async (ctx) => {
    const userId = ctx.from?.id;
    const command = '/cabinet';
    logger.info({ userId, command }, '🎯 Команда /cabinet получена');
    try {
      await handleCabinet(ctx as any);
    } catch (error) {
      logger.error({ userId, command, error }, 'Error in /cabinet command:');
      ctx.reply('❌ Произошла ошибка при входе в кабинет.').catch((replyError) => {
        logger.error({ userId, command, error: replyError }, 'Failed to send error message');
      });
    }
  });
  registeredCommands.push('/cabinet');
  logger.info({ command: '/cabinet' }, '✅ Command registered');
  
  // Обработка callback_query (кнопки)
  botInstance.action('back_to_menu', async (ctx) => {
    const userId = ctx.from?.id;
    const command = 'back_to_menu';
    try {
      await ctx.answerCbQuery();
      await handleStart(ctx as any);
      logger.info({ userId, command }, '✅ Возврат в главное меню');
    } catch (error) {
      logger.error({ userId, command, error }, 'Error handling back_to_menu:');
      ctx.answerCbQuery('Ошибка при возврате в меню').catch((replyError) => {
        logger.error(
          { userId, command, error: replyError },
          'Failed to answer callback query'
        );
      });
    }
  });
  
  botInstance.action('create_bot', async (ctx) => {
    const userId = ctx.from?.id;
    const command = 'create_bot';
    try {
      await ctx.answerCbQuery();
      await ctx.reply(
        'Создание бота через кнопки чата отключено.\n' +
          'Откройте Mini App: "🚀 Open Mini App".\n' +
          'Инструкция: /instruction'
      );
    } catch (error) {
      logger.error({ userId, command, error }, 'Error handling create_bot action:');
      ctx.answerCbQuery('Ошибка').catch((replyError) => {
        logger.error(
          { userId, command, error: replyError },
          'Failed to answer callback query'
        );
      });
    }
  });
  
  botInstance.action('my_bots', async (ctx) => {
    const userId = ctx.from?.id;
    const command = 'my_bots';
    try {
      await ctx.answerCbQuery();
      await ctx.reply(
        'Просмотр списка ботов через кнопки чата отключен.\n' +
          'Откройте Mini App: "🚀 Open Mini App".\n' +
          'Инструкция: /instruction'
      );
    } catch (error) {
      logger.error({ userId, command, error }, 'Error handling my_bots action:');
      ctx.answerCbQuery('Ошибка').catch((replyError) => {
        logger.error(
          { userId, command, error: replyError },
          'Failed to answer callback query'
        );
      });
    }
  });
  
  botInstance.action('help', async (ctx) => {
    const userId = ctx.from?.id;
    const command = 'help';
    try {
      await ctx.answerCbQuery();
      await handleHelp(ctx as any);
    } catch (error) {
      logger.error({ userId, command, error }, 'Error handling help action:');
      ctx.answerCbQuery('Ошибка').catch((replyError) => {
        logger.error(
          { userId, command, error: replyError },
          'Failed to answer callback query'
        );
      });
    }
  });

  botInstance.action('instruction', async (ctx) => {
    const userId = ctx.from?.id;
    const command = 'instruction';
    try {
      await ctx.answerCbQuery();
      await handleInstruction(ctx as any);
    } catch (error) {
      logger.error({ userId, command, error }, 'Error handling instruction action:');
      ctx.answerCbQuery('Ошибка').catch((replyError) => {
        logger.error(
          { userId, command, error: replyError },
          'Failed to answer callback query'
        );
      });
    }
  });

  // Команда для настройки webhook основного бота
  botInstance.command('setup_webhook', async (ctx) => {
    const userId = ctx.from?.id;
    const command = '/setup_webhook';
    logger.info({ userId, command }, '🎯 Команда /setup_webhook получена');
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
        await ctx.reply('🛑 Недостаточно прав');
        return;
      }

      const apiUrl = process.env.API_URL || 'https://lego-bot-core.vercel.app';
      const webhookUrl = `${apiUrl}/api/webhook`;
      const secretToken = process.env.TELEGRAM_SECRET_TOKEN;
      
      logger.info({ userId, command, webhookUrl }, '🔗 Setting webhook to');
      logger.info({ userId, command, secretTokenSet: Boolean(secretToken) }, '🔒 Secret token');

      const { setWebhook } = await import('./services/telegram-webhook');
      const result = await setWebhook(botToken, webhookUrl, secretToken, ['message', 'callback_query']);

      if (result.ok) {
        await ctx.reply(
          `✅ <b>Webhook для основного бота настроен!</b>\n\n` +
          `🔗 URL: <code>${webhookUrl}</code>\n` +
          `🔒 Secret Token: ${secretToken ? '✅ Установлен' : '⚠️ Не установлен'}\n\n` +
          `Теперь бот будет работать на Vercel.\n\n` +
          (secretToken ? '' : '⚠️ Рекомендуется установить TELEGRAM_SECRET_TOKEN для безопасности.'),
          { parse_mode: 'HTML' }
        );
        logger.info({ userId, command, webhookUrl }, '✅ Main bot webhook configured');
      } else {
        throw new Error(result.description || 'Unknown error');
      }
    } catch (error) {
      logger.error({ userId, command, error }, 'Error setting main bot webhook:');
      await ctx.reply(
        `❌ Ошибка настройки webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { parse_mode: 'HTML' }
      );
    }
  });
  registeredCommands.push('/setup_webhook');
  logger.info({ command: '/setup_webhook' }, '✅ Command registered');

  botInstance.command('setup_miniapp', async (ctx) => {
    const userId = ctx.from?.id;
    const command = '/setup_miniapp';
    logger.info({ userId, command }, '🎯 Команда /setup_miniapp получена');
    try {
      await handleSetupMiniApp(ctx as any);
    } catch (error) {
      logger.error({ userId, command, error }, 'Error in /setup_miniapp command:');
      ctx.reply('❌ Произошла ошибка при настройке Mini App.').catch((replyError) => {
        logger.error({ userId, command, error: replyError }, 'Failed to send error message');
      });
    }
  });
  registeredCommands.push('/setup_miniapp');
  logger.info({ command: '/setup_miniapp' }, '✅ Command registered');

  botInstance.command('check_webhook', async (ctx) => {
    const userId = ctx.from?.id;
    const command = '/check_webhook';
    logger.info({ userId, command }, '🎯 Команда /check_webhook получена');
    try {
      await handleCheckWebhook(ctx as any);
    } catch (error) {
      logger.error({ userId, command, error }, 'Error in /check_webhook command:');
      ctx.reply('❌ Произошла ошибка при проверке webhook.').catch((replyError) => {
        logger.error({ userId, command, error: replyError }, 'Failed to send error message');
      });
    }
  });
  registeredCommands.push('/check_webhook');
  logger.info({ command: '/check_webhook' }, '✅ Command registered');

  // Команда /setwebhook <bot_id>
  botInstance.command('setwebhook', async (ctx) => {
    const userId = ctx.from?.id;
    const command = '/setwebhook';
    logger.info({ userId, command }, '🎯 Команда /setwebhook получена');
    try {
      const message = ctx.message;
      if (!('text' in message)) return;
      
      const parts = message.text.split(' ');
      const botId = parts[1]; // Второй аргумент после команды
      
      await handleSetWebhook(ctx as any, botId);
      logger.info({ userId, command, botId }, '✅ Webhook setup completed');
    } catch (error) {
      const message = ctx.message;
      const botId = message && 'text' in message ? message.text.split(' ')[1] : undefined;
      logger.error(
        { userId, command, botId, error, metric: 'webhook_setup_error' },
        'Error in /setwebhook command:'
      );
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch((replyError) => {
        logger.error(
          { userId, command, botId, error: replyError },
          'Failed to send error message'
        );
      });
    }
  });
  registeredCommands.push('/setwebhook');
  logger.info({ command: '/setwebhook' }, '✅ Command registered');

  // Команда /deletewebhook <bot_id>
  botInstance.command('deletewebhook', async (ctx) => {
    const userId = ctx.from?.id;
    const command = '/deletewebhook';
    logger.info({ userId, command }, '🎯 Команда /deletewebhook получена');
    try {
      const message = ctx.message;
      if (!('text' in message)) return;
      
      const parts = message.text.split(' ');
      const botId = parts[1]; // Второй аргумент после команды
      
      await handleDeleteWebhook(ctx as any, botId);
      logger.info({ userId, command, botId }, '✅ Webhook deleted');
    } catch (error) {
      const message = ctx.message;
      const botId = message && 'text' in message ? message.text.split(' ')[1] : undefined;
      logger.error({ userId, command, botId, error }, 'Error in /deletewebhook command:');
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch((replyError) => {
        logger.error(
          { userId, command, botId, error: replyError },
          'Failed to send error message'
        );
      });
    }
  });
  registeredCommands.push('/deletewebhook');
  logger.info({ command: '/deletewebhook' }, '✅ Command registered');

  // Команда /editschema <bot_id> <json>
  botInstance.command('editschema', async (ctx) => {
    const userId = ctx.from?.id;
    const command = '/editschema';
    logger.info({ userId, command }, '🎯 Команда /editschema получена');
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
      logger.info({ userId, command, botId }, '✅ Schema edit handled');
    } catch (error) {
      logger.error({ userId, command, error }, 'Error in /editschema command:');
      ctx.reply('❌ Произошла ошибка при обработке команды.').catch((replyError) => {
        logger.error({ userId, command, error: replyError }, 'Failed to send error message');
      });
    }
  });
  registeredCommands.push('/editschema');
  logger.info({ command: '/editschema' }, '✅ Command registered');
  
  // Обработка ошибок
  botInstance.catch((err, ctx) => {
    const userId = ctx.from?.id;
    logger.error({ userId, error: err }, 'Error in bot:');
    ctx.reply('❌ Произошла ошибка. Попробуйте позже.').catch((replyError) => {
      logger.error({ userId, error: replyError }, 'Failed to send error message');
    });
  });
  
  logger.info({ commands: registeredCommands }, '✅ Bot fully initialized with all commands');
  botInitialized = true;
  global.__BOT_INITIALIZED__ = true;
  logger.info('✅ Bot initialized successfully');

  // Запуск бота через long polling (только локально, не на Vercel)
  if (process.env.VERCEL !== '1') {
    botInstance.launch({
      allowedUpdates: ['message', 'callback_query'],
      dropPendingUpdates: false,
    }).then(() => {
      logger.info('✅ Telegram bot started successfully (long polling)');
      logger.info('✅ Бот готов к работе');
      botInstance?.telegram.getMe().then((botInfo) => {
        logger.info(
          { id: botInfo.id, username: botInfo.username, firstName: botInfo.first_name },
          '🤖 Bot info:'
        );
        logger.info('💡 Отправьте боту /start для проверки');
      }).catch((error) => {
        logger.error({ error }, 'Failed to fetch bot info');
      });
    }).catch((error) => {
      logger.error({ error }, '❌ Failed to launch bot:');
      logger.error('Проверьте:');
      logger.error('1. Правильность токена в .env файле');
      logger.error('2. Подключение к интернету');
      logger.error('3. Доступность Telegram API');
    });
  } else {
    logger.info('🔗 Bot configured for webhook mode (Vercel serverless)');
    logger.info('📡 Webhook endpoint: /api/webhook');
    logger.info('⚠️  Не забудьте настроить webhook через Telegram API');
    logger.info('💡 Используйте: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://lego-bot-core.vercel.app/api/webhook');
  }
}

declare global {
  var __BOT_INIT_PROMISE__: Promise<void> | undefined;
}

async function ensureBotInitialized(): Promise<void> {
  if (botInitialized && botInstance) {
    return;
  }
  
  if (global.__BOT_INIT_PROMISE__) {
    logger.info('⏳ Bot initialization in progress, waiting...');
    return global.__BOT_INIT_PROMISE__;
  }
  
  global.__BOT_INIT_PROMISE__ = initBot();
  
  try {
    await global.__BOT_INIT_PROMISE__;
  } finally {
    global.__BOT_INIT_PROMISE__ = undefined;
  }
}

export function createApp(): ReturnType<typeof express> {
  if (!app) {
    app = express();
  }
  if (!appInitialized) {
    configureApp(app);
    appInitialized = true;
  }
  return app;
}

// Initialize database connections
let dbInitialized = false;
let dbInitializationPromise: Promise<void> | null = null;
let redisAvailable = true;
let redisSkipped = false; // true if intentionally skipped
let redisSkipReason: 'missing_url' | 'localhost_on_vercel' | null = null;
let webhookSecurityEnabled = true;
let botEnabled = true;
let encryptionAvailable = true;
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

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(\+?\d[\d\s()-]{6,}\d)/g;

const maskSensitive = (value: string) =>
  value.replace(EMAIL_REGEX, '[redacted]').replace(PHONE_REGEX, '[redacted]');

const parseAllowlist = (value?: string) => {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

const isIpPrivate = (ip: string) => {
  if (ip.includes(':')) {
    const normalized = ip.toLowerCase();
    return (
      normalized === '::1' ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd')
    );
  }

  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  return false;
};

const isDisallowedHost = (hostname: string) => {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) {
    return true;
  }
  if (isIP(lower)) {
    return isIpPrivate(lower);
  }
  return false;
};

const isAllowedByAllowlist = (hostname: string, allowlist: string[]) => {
  if (allowlist.length === 0) {
    return true;
  }
  const lower = hostname.toLowerCase();
  return allowlist.some((domain) => lower === domain || lower.endsWith(`.${domain}`));
};

async function ensureSafeWebhookUrl(url: string): Promise<URL> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use https');
  }

  const allowlist = parseAllowlist(process.env.WEBHOOK_DOMAIN_ALLOWLIST);
  if (!isAllowedByAllowlist(parsed.hostname, allowlist)) {
    throw new Error('Webhook URL is not in allowlist');
  }

  if (isDisallowedHost(parsed.hostname)) {
    throw new Error('Webhook URL points to a disallowed host');
  }

  const resolved = await lookup(parsed.hostname, { all: true });
  for (const record of resolved) {
    if (isDisallowedHost(record.address)) {
      throw new Error('Webhook URL resolves to a disallowed address');
    }
  }

  return parsed;
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

type EnvGroupStatus = {
  present: string[];
  missing: string[];
};

type EnvValidationResult = {
  infraRequired: EnvGroupStatus;
  featureRequired: EnvGroupStatus;
  vercelRecommended: EnvGroupStatus;
  optional: EnvGroupStatus;
  allInfraPresent: boolean;
  isVercel: boolean;
};

function validateRequiredEnvVars(): EnvValidationResult {
  const isSet = (key: string) => String(process.env[key] ?? '').trim().length > 0;
  const isVercel = process.env.VERCEL === '1';
  const infraRequired = isVercel
    ? ['DATABASE_URL', 'ENCRYPTION_KEY', 'TELEGRAM_BOT_TOKEN']
    : ['DATABASE_URL'];
  const featureRequired = ['TELEGRAM_BOT_TOKEN', 'ENCRYPTION_KEY'];
  const vercelRecommended = ['TELEGRAM_SECRET_TOKEN'];
  const optional = ['REDIS_URL'];

  const buildGroup = (keys: string[]): EnvGroupStatus => ({
    present: keys.filter((key) => isSet(key)),
    missing: keys.filter((key) => !isSet(key)),
  });

  const infraStatus = buildGroup(infraRequired);
  const featureStatus = buildGroup(featureRequired);
  const vercelRecommendedStatus = buildGroup(vercelRecommended);
  const optionalStatus = buildGroup(optional);

  return {
    infraRequired: infraStatus,
    featureRequired: featureStatus,
    vercelRecommended: vercelRecommendedStatus,
    optional: optionalStatus,
    allInfraPresent: infraStatus.missing.length === 0,
    isVercel,
  };
}

async function initializeDatabases() {
  const isVercel = process.env.VERCEL === '1';
  const initializationTimeoutMs = isVercel ? getPostgresConnectRetryBudgetMs() + 2000 : 0;

  if (dbInitialized) {
    logger.info('✅ Databases already initialized');
    return;
  }
  
  if (dbInitializationPromise) {
    logger.info('⏳ Database initialization in progress, waiting...');
    return initializationTimeoutMs
      ? withTimeout(dbInitializationPromise, initializationTimeoutMs, () => {
          return new Error(
            `Database initialization timed out after ${initializationTimeoutMs}ms (stage: ${dbInitializationStage || 'unknown'})`
          );
        })
      : dbInitializationPromise;
  }
  
  logger.info('🚀 Initializing databases...');
  logger.info('🔧 Environment variables:');
  logger.info({ value: process.env.DATABASE_URL ? 'SET' : 'NOT SET' }, '  DATABASE_URL:');
  logger.info({ value: process.env.REDIS_URL ? 'SET' : 'NOT SET' }, '  REDIS_URL:');
  logger.info({ value: process.env.VERCEL }, '  VERCEL:');
  logger.info({ value: process.env.VERCEL_ENV }, '  VERCEL_ENV:');

  logger.info('🔍 Environment Variables Validation:');
  const envCheck = validateRequiredEnvVars();
  const isSet = (key: string) => String(process.env[key] ?? '').trim().length > 0;
  const optionalMissing = envCheck.optional.missing;
  const secretTokenPresent = isSet('TELEGRAM_SECRET_TOKEN');
  const botTokenPresent = envCheck.featureRequired.present.includes('TELEGRAM_BOT_TOKEN');
  const encryptionKeyPresent = envCheck.featureRequired.present.includes('ENCRYPTION_KEY');

  logger.info(
    {
      required: envCheck.infraRequired.present.length,
      missing: envCheck.infraRequired.missing.length,
      details: {
        present: envCheck.infraRequired.present,
        missing: envCheck.infraRequired.missing,
      },
    },
    'Environment check result'
  );
  if (envCheck.infraRequired.present.length > 0) {
    logger.info(`✅ Required: ${envCheck.infraRequired.present.join(', ')}`);
  }
  if (envCheck.infraRequired.missing.length > 0) {
    logger.error(`❌ Missing required: ${envCheck.infraRequired.missing.join(', ')}`);
  }
  if (optionalMissing.length > 0) {
    logger.warn(`⚠️ Optional missing: ${optionalMissing.join(', ')}`);
  }
  if (!secretTokenPresent) {
    if (isVercel) {
      logger.warn('⚠️ Missing: TELEGRAM_SECRET_TOKEN. Generate with: openssl rand -hex 32');
    } else {
      logger.warn('⚠️ Missing: TELEGRAM_SECRET_TOKEN');
    }
  }

  botEnabled = botTokenPresent;
  encryptionAvailable = encryptionKeyPresent;
  webhookSecurityEnabled = secretTokenPresent;

  logger.info('📋 Environment Variables Status:');
  logger.info(`  DATABASE_URL: ${process.env.DATABASE_URL ? '✅ SET' : '❌ MISSING'}`);
  logger.info(`  ENCRYPTION_KEY: ${process.env.ENCRYPTION_KEY ? '✅ SET' : '❌ MISSING'}`);
  logger.info(`  TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ SET' : '❌ MISSING'}`);
  logger.info(
    `  TELEGRAM_SECRET_TOKEN: ${
      process.env.TELEGRAM_SECRET_TOKEN ? '✅ SET' : '⚠️ MISSING (recommended)'
    }`
  );
  logger.info(`  REDIS_URL: ${process.env.REDIS_URL ? '✅ SET' : '⚠️ MISSING (optional)'}`);
  if (isVercel) {
    logger.info('🔧 Vercel deployment detected - strict validation enabled');
  }

  if (!botEnabled) {
    logger.error('❌ TELEGRAM_BOT_TOKEN is missing; bot features are disabled');
  }
  if (!encryptionAvailable) {
    logger.error('❌ ENCRYPTION_KEY is missing; encryption-dependent endpoints are disabled');
  }

  if (!envCheck.allInfraPresent) {
    if (
      isVercel &&
      (envCheck.infraRequired.missing.includes('ENCRYPTION_KEY') ||
        envCheck.infraRequired.missing.includes('TELEGRAM_BOT_TOKEN'))
    ) {
      const error = new Error(
        `Missing critical environment variables for Vercel deployment: ${envCheck.infraRequired.missing.join(', ')}. ` +
          'Configure them in Vercel Dashboard → [Project Name] → Settings → Environment Variables → Add. ' +
          'Required: DATABASE_URL, ENCRYPTION_KEY, TELEGRAM_BOT_TOKEN. ' +
          'Recommended: TELEGRAM_SECRET_TOKEN. ' +
          'See .env.example for generation instructions. ' +
          'https://vercel.com/docs/projects/environment-variables'
      );
      (error as any).missingVars = envCheck.infraRequired.missing;
      throw error;
    }

    const error = new Error(
      `Missing required environment variables: ${envCheck.infraRequired.missing.join(', ')}. ` +
        `Present: ${envCheck.infraRequired.present.join(', ') || 'none'}. ` +
        'Check Vercel Dashboard → Project Settings → Environment Variables.'
    );
    (error as any).missingVars = envCheck.infraRequired.missing;
    throw error;
  }
  
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
      const connection = getSafePostgresConnectionInfo(process.env.DATABASE_URL);
      const environment = isVercel ? 'Vercel serverless' : 'Local/traditional';
      logger.info({ connection, environment }, 'PostgreSQL connection state: connecting');
      logger.info('🐘 Initializing PostgreSQL...');
      const postgresStart = Date.now();
      try {
        await initPostgres(logger);
        logger.info({ durationMs: Date.now() - postgresStart }, '✅ PostgreSQL initialized');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const postgresError = new Error(`PostgreSQL initialization failed: ${message}`);
        (postgresError as any).database = 'postgres';
        throw postgresError;
      }
      
      dbInitializationStage = 'redis';
      logger.info('🔴 Initializing Redis...');
      const redisStart = Date.now();
      try {
        const redisClient = await initRedis(logger);
        if (redisClient) {
          logger.info({ durationMs: Date.now() - redisStart }, '✅ Redis initialized');
          redisAvailable = true;
          redisSkipped = false;
          redisSkipReason = null;
        } else {
          // Single source of truth: derive "skipped vs failed" from redis.ts outcome
          redisAvailable = false;
          redisSkipped = getRedisInitOutcome() === 'skipped';
          redisSkipReason = getRedisSkipReason();

          const message = redisSkipped
            ? `⏭️ Redis skipped (${redisSkipReason ?? 'unknown_reason'})`
            : '⚠️ Redis initialization failed, continuing without cache';
          logger.warn(message);
        }
      } catch (error) {
        redisAvailable = false;
        redisSkipped = false; // Failed, not skipped
        redisSkipReason = null;
        logger.warn({ error }, '⚠️ Redis initialization failed, continuing without cache:');
      }

      dbInitializationStage = 'validate_postgres';
      logger.info('🔍 Validating PostgreSQL connection...');
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
        logger.info(
          { durationMs: Date.now() - postgresValidationStart },
          '✅ PostgreSQL connection verified'
        );
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
          logger.info(
            { durationMs: Date.now() - redisValidationStart },
            '✅ Redis connection verified'
          );
        } catch (error) {
          redisAvailable = false;
          logger.warn({ error }, '⚠️ Redis ping failed, continuing without cache:');
        }
      }
      
      dbInitializationStage = 'tables';
      logger.info('📉 Initializing bots table...');
      const tablesStart = Date.now();
      // Инициализируем таблицу bots
      await initializeBotsTable();
      logger.info({ durationMs: Date.now() - tablesStart }, '✅ Database tables initialized');
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
      logger.info({ totalDurationMs }, '✅ All databases initialized successfully');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('✅ Core Service Ready');
      logger.info(
        `  Database: ${
          envCheck.infraRequired.present.includes('DATABASE_URL') ? 'Connected' : 'N/A'
        }`
      );
      logger.info(
        `  Redis: ${redisAvailable ? 'Connected' : redisSkipped ? 'Skipped' : 'Unavailable'}`
      );
      logger.info(
        `  Bot: ${botEnabled ? 'Enabled' : 'Disabled (missing TELEGRAM_BOT_TOKEN)'}`
      );
      logger.info(
        `  Encryption: ${
          encryptionAvailable ? 'Enabled' : 'Disabled (missing ENCRYPTION_KEY)'
        }`
      );
      logger.info(
        `  Webhook Security: ${
          webhookSecurityEnabled ? 'Enabled' : 'Disabled (missing TELEGRAM_SECRET_TOKEN)'
        }`
      );
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
      logger.error({ error }, '❌ Failed to initialize databases:');
      logger.error({ errorType: error?.constructor?.name }, 'Error type:');
      logger.error({ message }, 'Error message:');
      if ((error as any).missingVars) {
        logger.error(
          {
            missingVars: (error as any).missingVars,
            vercelDashboard: 'https://vercel.com/dashboard',
            action: 'Add missing variables in Project Settings → Environment Variables',
          },
          'Environment configuration required'
        );
      }
      logger.error(
        { stack: error instanceof Error ? error.stack : 'No stack' },
        'Error stack:'
      );
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

let databasesInitialized = false;
let ensureDbInitPromise: Promise<void> | null = null;

async function prewarmConnections() {
  const isVercel = process.env.VERCEL === '1';
  if (!isVercel) {
    return;
  }

  try {
    const client = await getPostgresClient();
    await client.query('SELECT 1');
    client.release();
    logger.info('✅ PostgreSQL connection prewarmed');

    const redisClient = await getRedisClientOptional();
    if (redisClient) {
      await redisClient.ping();
      logger.info('✅ Redis connection prewarmed');
    }
  } catch (error) {
    logger.warn({ error }, '⚠️ Connection prewarming failed');
  }
}

// Middleware для проверки инициализации БД
async function ensureDatabasesInitialized(req: Request, res: Response, next: Function) {
  if (req.method === 'OPTIONS') return next();
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  const middlewareStart = Date.now();
  try {
    logger.info(
      { requestId },
      '🔍 ensureDatabasesInitialized - checking DB initialization...'
    );
    logger.info({ requestId, dbInitialized }, '📉 DB initialized flag:');
    
    if (!databasesInitialized) {
      if (!ensureDbInitPromise) {
        ensureDbInitPromise = initializeDatabases()
          .then(() => {
            databasesInitialized = true;
            void prewarmConnections();
          })
          .finally(() => {
            ensureDbInitPromise = null;
          });
      }
      await ensureDbInitPromise;
    }
    logger.info(
      { requestId, durationMs: Date.now() - middlewareStart },
      '✅ Databases initialized, proceeding with request'
    );
    next();
  } catch (error) {
    const durationMs = Date.now() - middlewareStart;
    logger.warn({ requestId, error }, '❌ Database initialization error in middleware:');
    logger.warn({ requestId, errorType: error?.constructor?.name }, 'Error type:');
    logger.warn(
      { requestId, message: error instanceof Error ? error.message : String(error) },
      'Error message:'
    );
    logger.warn(
      { requestId, stack: error instanceof Error ? error.stack : 'No stack' },
      'Error stack:'
    );

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
    logger.warn({ requestId }, '🔍 Environment check:');
    logger.warn(
      { requestId, value: process.env.DATABASE_URL ? 'SET' : 'NOT SET' },
      '  DATABASE_URL:'
    );
    logger.warn(
      { requestId, value: process.env.REDIS_URL ? 'SET' : 'NOT SET' },
      '  REDIS_URL:'
    );
    logger.warn({ requestId, value: process.env.VERCEL }, '  VERCEL:');
    logger.warn({ requestId, value: process.env.NODE_ENV }, '  NODE_ENV:');
    logger.warn({ requestId, poolState }, '🔍 PostgreSQL pool state:');
    logger.warn({ requestId, postgresConnectionInfo }, '🔍 PostgreSQL connection info:');
    const failedDatabase = (error as any)?.database || 'postgres';
    const maxRetries = POSTGRES_RETRY_CONFIG.maxRetries;
    const allowEnvDetails =
      process.env.NODE_ENV !== 'production' ||
      (process.env.HEALTH_TOKEN &&
        req.headers['x-health-token'] === process.env.HEALTH_TOKEN);
    const envCheck = validateRequiredEnvVars();
    const requiresEncryption =
      (req.path === '/api/bots' && req.method === 'POST') ||
      (req.path.startsWith('/api/bot/') &&
        (req.method === 'POST' || req.method === 'PUT') &&
        req.path.endsWith('/schema'));
    const requiresBot = req.path === '/api/webhook';

    if (req.path === '/api/webhook') {
      logger.info({ metric: 'webhook_error', requestId }, 'Webhook error');
    }

    const responsePayload: Record<string, any> = {
      error: 'Service temporarily unavailable',
      message: 'Database initialization failed',
      database: failedDatabase,
      stage: dbInitializationStage,
      attempts: maxRetries,
      totalDurationMs: lastDatabaseInitialization.durationMs ?? durationMs,
      lastError: error instanceof Error ? error.message : String(error),
      recommendation: 'Retry in 5 seconds',
    };

    responsePayload.environmentCheck = {
      infraRequired: {
        DATABASE_URL: process.env.DATABASE_URL?.trim() ? 'SET' : 'MISSING',
      },
      optional: {
        REDIS_URL: process.env.REDIS_URL?.trim() ? 'SET' : 'MISSING',
      },
    };
    if (allowEnvDetails || requiresEncryption || requiresBot) {
      responsePayload.environmentCheck.featureRequired = {
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN?.trim() ? 'SET' : 'MISSING',
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY?.trim() ? 'SET' : 'MISSING',
      };
    }
    if (allowEnvDetails || requiresEncryption || requiresBot) {
      responsePayload.troubleshooting = {
        recommendation:
          'Check Vercel Dashboard → Project Settings → Environment Variables',
        vercelEnv: process.env.VERCEL_ENV,
        isVercel: process.env.VERCEL === '1',
        missingRequired: envCheck.infraRequired.missing,
      };
    }

    res.status(503).json(responsePayload);
  }
}

// Инициализация БД при запуске (не блокирующая)
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
  // Локально инициализируем сразу
  initializeDatabases().catch((error) => {
    logger.error({ error }, 'Failed to initialize databases on startup:');
  });
} else {
  // На Vercel инициализируем лениво при первом запросе
  logger.info('📦 Vercel environment detected - databases will be initialized on first request');
}

let apiGeneralLimiter: ReturnType<typeof createRateLimiter> | null = null;
let createBotLimiter: ReturnType<typeof createRateLimiter> | null = null;
let updateSchemaLimiter: ReturnType<typeof createRateLimiter> | null = null;
let exportUsersLimiter: ReturnType<typeof createRateLimiter> | null = null;
let createBroadcastLimiter: ReturnType<typeof createRateLimiter> | null = null;
let rateLimiterInitPromise: Promise<void> | null = null;
let rateLimiterReady: Promise<void> | null = null;

async function initializeRateLimiters() {
  if (apiGeneralLimiter && createBotLimiter && updateSchemaLimiter && exportUsersLimiter && createBroadcastLimiter) {
    return;
  }
  if (!rateLimiterInitPromise) {
    rateLimiterInitPromise = (async () => {
      await initializeDatabases();
      const redisClientOptional = await initRedis(logger);
      if (redisClientOptional) {
        logger.info({ rateLimiting: { backend: 'redis' } }, 'Rate limiting backend initialized');
      }
      apiGeneralLimiter = createRateLimiter(
        redisClientOptional,
        logger,
        RATE_LIMITS.API_GENERAL
      );
      createBotLimiter = createRateLimiter(
        redisClientOptional,
        logger,
        RATE_LIMITS.API_CREATE_BOT
      );
      updateSchemaLimiter = createRateLimiter(
        redisClientOptional,
        logger,
        RATE_LIMITS.API_UPDATE_SCHEMA
      );
      exportUsersLimiter = createRateLimiter(
        redisClientOptional,
        logger,
        { windowMs: 60 * 60 * 1000, max: 5 }
      );
      createBroadcastLimiter = createRateLimiter(
        redisClientOptional,
        logger,
        {
          windowMs: 60 * 60 * 1000,
          max: 10,
          keyGenerator: (req) => `create_broadcast:${req.user.id}`,
        }
      );
    })();
  }
  return rateLimiterInitPromise;
}

export { initializeRateLimiters, initializeDatabases };
export { setRedisUnavailableForTests } from './db/redis';

export function setRedisAvailableForTests(available: boolean): void {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }
  redisAvailable = available;
}

export function setRedisSkippedForTests(
  skipped: boolean,
  reason: 'missing_url' | 'localhost_on_vercel' | null = null,
): void {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }
  redisSkipped = skipped;
  redisSkipReason = skipped ? reason : null;

  // Полезно для тестов /health: если мы явно "skipped", Redis точно недоступен.
  if (skipped) {
    redisAvailable = false;
  }
}

const apiGeneralLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!apiGeneralLimiter) {
      if (!rateLimiterReady) {
        rateLimiterReady = initializeRateLimiters();
      }
      await rateLimiterReady;
    }
    if (apiGeneralLimiter) {
      return apiGeneralLimiter(req, res, next);
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const createBotLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!createBotLimiter) {
      if (!rateLimiterReady) {
        rateLimiterReady = initializeRateLimiters();
      }
      await rateLimiterReady;
    }
    if (createBotLimiter) {
      return createBotLimiter(req, res, next);
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const updateSchemaLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!updateSchemaLimiter) {
      if (!rateLimiterReady) {
        rateLimiterReady = initializeRateLimiters();
      }
      await rateLimiterReady;
    }
    if (updateSchemaLimiter) {
      return updateSchemaLimiter(req, res, next);
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const exportUsersLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!exportUsersLimiter) {
      if (!rateLimiterReady) {
        rateLimiterReady = initializeRateLimiters();
      }
      await rateLimiterReady;
    }
    if (exportUsersLimiter) {
      return exportUsersLimiter(req, res, next);
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const createBroadcastLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!createBroadcastLimiter) {
      if (!rateLimiterReady) {
        rateLimiterReady = initializeRateLimiters();
      }
      await rateLimiterReady;
    }
    if (createBroadcastLimiter) {
      return createBroadcastLimiter(req, res, next);
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

function configureApp(app: ReturnType<typeof express>) {
app.set('trust proxy', 1);
app.locals.getBotById = getBotById;
// CORS configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://lego-bot-miniapp.vercel.app';
const OWNER_WEB_BASE_URL = process.env.OWNER_WEB_BASE_URL || 'http://localhost:5175';
const MINI_APP_DEV_URL = 'http://localhost:5174';
const MINI_APP_DEV_URL_127 = 'http://127.0.0.1:5174';
  // NOTE: `t.me/...` — это deep-link, а не реальное значение заголовка `Origin`.
  // Держим allowlist только для реальных web-origin’ов MiniApp/Frontend.
  // Если в прод-логах прилетает origin, которого нет в allowlist — добавь именно его (обычно через существующие env: MINI_APP_URL/FRONTEND_URL и т.д.).
  const allowedOrigins = [FRONTEND_URL, MINI_APP_URL, OWNER_WEB_BASE_URL, MINI_APP_DEV_URL, MINI_APP_DEV_URL_127].filter(Boolean);

logger.info('🎯 CORS configuration:');
logger.info({ value: FRONTEND_URL }, '  FRONTEND_URL:');
logger.info({ value: MINI_APP_URL }, '  MINI_APP_URL:');
logger.info({ value: OWNER_WEB_BASE_URL }, '  OWNER_WEB_BASE_URL:');
  logger.info({ value: MINI_APP_DEV_URL }, '  MINI_APP_DEV_URL:');
  logger.info({ value: MINI_APP_DEV_URL_127 }, '  MINI_APP_DEV_URL_127:');
  logger.info({ value: allowedOrigins }, '  Allowed origins:');
  logger.info({ value: allowedOrigins }, '  allowedOrigins:');

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    logger.info({ origin }, '🔍 CORS check - origin:');
    // Non-browser requests: no CORS headers needed.
    if (!origin) {
      logger.info('✅ CORS: No origin, skipping CORS headers');
      return callback(null, false);
    }
    if (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      logger.info({ origin }, '✅ CORS: Origin allowed:');
      return callback(null, true);
    }
    logger.info({ origin }, '❌ CORS: Origin not allowed:');
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data', 'X-Telegram-Init-Data', 'x-health-token'],
  exposedHeaders: ['x-request-id'],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Early OPTIONS handler - respond immediately without DB checks
app.use((req: Request, res: Response, next: Function) => {
  if (req.method === 'OPTIONS') {
    logger.info({ path: req.path, origin: req.headers.origin }, '⚡ Early OPTIONS handler - responding 204');
    return res.sendStatus(204);
  }
  next();
});

// Ensure caches don't mix CORS responses across different origins
app.use((req: Request, res: Response, next: Function) => {
  if (req.headers.origin) {
    res.vary('Origin');
  }
  next();
});

const logOptionsPreflight = (req: Request, res: Response, next: Function) => {
  if (req.method === 'OPTIONS') {
    logger.info({
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      acrm: req.header('access-control-request-method'),
      acrh: req.header('access-control-request-headers'),
    }, '🔍 OPTIONS preflight received');
  }
  next();
};

app.options('*', logOptionsPreflight, cors(corsOptions));

logger.info('✅ OPTIONS preflight handler registered via cors(corsOptions)');

app.use(requestIdMiddleware());
app.use(requestContextMiddleware());
app.use(pinoHttp({ logger }));
app.use(metricsMiddleware(logger));

// v2: Observability - Sentry request handler
if (process.env.SENTRY_DSN && !isTestEnv) {
  app.use(Sentry.Handlers.requestHandler());
}

// Webhook endpoint для основного бота (должен быть ДО express.json() для raw body)
// Регистрируем сразу, но обработчик будет работать только если botInstance инициализирован
app.post('/api/webhook', express.raw({ type: 'application/json' }), ensureDatabasesInitialized as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  let updateType: string | undefined;
  let userId: number | null | undefined;
  try {
    if (!botEnabled) {
      logger.error({ requestId }, '❌ Bot is disabled (missing TELEGRAM_BOT_TOKEN)');
      logger.info({ metric: 'webhook_error', requestId }, 'Webhook error');
      return res.status(503).json({ error: 'Bot not initialized' });
    }
    logger.info({ requestId }, '✅ Webhook DB initialization complete, processing update');
    // Проверяем, что бот инициализирован
    if (!botInstance) {
      logger.error({ requestId }, '❌ Bot instance not initialized in webhook handler');
      logger.info({ metric: 'webhook_error', requestId }, 'Webhook error');
      return res.status(503).json({ error: 'Bot not initialized' });
    }
    if (!botInitialized) {
      logger.error({ requestId }, '❌ Bot not fully initialized');
      return res.status(503).json({ error: 'Bot initializing' });
    }
    
    const update = JSON.parse(req.body.toString());
    updateType = update.message ? 'message' : update.callback_query ? 'callback_query' : 'unknown';
    userId = update.message?.from?.id ?? update.callback_query?.from?.id ?? null;
    logger.info({
      requestId,
      userId,
      updateId: update.update_id,
      type: updateType,
    }, '📨 Webhook received:');
    logger.info(
      {
        requestId,
        command: update.message?.text,
        isCommand: update.message?.text?.startsWith('/'),
      },
      '🔍 Processing update'
    );
    
    await botInstance.handleUpdate(update);
    logger.info({ requestId, updateId: update.update_id }, '✅ Update handled successfully');
    lastProcessedUpdate = {
      updateId: typeof update.update_id === 'number' ? update.update_id : null,
      updateType: updateType ?? null,
      userId: userId ?? null,
      command: update.message?.text ?? null,
      processedAt: new Date().toISOString(),
    };
    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error({ requestId, error }, '❌ Webhook error:');
    logger.info({ metric: 'webhook_error', requestId, updateType, userId }, 'Webhook error');
    // Всегда возвращаем 200 для Telegram, чтобы не было повторных запросов
    res.status(200).json({ ok: true });
  }
});

  // Middleware
  app.use(express.json());
  // JSON parsing error handler (must be right after express.json())
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
    const isDev = process.env.NODE_ENV !== 'production';

    // Handle invalid JSON in request body
    if (err instanceof SyntaxError && (err as any)?.type === 'entity.parse.failed') {
      const rawBody = (err as any)?.body;
      const errorMessage = err?.message || 'Invalid JSON';
      const positionMatch = typeof errorMessage === 'string' ? /position\s+(\d+)/i.exec(errorMessage) : null;
      const position = positionMatch ? Number(positionMatch[1]) : undefined;
      const bodyForLog = typeof rawBody === 'string' ? rawBody.substring(0, 500) : undefined;

      logger.warn(
        { requestId, error_type: 'json_parse', position, body: bodyForLog, method: req.method, path: req.path },
        'Invalid JSON in request body'
      );
      logger.info({
        metric: 'json_parse_error_total',
        count: 1,
        requestId,
        method: req.method,
        path: req.path,
      });

      return res.status(400).json({
        error: 'Invalid JSON in request body',
        requestId,
        ...(isDev
          ? {
              details: {
                message: errorMessage,
                position,
                body: bodyForLog,
              },
            }
          : {}),
      });
    }

    // Handle too large payloads
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      logger.warn(
        { requestId, error_type: 'payload_too_large', method: req.method, path: req.path },
        'Payload too large'
      );
      logger.info({
        metric: 'payload_too_large_total',
        count: 1,
        requestId,
        method: req.method,
        path: req.path,
      });
      return res.status(413).json({
        error: 'Payload too large',
        message: 'Payload size limit exceeded',
        requestId,
      });
    }

    return next(err);
  });
  app.use(express.urlencoded({ extended: true }));

// Apply general rate limiting to all API routes
app.use('/api', apiGeneralLimiterMiddleware as any);
app.use(logRateLimitMetrics(logger));

// Health check
app.get('/health', async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  const isVercel = process.env.VERCEL === '1';
  const allowEnvDetails =
    process.env.NODE_ENV !== 'production' ||
    (process.env.HEALTH_TOKEN &&
      req.headers['x-health-token'] === process.env.HEALTH_TOKEN);
  const { getPostgresDiagnostics } = await import('./db/postgres');
  const { getRedisDiagnostics, getRedisErrorMessage } = await import('./db/redis');
  const envCheck = validateRequiredEnvVars();
  const isSet = (key: string) => Boolean(process.env[key]?.trim());
  const botTokenPresent = isSet('TELEGRAM_BOT_TOKEN');
  const encryptionKeyPresent = isSet('ENCRYPTION_KEY');
  const secretTokenPresent = isSet('TELEGRAM_SECRET_TOKEN');
  botEnabled = botTokenPresent;
  encryptionAvailable = encryptionKeyPresent;
  webhookSecurityEnabled = secretTokenPresent;
  const postgresPoolConfig = getPostgresPoolConfig();
  logger.info({ poolConfig: postgresPoolConfig, requestId }, 'PostgreSQL pool configuration');

  const poolInfo = getPoolStats();
  const postgresCircuitBreaker = getPostgresCircuitBreakerStats();
  const redisCircuitBreaker = getRedisCircuitBreakerStats();
  const retryStats = {
    postgres: getPostgresRetryStats(),
    redis: getRedisRetryStats(),
  };
  const errorMetrics = getErrorMetrics();
  const postgresDiagnostics = getPostgresDiagnostics();
  const redisDiagnostics = getRedisDiagnostics();
  const redisErrorMessage = getRedisErrorMessage();
  const redisErrorForMinimal = redisErrorMessage;

  const redactSecrets = (input: string) =>
    input
      .replace(/(redis|rediss|postgres|postgresql):\/\/([^:@\s]+):([^@\s]+)@/gi, '$1://***:***@')
      .replace(/(password=)[^&\s]+/gi, '$1***')
      .replace(/(access_token=)[^&\s]+/gi, '$1***')
      .replace(/(token=)[^&\s]+/gi, '$1***');

  let postgresState: 'connecting' | 'ready' | 'error' = 'connecting';
  if (!dbInitialized) {
    postgresState = dbInitializationPromise ? 'connecting' : 'error';
  } else {
    try {
      const { getPool } = await import('./db/postgres');
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

  let redisState: 'connecting' | 'ready' | 'degraded' | 'error' | 'skipped' = 'connecting';
  if (!dbInitialized) {
    redisState = dbInitializationPromise ? 'connecting' : 'error';
  } else if (redisSkipped) {
    redisState = 'skipped'; // Intentionally disabled
  } else if (!redisAvailable) {
    redisState = 'degraded';
  } else {
    try {
      const redisClient = await getRedisClientOptional();
      if (redisClient) {
        await redisClient.ping();
        redisState = 'ready';
      } else {
        redisState = 'degraded';
      }
    } catch (error) {
      redisState = 'error';
    }
  }

  const postgresBreakerOpen = postgresCircuitBreaker.state !== 'closed';
  const redisBreakerOpen = redisCircuitBreaker.state !== 'closed';

  let status: 'ok' | 'degraded' | 'error' = 'ok';
  if (!envCheck.allInfraPresent || postgresState !== 'ready' || postgresBreakerOpen) {
    status = 'error';
  } else if (
    (redisState !== 'ready' && redisState !== 'skipped') ||
    (redisBreakerOpen && redisState !== 'skipped') ||
    !botEnabled ||
    !encryptionAvailable ||
    !webhookSecurityEnabled
  ) {
    status = 'degraded';
  }

  const statusCode = status === 'error' ? 503 : 200;
  const timestamp = new Date().toISOString();
  const minimalConnectionInfo = (() => {
    if (process.env.VERCEL !== '1') return null;
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return null;
    const info = getPostgresConnectionInfo(dbUrl);
    if (!info) return null;
    const host = info.host?.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
    return {
      host,
      port: info.port,
      database: info.database,
    };
  })();
  const minimalHealth = {
    status,
    timestamp,
    databases: {
      postgres: {
        status: postgresState,
        ...(postgresState === 'error' && postgresDiagnostics
          ? { diagnostics: postgresDiagnostics }
          : {}),
        ...(minimalConnectionInfo ? { connectionInfo: minimalConnectionInfo } : {}),
      },
      redis: {
        status: redisState,
        ...(redisState === 'skipped' ? { skipReason: redisSkipReason } : {}),
        ...(redisState === 'error' && redisDiagnostics
          ? { diagnostics: redisDiagnostics }
          : {}),
        ...(redisState === 'error' && redisErrorForMinimal
          ? { redisError: redisErrorForMinimal }
          : {}),
      },
    },
    environmentVariables: {
      infraRequired: {
        DATABASE_URL: isSet('DATABASE_URL') ? 'SET' : 'MISSING',
      },
      validation: {
        allInfraPresent: envCheck.allInfraPresent,
        missingInfraRequired: envCheck.infraRequired.missing,
      },
    },
  };

  if (!allowEnvDetails) {
    logger.info(
      { requestId, status, databases: minimalHealth.databases },
      'Health check'
    );
    res.status(statusCode).json(minimalHealth);
    return;
  }

  const health = {
    status,
    timestamp,
    environment: {
      vercel: isVercel,
      vercelEnv: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV,
    },
    environmentVariables: {
      infraRequired: {
        DATABASE_URL: isSet('DATABASE_URL') ? 'SET' : 'MISSING',
      },
      optional: {
        REDIS_URL: isSet('REDIS_URL') ? 'SET' : 'MISSING',
        MINI_APP_URL: isSet('MINI_APP_URL') ? 'SET' : 'MISSING',
        API_URL: isSet('API_URL') ? 'SET' : 'MISSING',
      },
      validation: {
        allInfraPresent: envCheck.allInfraPresent,
        missingInfraRequired: envCheck.infraRequired.missing,
      },
    },
    featureFlags: {
      botEnabled,
      encryptionAvailable,
      webhookSecurityEnabled,
    },
    featureRequired: {
      TELEGRAM_BOT_TOKEN: botTokenPresent ? 'SET' : 'MISSING',
      ENCRYPTION_KEY: encryptionKeyPresent ? 'SET' : 'MISSING',
      TELEGRAM_SECRET_TOKEN: secretTokenPresent ? 'SET' : 'MISSING',
    },
    initialization: {
      last: lastDatabaseInitialization,
      stage: dbInitializationStage,
      initialized: dbInitialized,
      inProgress: Boolean(dbInitializationPromise) && !dbInitialized,
      metrics: {
        lastInitDurationMs: lastDatabaseInitialization?.durationMs ?? null,
        lastInitSuccess: lastDatabaseInitialization?.success ?? null,
        lastInitStartedAt: lastDatabaseInitialization?.startedAt ?? null,
        lastInitFinishedAt: lastDatabaseInitialization?.finishedAt ?? null,
      },
    },
    databases: {
      postgres: {
        status: postgresState,
        pool: poolInfo,
        poolConfig: postgresPoolConfig,
        connectionInfo: (() => {
          const dbUrl = process.env.DATABASE_URL;
          if (!dbUrl) return null;
          const info = getPostgresConnectionInfo(dbUrl);
          return info
            ? {
                host: info.host,
                port: info.port,
                database: info.database,
              }
            : null;
        })(),
        ...(postgresDiagnostics ? { diagnostics: postgresDiagnostics } : {}),
      },
      redis: {
        status: redisState,
        skipReason: redisState === 'skipped' ? redisSkipReason : null,
        ...(redisDiagnostics ? { diagnostics: redisDiagnostics } : {}),
        ...(redisErrorMessage ? { redisError: redisErrorMessage } : {}),
        ...(redisErrorMessage ? { errorMessage: redisErrorMessage } : {}),
      },
    },
    circuitBreakers: {
      postgres: postgresCircuitBreaker,
      redis: redisCircuitBreaker,
    },
    connectionPool: {
      postgres: {
        total: poolInfo.totalCount,
        idle: poolInfo.idleCount,
        waiting: poolInfo.waitingCount,
      },
    },
    retryStats,
    lastDbInitError: lastDatabaseInitialization?.error
      ? redactSecrets(lastDatabaseInitialization.error)
      : null,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    errorMetrics,
    rateLimiting: {
      enabled: true,
      backend: redisState === 'ready' ? 'redis' : 'memory',
      redisStatus: redisState,
      redisSkipReason: redisState === 'skipped' ? redisSkipReason : null,
    },
  };
  logger.info(
    { requestId, status: health.status, databases: health.databases },
    'Health check'
  );
  res.status(statusCode).json(health);
});

// Bot status diagnostic
app.get('/api/bot-status', async (req, res) => {
  try {
    const status = {
      botInstance: botInstance ? 'exists' : null,
      botInitialized,
      global: {
        __CACHED_BOT_INSTANCE__: global.__CACHED_BOT_INSTANCE__ ? 'exists' : null,
        __BOT_INITIALIZED__: global.__BOT_INITIALIZED__ || false,
        __BOT_INIT_PROMISE__: global.__BOT_INIT_PROMISE__ ? 'pending' : 'none',
      },
      dbInitialized,
      dbInitializationInProgress: Boolean(dbInitializationPromise) && !dbInitialized,
      registeredCommands,
      lastProcessedUpdate,
    };
    
    const botReady = Boolean(botInstance) && botInitialized && dbInitialized;
    const statusCode = botReady ? 200 : 503;
    res.status(statusCode).json({ ok: botReady, status });
  } catch (error: any) {
    res.status(500).json({ 
      ok: false, 
      error: error?.message || 'Unknown error' 
    });
  }
});

// Middleware для проверки user_id через Telegram WebApp initData
async function requireUserId(req: Request, res: Response, next: Function) {
  const initData =
    (req.headers['x-telegram-init-data'] as string | undefined)
    || (req.query.initData as string | undefined);

  if (!initData) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const botToken = getTelegramBotToken();
  if (!botToken) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN is not set' });
  }

  const validation = validateTelegramWebAppData(initData, botToken);
  if (!validation.valid || !validation.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  (req as any).user = { id: validation.userId };

  const isAdminPath =
    req.path.startsWith('/api/admin') || req.path === '/api/maintenance';
  if (!isAdminPath) {
    const maintenance = await getMaintenanceStateCached();
    if (maintenance.enabled && !isAdminUser(validation.userId)) {
      return res.status(503).json({
        error: 'Maintenance',
        message: maintenance.message || 'Сервис временно недоступен. Технические работы.',
      });
    }
  }

  next();
}

function requireAdmin(req: Request, res: Response, next: Function) {
  const userId = (req as any)?.user?.id as number | undefined;
  if (!isAdminUser(userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function ownerError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  const requestId = getRequestId() || (res.req as any)?.id || 'unknown';
  return res.status(status).json({
    code,
    message,
    ...(details ? { details } : {}),
    request_id: requestId,
  });
}

function getOwnerJwtSecret(): string | null {
  const value = process.env.JWT_SECRET?.trim();
  if (!value) return null;
  return value;
}

function getOwnerBotlinkSecret(): string | null {
  const explicit = process.env.OWNER_BOTLINK_SECRET?.trim();
  if (explicit) return explicit;
  return getOwnerJwtSecret() || process.env.ENCRYPTION_KEY?.trim() || null;
}

function isSecureCookieRequest(req: Request): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function ownerAuthRateLimit(req: Request, res: Response, next: Function) {
  const key = `${req.ip || 'ip:unknown'}:${req.path}`;
  const now = Date.now();
  const existing = ownerAuthHits.get(key);
  if (!existing || existing.resetAt <= now) {
    ownerAuthHits.set(key, { count: 1, resetAt: now + ownerAuthRateWindowMs });
    return next();
  }
  if (existing.count >= ownerAuthRateMax) {
    return ownerError(res, 429, 'rate_limited', 'Слишком много попыток входа');
  }
  existing.count += 1;
  ownerAuthHits.set(key, existing);
  return next();
}

function requireOwnerAuth(req: Request, res: Response, next: Function) {
  const jwtSecret = getOwnerJwtSecret();
  if (!jwtSecret) {
    return ownerError(res, 500, 'misconfigured', 'JWT_SECRET is not set');
  }
  const cookies = parseCookies(req.headers.cookie);
  const session = cookies[OWNER_SESSION_COOKIE];
  if (!session) {
    return ownerError(res, 401, 'unauthorized', 'Требуется авторизация');
  }
  const claims = verifyOwnerSession(session, jwtSecret);
  if (!claims) {
    return ownerError(res, 401, 'unauthorized', 'Недействительная сессия');
  }
  (req as any).owner = claims;
  return next();
}

// v2: Tenant isolation middleware - проверяет botId и кладет контекст
async function requireBotContext(req: Request, res: Response, next: Function) {
  const startTime = Date.now();
  const requestId = getRequestId() || (req as any)?.id || 'unknown';
  const ownerClaims = (req as any).owner as { sub: number } | undefined;
  const botId = req.params.botId || req.query.botId as string | undefined;
  
  if (!ownerClaims?.sub) {
    logger.warn({ requestId, route: req.path, method: req.method }, 'Unauthorized: missing owner claims');
    return ownerError(res, 401, 'unauthorized', 'Требуется авторизация');
  }
  
  if (!botId) {
    logger.warn({ requestId, route: req.path, method: req.method, userId: ownerClaims.sub }, 'Bad request: missing botId');
    return ownerError(res, 400, 'invalid_request', 'botId обязателен');
  }
  
  // v2: RBAC 2.0 - получаем роль и permissions
  const roleAndPerms = await getBotRoleAndPermissions(botId, ownerClaims.sub);
  if (!roleAndPerms) {
    logger.warn({ requestId, route: req.path, method: req.method, botId, userId: ownerClaims.sub }, 'Forbidden: no access to bot');
    return ownerError(res, 403, 'forbidden', 'Нет доступа к этому боту');
  }
  
  const { role, permissions } = roleAndPerms;
  const latency = Date.now() - startTime;
  
  // v2: Structured logging
  logger.debug({ requestId, botId, userId: ownerClaims.sub, role, route: req.path, method: req.method, latency }, 'Bot context loaded');
  
  // v2: Кладем контекст бота в request с permissions
  (req as any).botContext = {
    botId,
    role,
    permissions,
  };
  
  // Обратная совместимость
  (req as any).ownerRole = role;
  
  return next();
}

// v2: RBAC 2.0 - middleware для проверки permissions
function requirePermission(permission: string) {
  return (req: Request, res: Response, next: Function) => {
    const botContext = (req as any).botContext;
    if (!botContext) {
      return ownerError(res, 401, 'unauthorized', 'Требуется botContext');
    }
    
    const hasPermission = botContext.permissions[permission] === true;
    if (!hasPermission) {
      return ownerError(res, 403, 'forbidden', `Требуется permission: ${permission}`);
    }
    
    return next();
  };
}

// Legacy: для обратной совместимости
async function requireOwnerBotAccess(req: Request, res: Response, next: Function) {
  return requireBotContext(req, res, next);
}

function requireOwnerCsrf(req: Request, res: Response, next: Function) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  const ownerClaims = (req as any).owner as { csrf?: string } | undefined;
  const csrfHeader = (req.headers['x-csrf-token'] as string | undefined) || '';
  if (!ownerClaims?.csrf || !csrfHeader || ownerClaims.csrf !== csrfHeader) {
    return ownerError(res, 403, 'csrf_failed', 'CSRF token mismatch');
  }
  return next();
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function writeCsv(res: Response, filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send('');
  }
  const headers = Object.keys(rows[0]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write(`${headers.join(',')}\n`);
  for (const row of rows) {
    const line = headers.map((h) => toCsvValue((row as any)[h])).join(',');
    res.write(`${line}\n`);
  }
  res.end();
}

const AdminPromoCodeCreateSchema = z.object({
  code: z.string().trim().min(4).max(40).optional(),
  durationDays: z.number().int().min(1).max(3650),
  maxRedemptions: z.number().int().min(1).max(100000).optional(),
  expiresAt: z.string().datetime().optional(),
});

const AdminMaintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().max(500).nullable().optional(),
});

const AdminGrantSubscriptionSchema = z.object({
  telegramUserId: z.number().int().positive(),
  durationDays: z.number().int().min(1).max(3650),
  plan: z.string().trim().min(1).max(50).optional(),
});

const PromoRedeemSchema = z.object({
  code: z.string().trim().min(1).max(64),
});

const OwnerTelegramAuthSchema = z.object({
  id: z.union([z.string(), z.number()]),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.union([z.string(), z.number()]),
  hash: z.string().min(1),
});

const OwnerBotlinkAuthSchema = z.object({
  token: z.string().trim().min(1).max(4096),
});

const OwnerEventsQuerySchema = z.object({
  status: z.enum(['new', 'in_progress', 'done', 'cancelled']).optional(),
  type: z.string().trim().min(1).max(100).optional(),
  q: z.string().trim().max(200).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const OwnerEventPatchSchema = z.object({
  status: z.enum(['new', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  assignee: z.number().int().positive().nullable().optional(),
});

const OwnerEventNoteSchema = z.object({
  note: z.string().trim().min(1).max(5000),
});

const OwnerCustomersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const OwnerCustomerPatchSchema = z.object({
  name: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(64).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const OwnerAppointmentsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  staffId: z.string().uuid().optional(),
  status: z.string().trim().min(1).max(50).optional(),
});

const OwnerCreateAppointmentSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  staffId: z.string().uuid().nullable().optional(),
  serviceId: z.string().uuid().nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.string().trim().min(1).max(50).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  payloadJson: z.record(z.any()).nullable().optional(),
});

const OwnerPatchAppointmentSchema = z.object({
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.string().trim().min(1).max(50).optional(),
  staffId: z.string().uuid().nullable().optional(),
  serviceId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const OwnerAvailabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
});

const OwnerOrdersQuerySchema = z.object({
  status: z.string().trim().min(1).max(50).optional(),
  q: z.string().trim().max(200).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const OwnerPatchOrderSchema = z.object({
  status: z.string().trim().min(1).max(50).optional(),
  paymentStatus: z.string().trim().min(1).max(50).nullable().optional(),
  tracking: z.string().trim().max(255).nullable().optional(),
  amount: z.number().nullable().optional(),
});

const OwnerLeadsQuerySchema = z.object({
  status: z.string().trim().min(1).max(50).optional(),
  q: z.string().trim().max(200).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const OwnerPatchLeadSchema = z.object({
  status: z.string().trim().min(1).max(50).optional(),
  assignee: z.number().int().positive().nullable().optional(),
});

const OwnerExportSchema = z.object({
  type: z.enum(['leads', 'orders', 'appointments', 'customers', 'events']),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.string().trim().min(1).max(50).optional(),
});

const OwnerAuditQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const OwnerTeamInviteSchema = z.object({
  telegramUserId: z.number().int().positive(),
  role: z.enum(['owner', 'admin', 'staff', 'viewer']),
  permissionsJson: z.record(z.any()).optional(),
});

const OwnerBotSettingsPatchSchema = z.object({
  timezone: z.string().trim().min(1).max(80).optional(),
  businessName: z.string().trim().max(200).nullable().optional(),
  brand: z.record(z.any()).optional(),
  workingHours: z.record(z.any()).optional(),
  notifyNewLeads: z.boolean().optional(),
  notifyNewOrders: z.boolean().optional(),
  notifyNewAppointments: z.boolean().optional(),
  notifyChatId: z.number().int().nullable().optional(),
});

// Public maintenance status (for clients)
app.get('/api/maintenance', ensureDatabasesInitialized as any, async (req: Request, res: Response) => {
  const state = await getMaintenanceStateCached();
  res.json({
    enabled: state.enabled,
    message: state.message,
    updatedAt: state.updatedAt,
  });
});

// Admin API
app.get('/api/admin/stats', ensureDatabasesInitialized as any, requireUserId as any, requireAdmin as any, async (req: Request, res: Response) => {
  const stats = await getAdminStats();
  res.json(stats);
});

app.get('/api/admin/promo-codes', ensureDatabasesInitialized as any, requireUserId as any, requireAdmin as any, async (req: Request, res: Response) => {
  const codes = await listPromoCodes();
  res.json({ items: codes });
});

app.post('/api/admin/promo-codes', ensureDatabasesInitialized as any, requireUserId as any, requireAdmin as any, validateBody(AdminPromoCodeCreateSchema) as any, async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof AdminPromoCodeCreateSchema>;
  const code =
    body.code ||
    crypto
      .randomBytes(5)
      .toString('hex')
      .toUpperCase();
  try {
    const created = await createPromoCode({
      code,
      durationDays: body.durationDays,
      maxRedemptions: body.maxRedemptions ?? 1,
      expiresAt: body.expiresAt ?? null,
      createdBy: (req as any)?.user?.id ?? null,
    });
    res.status(201).json(created);
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Промокод с таким кодом уже существует' });
    }
    throw error;
  }
});

app.get('/api/admin/maintenance', ensureDatabasesInitialized as any, requireUserId as any, requireAdmin as any, async (req: Request, res: Response) => {
  const state = await getMaintenanceStateCached();
  res.json(state);
});

app.post('/api/admin/maintenance', ensureDatabasesInitialized as any, requireUserId as any, requireAdmin as any, validateBody(AdminMaintenanceSchema) as any, async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof AdminMaintenanceSchema>;
  const updated = await setMaintenanceState(
    body.enabled,
    body.message ?? null,
    (req as any)?.user?.id ?? null
  );
  maintenanceCache = updated;
  maintenanceCacheLoadedAt = Date.now();
  res.json(updated);
});

app.post('/api/admin/subscriptions/grant', ensureDatabasesInitialized as any, requireUserId as any, requireAdmin as any, validateBody(AdminGrantSubscriptionSchema) as any, async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof AdminGrantSubscriptionSchema>;
  const granted = await grantSubscriptionByAdmin({
    telegramUserId: body.telegramUserId,
    durationDays: body.durationDays,
    plan: body.plan ?? 'premium',
    adminUserId: (req as any)?.user?.id ?? null,
  });
  res.status(201).json(granted);
});

app.post('/api/promo-codes/redeem', ensureDatabasesInitialized as any, requireUserId as any, validateBody(PromoRedeemSchema) as any, async (req: Request, res: Response) => {
  try {
    const body = req.body as z.infer<typeof PromoRedeemSchema>;
    const result = await redeemPromoCode((req as any).user.id, body.code);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Ошибка активации промокода',
    });
  }
});

// Owner auth + cabinet API
app.post('/api/owner/auth/botlink', ensureDatabasesInitialized as any, ownerAuthRateLimit as any, validateBody(OwnerBotlinkAuthSchema) as any, async (req: Request, res: Response) => {
  const jwtSecret = getOwnerJwtSecret();
  const botlinkSecret = getOwnerBotlinkSecret();
  if (!jwtSecret || !botlinkSecret) {
    return ownerError(res, 500, 'misconfigured', 'Owner auth is not configured');
  }

  const body = req.body as z.infer<typeof OwnerBotlinkAuthSchema>;
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  const nowSec = Math.floor(Date.now() / 1000);
  const verified = verifyOwnerBotlinkToken(body.token, botlinkSecret, nowSec);
  if (!verified.valid || !verified.telegramUserId || !verified.jti || !verified.exp) {
    logger.warn(
      {
        requestId,
        reason: verified.reason || 'invalid_botlink',
      },
      'Owner botlink auth failed'
    );
    const code = verified.reason === 'expired' ? 'botlink_expired' : 'invalid_botlink';
    return ownerError(res, 401, code, 'Ссылка входа недействительна или устарела');
  }

  const redis = await getRedisClientOptional();
  if (!redis) {
    return ownerError(res, 500, 'misconfigured', 'Redis is required for botlink auth');
  }

  const jtiTtlSec = Math.max(1, verified.exp - nowSec);
  const jtiKey = `owner:botlink:jti:${verified.jti}`;
  const setResult = await redis.set(jtiKey, '1', { NX: true, EX: jtiTtlSec });
  if (setResult !== 'OK') {
    logger.warn(
      {
        requestId,
        userId: verified.telegramUserId,
        reason: 'botlink_used',
      },
      'Owner botlink auth denied'
    );
    return ownerError(res, 401, 'botlink_used', 'Ссылка уже использована, запросите новую через /cabinet');
  }

  const bots = await getOwnerAccessibleBots(verified.telegramUserId);
  if (bots.length === 0) {
    logger.warn(
      {
        requestId,
        userId: verified.telegramUserId,
        reason: 'no_bots_access',
      },
      'Owner botlink auth denied'
    );
    return ownerError(res, 403, 'no_bots_access', 'Нет доступа к кабинетам ботов');
  }

  const csrf = generateCsrfToken();
  const sessionToken = signOwnerSession(
    {
      sub: verified.telegramUserId,
      csrf,
      ttlSec: OWNER_SESSION_TTL_SEC,
    },
    jwtSecret
  );
  res.setHeader(
    'Set-Cookie',
    serializeCookie(OWNER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: isSecureCookieRequest(req),
      sameSite: 'Lax',
      path: OWNER_COOKIE_PATH,
      maxAgeSec: OWNER_SESSION_TTL_SEC,
    })
  );

  logger.info(
    {
      requestId,
      userId: verified.telegramUserId,
      result: 'success',
    },
    'Owner botlink auth success'
  );

  return res.json({ ok: true });
});

app.post('/api/owner/auth/telegram', ensureDatabasesInitialized as any, ownerAuthRateLimit as any, validateBody(OwnerTelegramAuthSchema) as any, async (req: Request, res: Response) => {
  const botToken = getTelegramBotToken();
  const jwtSecret = getOwnerJwtSecret();
  if (!botToken || !jwtSecret) {
    return ownerError(res, 500, 'misconfigured', 'Owner auth is not configured');
  }
  const payload = req.body as z.infer<typeof OwnerTelegramAuthSchema>;
  const verified = verifyTelegramLoginPayload(payload as any, botToken, Math.floor(Date.now() / 1000), 60);
  if (!verified.valid || !verified.userId) {
    logger.warn(
      {
        requestId: getRequestId() ?? (req as any)?.id ?? 'unknown',
        userId: Number(payload.id) || null,
        reason: verified.reason || 'invalid_telegram_auth',
      },
      'Owner telegram auth failed'
    );
    return ownerError(res, 401, 'invalid_telegram_auth', 'Неверные данные Telegram входа');
  }
  logger.info(
    {
      requestId: getRequestId() ?? (req as any)?.id ?? 'unknown',
      userId: verified.userId,
      result: 'success',
    },
    'Owner telegram auth success'
  );

  const csrf = generateCsrfToken();
  const token = signOwnerSession(
    {
      sub: verified.userId,
      username: payload.username ?? null,
      first_name: payload.first_name ?? null,
      last_name: payload.last_name ?? null,
      photo_url: payload.photo_url ?? null,
      csrf,
      ttlSec: OWNER_SESSION_TTL_SEC,
    },
    jwtSecret
  );

  res.setHeader(
    'Set-Cookie',
    serializeCookie(OWNER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isSecureCookieRequest(req),
      sameSite: 'Lax',
      path: OWNER_COOKIE_PATH,
      maxAgeSec: OWNER_SESSION_TTL_SEC,
    })
  );
  res.json({ ok: true });
});

app.get('/api/owner/auth/me', ensureDatabasesInitialized as any, requireOwnerAuth as any, async (req: Request, res: Response) => {
  const owner = (req as any).owner as any;
  const bots = await getOwnerAccessibleBots(owner.sub);
  res.json({
    user: {
      telegramUserId: owner.sub,
      username: owner.username ?? null,
      firstName: owner.first_name ?? null,
      lastName: owner.last_name ?? null,
      photoUrl: owner.photo_url ?? null,
    },
    bots,
    csrfToken: owner.csrf,
  });
});

app.post('/api/owner/auth/logout', ensureDatabasesInitialized as any, async (req: Request, res: Response) => {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(OWNER_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: isSecureCookieRequest(req),
      sameSite: 'Lax',
      path: OWNER_COOKIE_PATH,
      maxAgeSec: 0,
    })
  );
  res.json({ ok: true });
});

app.get('/api/owner/_debug/session', ensureDatabasesInitialized as any, async (req: Request, res: Response) => {
  const jwtSecret = getOwnerJwtSecret();
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[OWNER_SESSION_COOKIE];
  const claims = jwtSecret && token ? verifyOwnerSession(token, jwtSecret) : null;
  const isDev = process.env.NODE_ENV !== 'production';
  const isAdmin = Boolean(claims?.sub && isAdminUser(claims.sub));
  if (!isDev && !isAdmin) {
    return ownerError(res, 403, 'forbidden', 'Debug endpoint is disabled');
  }

  const botCount = claims?.sub ? (await getOwnerAccessibleBots(claims.sub)).length : 0;
  return res.json({
    hasCookie: Boolean(token),
    userId: claims?.sub ?? null,
    botCount,
    csrfPresent: Boolean(claims?.csrf),
  });
});

app.get('/api/owner/bots', ensureDatabasesInitialized as any, requireOwnerAuth as any, async (req: Request, res: Response) => {
  const owner = (req as any).owner as any;
  const bots = await getOwnerAccessibleBots(owner.sub);
  res.json({ items: bots });
});

app.get('/api/owner/bots/:botId', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, async (req: Request, res: Response) => {
  const botId = req.params.botId;
  const settings = await getBotSettings(botId);
  const team = await listBotTeam(botId);
  res.json({ botId, settings, team, role: (req as any).ownerRole });
});

app.get('/api/owner/bots/:botId/me', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, async (req: Request, res: Response) => {
  const botId = req.params.botId;
  const owner = (req as any).owner as any;
  const botContext = (req as any).botContext;
  if (!botContext) {
    return ownerError(res, 403, 'forbidden', 'Нет доступа к этому боту');
  }
  const { role, permissions } = botContext;
  const settings = await getBotSettings(botId);
  const bot = await getBotByIdAnyUser(botId);
  if (!bot) {
    return ownerError(res, 404, 'not_found', 'Бот не найден');
  }
  res.json({
    role,
    permissions, // v2: RBAC 2.0 permissions
    settingsSummary: settings ? {
      businessName: (settings as any).businessName,
      timezone: (settings as any).timezone,
    } : null,
    bot: {
      id: bot.id,
      name: bot.name,
    },
  });
});

app.patch('/api/owner/bots/:botId/settings', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerCsrf as any, requireOwnerBotAccess as any, validateBody(OwnerBotSettingsPatchSchema) as any, async (req: Request, res: Response) => {
  const botId = req.params.botId;
  const updated = await updateBotSettings(botId, req.body as any);
  await insertOwnerAudit({
    botId,
    actorTelegramUserId: (req as any).owner.sub,
    entity: 'bot_settings',
    action: 'update',
    afterJson: updated as any,
    requestId: getRequestId() ?? null,
  });
  res.json(updated);
});

app.get('/api/owner/bots/:botId/team', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, async (req: Request, res: Response) => {
  const items = await listBotTeam(req.params.botId);
  res.json({ items });
});

app.post('/api/owner/bots/:botId/team', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerCsrf as any, requireOwnerBotAccess as any, validateBody(OwnerTeamInviteSchema) as any, async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof OwnerTeamInviteSchema>;
  await upsertBotTeamMember({
    botId: req.params.botId,
    telegramUserId: body.telegramUserId,
    role: body.role,
    permissionsJson: body.permissionsJson ?? null,
    actorUserId: (req as any).owner.sub,
  });
  await insertOwnerAudit({
    botId: req.params.botId,
    actorTelegramUserId: (req as any).owner.sub,
    entity: 'bot_admins',
    action: 'upsert',
    afterJson: body as any,
    requestId: getRequestId() ?? null,
  });
  res.status(201).json({ ok: true });
});

app.delete('/api/owner/bots/:botId/team/:telegramUserId', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerCsrf as any, requireOwnerBotAccess as any, async (req: Request, res: Response) => {
  await removeBotTeamMember(req.params.botId, Number(req.params.telegramUserId));
  await insertOwnerAudit({
    botId: req.params.botId,
    actorTelegramUserId: (req as any).owner.sub,
    entity: 'bot_admins',
    action: 'remove',
    afterJson: { telegramUserId: req.params.telegramUserId },
    requestId: getRequestId() ?? null,
  });
  res.json({ ok: true });
});

app.get('/api/owner/bots/:botId/events', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, validateQuery(OwnerEventsQuerySchema) as any, async (req: Request, res: Response) => {
  const q = req.query as any;
  const page = await listInboxEvents({
    botId: req.params.botId,
    status: q.status,
    type: q.type,
    q: q.q,
    from: q.from,
    to: q.to,
    cursor: q.cursor,
    limit: q.limit ? Number(q.limit) : undefined,
  });
  res.json(page);
});

app.get('/api/owner/bots/:botId/events/summary', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, async (req: Request, res: Response) => {
  const summary = await getEventsSummary(req.params.botId);
  res.json(summary);
});

// v2: SSE realtime stream endpoint
app.get('/api/owner/bots/:botId/stream', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, async (req: Request, res: Response) => {
  const botId = req.params.botId;
  const botContext = (req as any).botContext;
  
  if (!botContext || botContext.botId !== botId) {
    return ownerError(res, 403, 'forbidden', 'Нет доступа к этому боту');
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  const sendSSE = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendSSE('connected', { botId, timestamp: new Date().toISOString() });

  // Subscribe to Redis PubSub for this bot
  let redisSubscriber: any = null;
  try {
    const redis = await getRedisClient();
    redisSubscriber = redis.duplicate();
    await redisSubscriber.connect();
    
    const channel = `bot:${botId}:events`;
    await redisSubscriber.subscribe(channel, (message: string) => {
      try {
        const data = JSON.parse(message);
        sendSSE('event', data);
      } catch (error) {
        const sseLogger = createLogger('sse');
        sseLogger.error('Failed to parse SSE message', { error, message });
      }
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      sendSSE('ping', { timestamp: new Date().toISOString() });
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
      redisSubscriber?.unsubscribe(channel);
      redisSubscriber?.quit();
      res.end();
    });
  } catch (error) {
    const sseLogger = createLogger('sse');
    sseLogger.error('SSE connection error', { botId, error });
    sendSSE('error', { message: 'Connection error' });
    res.end();
  }
});

app.get('/api/owner/bots/:botId/dashboard', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, async (req: Request, res: Response) => {
  const botId = req.params.botId;
  const now = new Date();
  const last7DaysDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last7Days = last7DaysDate.toISOString();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [eventsSummary, recentLeads, recentOrders, recentAppointments] = await Promise.all([
    getEventsSummary(botId),
    listLeads({ botId, cursor: undefined, limit: 5 }),
    listOrders({ botId, cursor: undefined, limit: 5 }),
    listAppointments({ botId, from: last7Days, to: now.toISOString() }),
  ]);

  const newLeads7d = await listLeads({ botId, cursor: undefined, limit: 1 });
  const orders7d = await listOrders({ botId, cursor: undefined, limit: 1 });

  res.json({
    kpi: {
      newLeads7d: newLeads7d.items.filter((l: any) => new Date(l.createdAt) >= last7DaysDate).length,
      orders7d: orders7d.items.filter((o: any) => new Date(o.createdAt) >= last7DaysDate).length,
      revenue30d: 0, // TODO: calculate from orders
      conversion: 0, // TODO: calculate
    },
    eventsSummary,
    recent: {
      leads: recentLeads.items.slice(0, 5),
      orders: recentOrders.items.slice(0, 5),
      appointments: (recentAppointments as any).items?.slice(0, 5) || [],
    },
  });
});

app.patch('/api/owner/bots/:botId/events/:eventId', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerCsrf as any, requireOwnerBotAccess as any, validateBody(OwnerEventPatchSchema) as any, async (req: Request, res: Response) => {
  const patched = await patchEvent(req.params.botId, req.params.eventId, req.body as any);
  if (!patched) return ownerError(res, 404, 'not_found', 'Событие не найдено');
  await insertOwnerAudit({
    botId: req.params.botId,
    actorTelegramUserId: (req as any).owner.sub,
    entity: 'bot_events',
    entityId: req.params.eventId,
    action: 'update',
    afterJson: req.body as any,
    requestId: getRequestId() ?? null,
  });
  res.json(patched);
});

app.post('/api/owner/bots/:botId/events/:eventId/notes', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerCsrf as any, requireOwnerBotAccess as any, validateBody(OwnerEventNoteSchema) as any, async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof OwnerEventNoteSchema>;
  const note = await addEventNote({
    botId: req.params.botId,
    eventId: req.params.eventId,
    authorTelegramUserId: (req as any).owner.sub,
    note: body.note,
  });
  res.status(201).json(note);
});

app.get('/api/owner/bots/:botId/customers', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, validateQuery(OwnerCustomersQuerySchema) as any, async (req: Request, res: Response) => {
  const q = req.query as any;
  const page = await listCustomers({
    botId: req.params.botId,
    q: q.q,
    cursor: q.cursor,
    limit: q.limit ? Number(q.limit) : undefined,
  });
  res.json(page);
});

app.get('/api/owner/bots/:botId/customers/:customerId', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, async (req: Request, res: Response) => {
  const customer = await getCustomer(req.params.botId, req.params.customerId);
  if (!customer) return ownerError(res, 404, 'not_found', 'Клиент не найден');
  res.json(customer);
});

app.patch('/api/owner/bots/:botId/customers/:customerId', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerCsrf as any, requireOwnerBotAccess as any, validateBody(OwnerCustomerPatchSchema) as any, async (req: Request, res: Response) => {
  const updated = await patchCustomer(req.params.botId, req.params.customerId, req.body as any);
  if (!updated) return ownerError(res, 404, 'not_found', 'Клиент не найден');
  await insertOwnerAudit({
    botId: req.params.botId,
    actorTelegramUserId: (req as any).owner.sub,
    entity: 'customers',
    entityId: req.params.customerId,
    action: 'update',
    afterJson: req.body as any,
    requestId: getRequestId() ?? null,
  });
  res.json(updated);
});

app.get('/api/owner/bots/:botId/customers/:customerId/timeline', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, async (req: Request, res: Response) => {
  const items = await getCustomerTimeline(req.params.botId, req.params.customerId);
  res.json({ items });
});

app.get('/api/owner/bots/:botId/appointments', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, validateQuery(OwnerAppointmentsQuerySchema) as any, async (req: Request, res: Response) => {
  const q = req.query as any;
  const items = await listAppointments({
    botId: req.params.botId,
    from: q.from,
    to: q.to,
    staffId: q.staffId,
    status: q.status,
  });
  res.json({ items });
});

app.post('/api/owner/bots/:botId/appointments', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerCsrf as any, requireOwnerBotAccess as any, validateBody(OwnerCreateAppointmentSchema) as any, async (req: Request, res: Response) => {
  const created = await createAppointment({
    botId: req.params.botId,
    ...(req.body as any),
  });
  await insertOwnerAudit({
    botId: req.params.botId,
    actorTelegramUserId: (req as any).owner.sub,
    entity: 'appointments',
    entityId: (created as any).id,
    action: 'create',
    afterJson: created as any,
    requestId: getRequestId() ?? null,
  });
  res.status(201).json(created);
});

app.patch('/api/owner/bots/:botId/appointments/:id', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerCsrf as any, requireOwnerBotAccess as any, validateBody(OwnerPatchAppointmentSchema) as any, async (req: Request, res: Response) => {
  const updated = await patchAppointment(req.params.botId, req.params.id, req.body as any);
  if (!updated) return ownerError(res, 404, 'not_found', 'Запись не найдена');
  res.json(updated);
});

app.get('/api/owner/bots/:botId/availability', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, validateQuery(OwnerAvailabilityQuerySchema) as any, async (req: Request, res: Response) => {
  const q = req.query as any;
  const items = await getAvailability({
    botId: req.params.botId,
    date: q.date,
    staffId: q.staffId,
    serviceId: q.serviceId,
  });
  res.json({ items });
});

app.get('/api/owner/bots/:botId/orders', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, validateQuery(OwnerOrdersQuerySchema) as any, async (req: Request, res: Response) => {
  const q = req.query as any;
  const page = await listOrders({
    botId: req.params.botId,
    q: q.q,
    status: q.status,
    cursor: q.cursor,
    limit: q.limit ? Number(q.limit) : undefined,
  });
  res.json(page);
});

app.get('/api/owner/bots/:botId/orders/:id', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, async (req: Request, res: Response) => {
  const order = await getOrder(req.params.botId, req.params.id);
  if (!order) return ownerError(res, 404, 'not_found', 'Заказ не найден');
  res.json(order);
});

app.patch('/api/owner/bots/:botId/orders/:id', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerCsrf as any, requireOwnerBotAccess as any, validateBody(OwnerPatchOrderSchema) as any, async (req: Request, res: Response) => {
  const updated = await patchOrder(req.params.botId, req.params.id, req.body as any);
  if (!updated) return ownerError(res, 404, 'not_found', 'Заказ не найден');
  res.json(updated);
});

app.get('/api/owner/bots/:botId/leads', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, validateQuery(OwnerLeadsQuerySchema) as any, async (req: Request, res: Response) => {
  const q = req.query as any;
  const page = await listLeads({
    botId: req.params.botId,
    q: q.q,
    status: q.status,
    cursor: q.cursor,
    limit: q.limit ? Number(q.limit) : undefined,
  });
  res.json(page);
});

app.patch('/api/owner/bots/:botId/leads/:id', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerCsrf as any, requireOwnerBotAccess as any, validateBody(OwnerPatchLeadSchema) as any, async (req: Request, res: Response) => {
  const updated = await patchLead(req.params.botId, req.params.id, req.body as any);
  if (!updated) return ownerError(res, 404, 'not_found', 'Заявка не найдена');
  res.json(updated);
});

app.post('/api/owner/bots/:botId/export', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerCsrf as any, requireOwnerBotAccess as any, validateBody(OwnerExportSchema) as any, async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof OwnerExportSchema>;
  const rows = await listExportRows({
    botId: req.params.botId,
    type: body.type,
    from: body.from,
    to: body.to,
    status: body.status,
  });
  return writeCsv(res, `${body.type}-${Date.now()}.csv`, rows);
});

// v2: Billing-ready - получить usage статистику
app.get('/api/owner/bots/:botId/usage', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, async (req: Request, res: Response) => {
  const botId = req.params.botId;
  const q = req.query as any;
  const usage = await getBotUsage(botId, q.from, q.to);
  res.json({ items: usage });
});

app.get('/api/owner/bots/:botId/audit', ensureDatabasesInitialized as any, requireOwnerAuth as any, requireOwnerBotAccess as any, validateQuery(OwnerAuditQuerySchema) as any, async (req: Request, res: Response) => {
  const q = req.query as any;
  const page = await listOwnerAudit({
    botId: req.params.botId,
    cursor: q.cursor,
    limit: q.limit ? Number(q.limit) : undefined,
  });
  res.json(page);
});

// API Routes

// POST /api/bots - создать бота
app.post('/api/bots', ensureDatabasesInitialized as any, validateBody(CreateBotSchema) as any, requireUserId as any, createBotLimiterMiddleware as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    const userId = (req as any).user.id;

    // Дополнительная валидация тела запроса (на случай, если validateBody пропустил данные)
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      logger.warn(
        { requestId, userId, error_type: 'invalid_body', bodyType: typeof req.body },
        'Invalid request body for create bot'
      );
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request body must be an object',
        requestId,
      });
    }

    const missingFields: string[] = [];
    if (!(req.body as any).token) missingFields.push('token');
    if (!(req.body as any).name) missingFields.push('name');
    if (missingFields.length > 0) {
      logger.warn(
        { requestId, userId, error_type: 'missing_fields', missingFields },
        'Missing required fields for create bot'
      );
      return res.status(400).json({
        error: 'Missing required fields',
        message: `Missing fields: ${missingFields.join(', ')}`,
        missingFields,
        requestId,
      });
    }

    const parsed = CreateBotSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn(
        { requestId, userId, error_type: 'validation_error', errors: parsed.error.issues },
        'Create bot request validation failed'
      );
      return res.status(400).json({
        error: 'Validation error',
        details: parsed.error.issues,
        requestId,
      });
    }

    const { token, name } = parsed.data as any;
    const telegramTokenRegex = /^\d+:[A-Za-z0-9_-]{35}$/;
    if (typeof token !== 'string' || !telegramTokenRegex.test(token)) {
      logger.warn(
        { requestId, userId, error_type: 'invalid_token_format' },
        'Invalid Telegram bot token format'
      );
      return res.status(400).json({
        error: 'Invalid token format',
        message: 'Token must match Telegram Bot API format',
        requestId,
      });
    }

    // Проверка количества ботов пользователя
    const userBots = await getBotsByUserId(userId);
    if (userBots.length >= BOT_LIMITS.MAX_BOTS_PER_USER) {
      logger.warn({ userId, currentCount: userBots.length, requestId }, 'Bot creation limit reached');
      return res.status(429).json({
        error: 'Bot limit reached',
        message: `You can create maximum ${BOT_LIMITS.MAX_BOTS_PER_USER} bots`,
        currentCount: userBots.length,
        maxAllowed: BOT_LIMITS.MAX_BOTS_PER_USER,
      });
    }

    if (!encryptionAvailable) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'Encryption is not available',
      });
    }

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'Encryption is not available',
      });
    }

    const duplicateToken = userBots.some((bot) => {
      try {
        return decryptToken(bot.token, encryptionKey) === token;
      } catch {
        return false;
      }
    });
    if (duplicateToken) {
      return res.status(409).json({ error: 'Bot token already exists' });
    }

    const encryptedToken = encryptToken(token, encryptionKey);
    const context = (req as any).context;
    let bot;
    try {
      bot = await createBot({ user_id: userId, token: encryptedToken, name }, context);
    } catch (error) {
      if (error instanceof BotLimitError) {
        logger.warn({ userId: error.userId, activeCount: error.activeCount, limit: error.limit, requestId }, 'Bot creation limit reached');
        return res.status(429).json({
          error: 'Bot limit reached',
          code: error.code,
          message: `You can create maximum ${error.limit} bots`,
          currentCount: error.activeCount,
          maxAllowed: error.limit,
        });
      }
      throw error;
    }

    res.json({
      id: bot.id,
      name: bot.name,
      webhook_set: bot.webhook_set,
      schema_version: bot.schema_version,
      created_at: bot.created_at,
    });
  } catch (error) {
    logger.error({ requestId, error }, '❌ Error creating bot:');
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/bots - получить список ботов пользователя
app.get('/api/bots', ensureDatabasesInitialized as any, validateQuery(PaginationSchema) as any, requireUserId as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    const userId = (req as any).user.id;
    const parsed = PaginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.errors });
    }
    const { limit, cursor } = parsed.data;

    logger.info({ userId, requestId, limit, cursorPresent: Boolean(cursor) }, '📋 GET /api/bots');
    
    const startTime = Date.now();
    const result = await getBotsByUserIdPaginated(userId, { limit, cursor });
    const duration = Date.now() - startTime;
    logger.info(
      { metric: 'db_query', operation: 'getBotsByUserIdPaginated', userId, count: result.bots.length, duration, requestId },
      'Bots fetched'
    );
    logger.info({ userId, requestId, count: result.bots.length }, '✅ Found bots:');
    logger.info(
      { metric: 'active_bots', userId, count: result.bots.length, requestId },
      'Active bots count'
    );
    
    // Убираем токены из ответа
    const safeBots = result.bots.map(bot => ({
      id: bot.id,
      name: bot.name,
      webhook_set: bot.webhook_set,
      schema_version: bot.schema_version,
      created_at: bot.created_at,
    }));
    
    logger.info({ userId, requestId, count: safeBots.length }, '✅ Returning safe bots:');
    res.json({
      bots: safeBots,
      pagination: {
        limit,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    logger.error({ requestId, error }, '❌ Error fetching bots:');
    logger.error(
      { requestId, stack: error instanceof Error ? error.stack : 'No stack' },
      'Error stack:'
    );
    logger.error(
      { requestId, message: error instanceof Error ? error.message : String(error) },
      'Error message:'
    );
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/bot/:id - получить бота
app.get('/api/bot/:id', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    const bot = (req as any).bot;

    res.json({
      id: bot.id,
      name: bot.name,
      webhook_set: bot.webhook_set,
      schema_version: bot.schema_version,
      created_at: bot.created_at,
    });
  } catch (error) {
    logger.error({ requestId, error }, 'Error fetching bot:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bot/:id/schema - получить схему бота
app.get('/api/bot/:id/schema', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    const bot = (req as any).bot;
    const userId = (req as any).user.id;
    const botId = req.params.id;

    if (!bot.schema) {
      logger.warn({ userId, botId, requestId }, 'Schema not found');
      return res.status(404).json({ error: 'Schema not found' });
    }
    
    logger.info({ userId, botId, requestId }, 'Schema fetched');
    res.json(bot.schema);
  } catch (error) {
    logger.error({ requestId, error }, 'Error fetching schema:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

const updateSchemaHandler = async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    if (!encryptionAvailable) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'Encryption is not available',
      });
    }
    const userId = (req as any).user.id;
    const botId = req.params.id;
    const schema = req.body;
    const bot = (req as any).bot;

    const stateCount = Object.keys((schema as any)?.states ?? {}).length;
    if (stateCount > BOT_LIMITS.MAX_SCHEMA_STATES) {
      logger.warn({ userId, botId, requestId, error: 'Schema too large', currentCount: stateCount }, 'Invalid schema');
      return res.status(400).json({
        error: 'Schema too large',
        message: `Maximum ${BOT_LIMITS.MAX_SCHEMA_STATES} states allowed`,
        currentCount: stateCount,
      });
    }

    const schemaValidation = validateBotSchema(schema);
    if (!schemaValidation.valid) {
      logger.warn({ userId, botId, requestId, errors: schemaValidation.errors }, 'Invalid schema');
      return res.status(400).json({ error: 'Invalid schema', errors: schemaValidation.errors });
    }
    
    // Обновляем схему
    const updateStart = Date.now();
    let success: boolean;
    const context = (req as any).context;
    try {
      success = await updateBotSchema(botId, userId, schema, context);
    } catch (error) {
      logger.error({ userId, botId, requestId, error }, 'Failed to update schema');
      throw error;
    }
    const updateDuration = Date.now() - updateStart;
    logger.info(
      { metric: 'db_query', operation: 'updateBotSchema', userId, botId, duration: updateDuration, requestId },
      'Schema updated'
    );
    if (!success) {
      logger.error({ userId, botId, requestId }, 'Schema update failed');
      return res.status(500).json({ error: 'Failed to update schema' });
    }
    
    const newSchemaVersion = (bot.schema_version || 0) + 1;
    const redisClient = await getRedisClientOptional();
    if (redisClient) {
      await redisClient.del(`bot:${botId}:schema`);
      logger.info({ userId, botId, requestId }, 'Schema cache invalidated');
    }

    logger.info({ userId, botId, requestId }, 'Schema update response sent');
    res.json({ 
      success: true, 
      message: 'Schema updated successfully',
      schema_version: newSchemaVersion
    });
  } catch (error) {
    logger.error({ requestId, error }, 'Error updating schema:');
    res.status(500).json({ error: 'Internal server error' });
  }
};

const TestWebhookSchema = z.object({
  stateKey: z.string(),
});
const IsoDateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Invalid date',
});
const AnalyticsEventsQuerySchema = PaginationSchema.extend({
  event_type: z.string().optional(),
  date_from: IsoDateSchema.optional(),
  date_to: IsoDateSchema.optional(),
});
const AnalyticsStatsQuerySchema = z.object({
  date_from: IsoDateSchema.optional(),
  date_to: IsoDateSchema.optional(),
});
const AnalyticsPathsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  date_from: IsoDateSchema.optional(),
  date_to: IsoDateSchema.optional(),
});
const AnalyticsFunnelQuerySchema = z.object({
  states: z.string(),
  date_from: IsoDateSchema.optional(),
  date_to: IsoDateSchema.optional(),
});
const AnalyticsTimeSeriesQuerySchema = z.object({
  event_type: z.string(),
  date_from: IsoDateSchema.optional(),
  date_to: IsoDateSchema.optional(),
  granularity: z.enum(['hour', 'day', 'week']).optional(),
});
const AnalyticsExportQuerySchema = z.object({
  date_from: IsoDateSchema.optional(),
  date_to: IsoDateSchema.optional(),
});

// POST /api/bot/:id/schema - обновить схему бота
app.post('/api/bot/:id/schema', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, validateBody(UpdateBotSchemaSchema) as any, requireUserId as any, requireBotOwnership() as any, updateSchemaLimiterMiddleware as any, updateSchemaHandler as any);
// PUT /api/bot/:id/schema - обновить схему бота
app.put('/api/bot/:id/schema', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, validateBody(UpdateBotSchemaSchema) as any, requireUserId as any, requireBotOwnership() as any, updateSchemaLimiterMiddleware as any, updateSchemaHandler as any);

// GET /api/bot/:id/webhooks - получить логи webhook
app.get('/api/bot/:id/webhooks', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, validateQuery(PaginationSchema) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    const botId = req.params.id;
    const parsed = PaginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.errors });
    }
    const { limit, cursor } = parsed.data;
    const result = await getWebhookLogsByBotId(botId, { limit, cursor });
    res.json({ logs: result.logs, nextCursor: result.nextCursor, hasMore: result.hasMore });
  } catch (error) {
    logger.error({ requestId, error }, 'Error fetching webhook logs:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bot/:id/webhooks/stats - статистика webhook
app.get('/api/bot/:id/webhooks/stats', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    const botId = req.params.id;
    const stats = await getWebhookStats(botId);
    const total = stats.reduce((sum, row) => sum + row.total, 0);
    const success = stats.reduce((sum, row) => sum + row.success_count, 0);
    const successRate = total > 0 ? success / total : 0;

    res.json({ total, successRate, states: stats });
  } catch (error) {
    logger.error({ requestId, error }, 'Error fetching webhook stats:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bot/:id/test-webhook - тестовая отправка webhook
app.post('/api/bot/:id/test-webhook', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, validateBody(TestWebhookSchema) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    const botId = req.params.id;
    const { stateKey } = req.body as { stateKey: string };
    const bot = (req as any).bot;

    if (!bot?.schema || !bot.schema.states?.[stateKey]) {
      return res.status(404).json({ error: 'State not found' });
    }

    const state = bot.schema.states[stateKey];
    if (!state.webhook?.url || !state.webhook.enabled) {
      return res.status(400).json({ error: 'Webhook is not enabled for this state' });
    }

    await ensureSafeWebhookUrl(state.webhook.url);

    const payload = {
      bot_id: botId,
      user_id: 0,
      state_key: stateKey,
      timestamp: new Date().toISOString(),
      user: {
        first_name: 'Test',
        phone_number: null,
        email: null,
      },
      context: {
        previous_state: null,
      },
    };
    const routerInternalUrl = process.env.ROUTER_INTERNAL_URL;
    if (!routerInternalUrl) {
      return res.status(500).json({ error: 'Router internal URL is not configured' });
    }

    const targetUrl = `${routerInternalUrl.replace(/\/$/, '')}/internal/test-webhook`;
    const headers: Record<string, string> = {};
    if (process.env.ROUTER_INTERNAL_SECRET) {
      headers['x-internal-secret'] = process.env.ROUTER_INTERNAL_SECRET;
    }

    const response = await axios.post(
      targetUrl,
      { webhook: state.webhook, payload },
      {
        headers,
        timeout: WEBHOOK_INTEGRATION_LIMITS.AWAIT_FIRST_ATTEMPT_TIMEOUT_MS,
        validateStatus: () => true,
      }
    );

    const data = response.data ?? {};
    res.json({
      success: Boolean(data.success),
      status: data.status ?? response.status,
      response: data.response ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ requestId, error: maskSensitive(message) }, 'Error testing webhook:');
    res.status(500).json({ error: 'Webhook test failed', message });
  }
});

// GET /api/bot/:id/users - получить список контактов
app.get('/api/bot/:id/users', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, validateQuery(PaginationSchema) as any, requireUserId as any, requireBotOwnership() as any, apiGeneralLimiterMiddleware as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;
    const parsed = PaginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.errors });
    }
    const { limit, cursor } = parsed.data;

    const result = await getBotUsers(botId, userId, { limit, cursor });
    logger.info({ metric: 'bot_users_fetched', botId, count: result.users.length, requestId }, 'Bot users fetched');
    res.json({ users: result.users, nextCursor: result.nextCursor, hasMore: result.hasMore });
  } catch (error) {
    logger.error({ requestId, error }, 'Error fetching bot users:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bot/:id/users/stats - статистика контактов
app.get('/api/bot/:id/users/stats', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;

    const stats = await getBotUserStats(botId, userId);
    res.json(stats);
  } catch (error) {
    logger.error({ requestId, error }, 'Error fetching bot users stats:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bot/:id/users/export - экспорт в CSV
app.get('/api/bot/:id/users/export', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, requireUserId as any, requireBotOwnership() as any, exportUsersLimiterMiddleware as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;

    const csv = await exportBotUsersToCSV(botId, userId);
    logger.info({ metric: 'bot_users_exported', botId, requestId }, 'Bot users exported');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="contacts-${botId}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error({ requestId, error }, 'Error exporting bot users:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bot/:id/analytics/events - получить события
app.get('/api/bot/:id/analytics/events', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, validateQuery(AnalyticsEventsQuerySchema) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;
    const parsed = AnalyticsEventsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.errors });
    }
    const { limit, cursor, event_type, date_from, date_to } = parsed.data;
    const result = await getAnalyticsEvents(botId, userId, {
      limit,
      cursor,
      eventType: event_type,
      dateFrom: date_from,
      dateTo: date_to,
    });
    res.json({ events: result.events, nextCursor: result.nextCursor, hasMore: result.hasMore });
  } catch (error) {
    logger.error({ error }, 'Error fetching analytics events:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bot/:id/analytics/stats - получить статистику
app.get('/api/bot/:id/analytics/stats', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, validateQuery(AnalyticsStatsQuerySchema) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;
    const parsed = AnalyticsStatsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.errors });
    }
    const { date_from, date_to } = parsed.data;
    const stats = await getAnalyticsStats(botId, userId, date_from, date_to);
    res.json(stats);
  } catch (error) {
    logger.error({ error }, 'Error fetching analytics stats:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bot/:id/analytics/paths - получить популярные пути
app.get('/api/bot/:id/analytics/paths', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, validateQuery(AnalyticsPathsQuerySchema) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;
    const parsed = AnalyticsPathsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.errors });
    }
    const { limit, date_from, date_to } = parsed.data;
    const paths = await getPopularPaths(botId, userId, limit, date_from, date_to);
    res.json({ paths });
  } catch (error) {
    logger.error({ error }, 'Error fetching analytics paths:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bot/:id/analytics/funnel - получить данные воронки
app.get('/api/bot/:id/analytics/funnel', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, validateQuery(AnalyticsFunnelQuerySchema) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;
    const parsed = AnalyticsFunnelQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.errors });
    }
    const { states, date_from, date_to } = parsed.data;
    const stateKeys = states.split(',').map((state) => state.trim()).filter(Boolean);
    const steps = await getFunnelData(botId, userId, stateKeys, date_from, date_to);
    res.json({ steps });
  } catch (error) {
    logger.error({ error }, 'Error fetching analytics funnel:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bot/:id/analytics/timeseries - получить временной ряд
app.get('/api/bot/:id/analytics/timeseries', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, validateQuery(AnalyticsTimeSeriesQuerySchema) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;
    const parsed = AnalyticsTimeSeriesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.errors });
    }
    const { event_type, date_from, date_to, granularity } = parsed.data;
    const data = await getTimeSeriesData(botId, userId, event_type, date_from, date_to, granularity);
    res.json({ data });
  } catch (error) {
    logger.error({ error }, 'Error fetching analytics timeseries:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bot/:id/analytics/export - экспорт отчета
app.get('/api/bot/:id/analytics/export', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, validateQuery(AnalyticsExportQuerySchema) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;
    const parsed = AnalyticsExportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.errors });
    }
    const { date_from, date_to } = parsed.data;
    const csv = await exportAnalyticsToCSV(botId, userId, date_from, date_to);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${botId}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error({ error }, 'Error exporting analytics:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bot/:id/broadcasts - создать рассылку
app.post('/api/bot/:id/broadcasts',
  ensureDatabasesInitialized as any,
  validateParams(z.object({ id: BotIdSchema })) as any,
  validateBody(CreateBroadcastSchema) as any,
  requireUserId as any,
  requireBotOwnership() as any,
  createBroadcastLimiterMiddleware as any,
  async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const botId = req.params.id;
    const data = req.body;

    const userIds = await getBotTelegramUserIds(botId, userId);
    const broadcast = await createBroadcast(botId, userId, {
      ...data,
      totalRecipients: userIds.length,
    });
    await createBroadcastMessages(broadcast.id, userIds);
    logBroadcastCreated(logger, {
      broadcastId: broadcast.id,
      botId,
      totalRecipients: userIds.length,
    });
    res.json(broadcast);
  }
);

// GET /api/bot/:id/broadcasts - список рассылок
app.get('/api/bot/:id/broadcasts',
  ensureDatabasesInitialized as any,
  validateParams(z.object({ id: BotIdSchema })) as any,
  validateQuery(PaginationSchema) as any,
  requireUserId as any,
  requireBotOwnership() as any,
  async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const botId = req.params.id;
    const parsed = PaginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.errors });
    }
    const { limit, cursor } = parsed.data;

    const result = await getBroadcastsByBotId(botId, userId, { limit, cursor });
    res.json(result);
  }
);

// GET /api/bot/:id/broadcasts/:broadcastId - детали рассылки
app.get('/api/bot/:id/broadcasts/:broadcastId',
  ensureDatabasesInitialized as any,
  validateParams(z.object({ id: BotIdSchema, broadcastId: BroadcastIdSchema })) as any,
  requireUserId as any,
  requireBotOwnership() as any,
  async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { broadcastId } = req.params;

    const broadcast = await getBroadcastById(broadcastId, userId);
    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const stats = await getBroadcastStats(broadcastId);
    res.json({ ...broadcast, stats });
  }
);

// POST /api/bot/:id/broadcasts/:broadcastId/start - запустить рассылку
app.post('/api/bot/:id/broadcasts/:broadcastId/start',
  ensureDatabasesInitialized as any,
  validateParams(z.object({ id: BotIdSchema, broadcastId: BroadcastIdSchema })) as any,
  requireUserId as any,
  requireBotOwnership() as any,
  async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { broadcastId } = req.params;

    const broadcast = await getBroadcastById(broadcastId, userId);
    if (!broadcast || broadcast.status !== 'draft') {
      return res.status(400).json({ error: 'Cannot start this broadcast' });
    }

    await updateBroadcast(broadcastId, { status: 'processing' });
    processBroadcastAsync(broadcastId);

    res.json({ success: true });
  }
);

// POST /api/bot/:id/broadcasts/:broadcastId/cancel - отменить рассылку
app.post('/api/bot/:id/broadcasts/:broadcastId/cancel',
  ensureDatabasesInitialized as any,
  validateParams(z.object({ id: BotIdSchema, broadcastId: BroadcastIdSchema })) as any,
  requireUserId as any,
  requireBotOwnership() as any,
  async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { broadcastId } = req.params;

    await cancelBroadcast(broadcastId, userId);
    res.json({ success: true });
  }
);

// POST /api/internal/process-broadcast - internal processing trigger
app.post('/api/internal/process-broadcast',
  ensureDatabasesInitialized as any,
  validateBody(z.object({ broadcastId: BroadcastIdSchema })) as any,
  async (req: Request, res: Response) => {
    const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
    const internalSecret = process.env.CORE_INTERNAL_SECRET;
    const providedSecret = req.headers['x-internal-secret'];
    if (!internalSecret || providedSecret !== internalSecret) {
      logger.warn({ requestId }, 'Unauthorized internal process-broadcast attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { broadcastId } = req.body as { broadcastId: string };
    const broadcast = await getBroadcastById(broadcastId, null);
    if (!broadcast) {
      logger.warn({ requestId, broadcastId }, 'Broadcast not found for processing');
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    if (broadcast.status !== 'scheduled' && broadcast.status !== 'processing') {
      logger.warn({ requestId, broadcastId, status: broadcast.status }, 'Broadcast status not allowed for processing');
      return res.status(400).json({ error: 'Broadcast status not allowed' });
    }

    if (broadcast.status === 'scheduled') {
      await updateBroadcast(broadcastId, { status: 'processing' });
    }
    processBroadcastAsync(broadcastId);
    res.json({ success: true });
  }
);
// DELETE /api/bot/:id - удалить бота
app.delete('/api/bot/:id', ensureDatabasesInitialized as any, validateParams(z.object({ id: BotIdSchema })) as any, requireUserId as any, requireBotOwnership() as any, async (req: Request, res: Response) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  try {
    const userId = (req as any).user.id;
    const botId = req.params.id;

    const context = (req as any).context;
    const deleted = await deleteBot(botId, userId, context);
    if (!deleted) {
      logger.error({ userId, botId, requestId }, 'Bot delete failed');
      return res.status(500).json({ error: 'Failed to delete bot' });
    }

  res.json({ success: true });
  } catch (error) {
    logger.error({ requestId, error }, 'Error deleting bot:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error tracking (within this app instance)
const errorCountsByEndpoint: Record<string, number> = {};
const errorCountsByType: Record<string, number> = {};
const errorRateLimitByUser = new Map<number, { count: number; windowStart: number; blockedUntil: number | null }>();
const ERROR_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const ERROR_RATE_LIMIT_MAX_ERRORS = 20;
const ERROR_RATE_LIMIT_BLOCK_MS = 5 * 60 * 1000;

function classifyErrorType(err: any): string {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return 'json_parse';
  }
  if (err?.type === 'entity.too.large' || err?.status === 413 || err?.statusCode === 413) {
    return 'payload_too_large';
  }
  if (err?.name === 'ZodError' || Array.isArray(err?.issues) || Array.isArray(err?.errors)) {
    return 'validation';
  }
  const name = err?.name || '';
  const message = err?.message || '';
  const code = err?.code || '';
  if (/postgres|database|sql|pg/i.test(String(name) + String(message) + String(code))) {
    return 'database';
  }
  return 'unknown';
}

app.use(errorMetricsMiddleware as any);

// v2: Observability - Sentry error handler
if (process.env.SENTRY_DSN && !isTestEnv) {
  app.use(Sentry.Handlers.errorHandler());
}
app.use((err: any, req: Request, res: Response, next: Function) => {
  const requestId = getRequestId() ?? (req as any)?.id ?? 'unknown';
  const userId = (req as any).user?.id;
  const errorType = classifyErrorType(err);
  const endpointKey = `${req.method} ${req.path}`;
  errorCountsByEndpoint[endpointKey] = (errorCountsByEndpoint[endpointKey] || 0) + 1;
  errorCountsByType[errorType] = (errorCountsByType[errorType] || 0) + 1;

  // Rate limiting for erroneous requests (per user)
  const now = Date.now();
  if (typeof userId === 'number') {
    const existing = errorRateLimitByUser.get(userId);
    if (!existing || now - existing.windowStart > ERROR_RATE_LIMIT_WINDOW_MS) {
      errorRateLimitByUser.set(userId, { count: 1, windowStart: now, blockedUntil: null });
    } else {
      existing.count += 1;
      if (!existing.blockedUntil && existing.count >= ERROR_RATE_LIMIT_MAX_ERRORS) {
        existing.blockedUntil = now + ERROR_RATE_LIMIT_BLOCK_MS;
      }
    }
  }
  const rateState = typeof userId === 'number' ? errorRateLimitByUser.get(userId) : null;
  const isBlocked = Boolean(rateState?.blockedUntil && rateState.blockedUntil > now);
  const errorContext = {
    requestId,
    method: req.method,
    path: req.path,
    userId,
    error_type: errorType,
    endpoint_error_count: errorCountsByEndpoint[endpointKey],
    error: {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
    },
  };

  logger.error(errorContext, 'Unhandled error');
  logger.info({
    metric: 'api_error_total',
    error_type: errorType,
    method: req.method,
    path: req.path,
    statusCode: err?.statusCode || err?.status || 500,
    endpoint_error_count: errorCountsByEndpoint[endpointKey],
    error_type_count: errorCountsByType[errorType],
    requestId,
    userId,
  });

  if (isBlocked) {
    logger.warn(
      {
        requestId,
        userId,
        error_type: 'error_rate_limited',
        blockedUntil: rateState?.blockedUntil ? new Date(rateState.blockedUntil).toISOString() : null,
      },
      'User temporarily blocked due to excessive errors'
    );
    return res.status(429).json({
      error: 'Too many errors',
      message: 'Too many erroneous requests. Please try again later.',
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  let statusCode = err?.statusCode || err?.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message =
    isProduction
      ? 'An error occurred'
      : err instanceof Error
        ? err.message
        : String(err);

  let errorMessage: string = 'Internal server error';
  const responsePayload: any = {
    requestId,
    timestamp: new Date().toISOString(),
  };

  if (errorType === 'json_parse') {
    statusCode = 400;
    errorMessage = 'Invalid JSON format';
  } else if (errorType === 'validation') {
    statusCode = 400;
    errorMessage = 'Validation error';
    responsePayload.details = err?.issues || err?.errors;
  } else if (errorType === 'database') {
    errorMessage = 'Service temporarily unavailable';
  }

  res.status(statusCode).json({
    error: errorMessage,
    message,
    ...responsePayload,
  });
});
}

// Start server (only in non-serverless environment)
async function startServer() {
  if (process.env.VERCEL === '1') {
    return;
  }

  // Вызываем ensureBotInitialized вместо отдельных init
  await ensureBotInitialized();
  await initializeRateLimiters();

  const appInstance = createApp();
  appInstance.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    logger.error({ error }, 'Failed to start server');
  });
}

// Export app for Vercel serverless functions
import type { Express } from 'express';
const appInstance: Express = createApp();
export default appInstance;
module.exports = appInstance; // Also export as CommonJS for compatibility

// Export botInstance for webhook endpoint
export { botInstance, botInitialized, ensureBotInitialized, initBot };
if (typeof module !== 'undefined') {
  (module.exports as any).botInstance = botInstance;
  (module.exports as any).botInitialized = botInitialized;
  (module.exports as any).ensureBotInitialized = ensureBotInitialized;
  (module.exports as any).initBot = initBot;
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down gracefully...');
  
  if (botInstance) {
    await botInstance.stop('SIGTERM');
  }
  
  await closePostgres();
  await closeRedis();
  
  process.exit(0);
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception');
  shutdown().catch((shutdownError) => {
    logger.error({ error: shutdownError }, 'Graceful shutdown failed');
    process.exit(1);
  });
});

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);


