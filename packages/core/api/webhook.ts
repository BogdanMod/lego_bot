// Vercel Serverless Function для Telegram Webhook
// Отдельный endpoint для /api/webhook
// Используем CommonJS для совместимости с Vercel

const processedUpdateIds = new Map<number, number>();
const inFlightUpdateIds = new Map<number, Promise<void>>();
const PROCESSED_UPDATE_TTL_MS = 10 * 60 * 1000;
const PROCESSED_UPDATE_MAX_SIZE = 1000;

function cleanupProcessedUpdateIds() {
  const now = Date.now();
  for (const [updateId, timestamp] of processedUpdateIds.entries()) {
    if (now - timestamp > PROCESSED_UPDATE_TTL_MS) {
      processedUpdateIds.delete(updateId);
    }
  }

  while (processedUpdateIds.size > PROCESSED_UPDATE_MAX_SIZE) {
    const oldestKey = processedUpdateIds.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    processedUpdateIds.delete(oldestKey);
  }
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

function getPostgresPoolState(): Record<string, unknown> {
  try {
    let postgresModule: any;
    try {
      postgresModule = require('../dist/db/postgres');
    } catch {
      postgresModule = require('../db/postgres');
    }

    const pool = typeof postgresModule.getPool === 'function' ? postgresModule.getPool() : null;
    if (!pool) {
      return { exists: false };
    }

    return {
      exists: true,
      ended: Boolean(pool.ended),
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
  } catch (error: any) {
    return {
      exists: 'unknown',
      error: error?.message || String(error),
    };
  }
}

const handler = async (req: any, res: any) => {
  // Логируем сразу в начале - это поможет понять, вызывается ли функция
  console.log('🚀 Webhook handler called');
  console.log('Method:', req.method);
  
  // Только POST запросы
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Валидация Secret Token (если установлен)
  const expectedSecretToken = process.env.TELEGRAM_SECRET_TOKEN;
  if (expectedSecretToken) {
    const receivedSecretTokenHeader = req.headers['x-telegram-bot-api-secret-token'];
    const receivedSecretToken = Array.isArray(receivedSecretTokenHeader)
      ? receivedSecretTokenHeader[0]
      : receivedSecretTokenHeader;
    
    if (!receivedSecretToken) {
      console.log('❌ Missing secret token in request');
      return res.status(401).json({ error: 'Unauthorized: Missing secret token' });
    }
    
    if (String(receivedSecretToken) !== expectedSecretToken) {
      console.log('❌ Invalid secret token');
      return res.status(403).json({ error: 'Forbidden: Invalid secret token' });
    }
    
    console.log('✅ Secret token validated');
  } else {
    console.log('⚠️ Secret token validation disabled (TELEGRAM_SECRET_TOKEN not set)');
  }

  try {
    console.log('📨 Webhook request received');
    console.log('Request method:', req.method);

    // Получаем raw body (Telegram отправляет JSON как raw body)
    // На Vercel с @vercel/node body может быть уже распарсен
    let update: any;
    
    // Проверяем, есть ли raw body в req
    if (req.body) {
      if (typeof req.body === 'string') {
        try {
          update = JSON.parse(req.body);
        } catch {
          return res.status(400).json({ ok: false, error: 'Invalid JSON' });
        }
      } else if (Buffer.isBuffer(req.body)) {
        try {
          update = JSON.parse(req.body.toString());
        } catch {
          return res.status(400).json({ ok: false, error: 'Invalid JSON' });
        }
      } else if (typeof req.body === 'object') {
        // Уже распарсен Vercel
        update = req.body;
      } else {
        update = req.body;
      }
    } else {
      // Если body пустой, возможно нужно читать из stream
      console.error('❌ No body in request');
      return res.status(400).json({ ok: false, error: 'No body' });
    }
    
    console.log('📨 Webhook received:', {
      updateId: update?.update_id,
      type: update?.message ? 'message' : update?.callback_query ? 'callback_query' : 'unknown',
    });
    console.log(
      'Update type:',
      update?.message ? 'message' : update?.callback_query ? 'callback_query' : 'unknown'
    );
    if (update?.message?.text?.startsWith('/')) {
      console.log('Command:', update?.message?.text);
    }

    // Импортируем модуль - это инициализирует бота, если еще не инициализирован
    // @ts-ignore - dist файлы могут не иметь типов
    let coreModule: any;
    try {
      // В test/Vite окружениях TS исходники доступны, поэтому используем dynamic import.
      // В runtime (Vercel) файл будет скомпилирован в JS и import тоже будет работать.
      coreModule = await import('../src/index');
      console.log('✅ Core module loaded (dynamic import)');
    } catch (importError: any) {
      try {
        coreModule = require('../dist/index');
        console.log('✅ Core module loaded (dist)');
      } catch {
        try {
          coreModule = require('../src/index');
          console.log('✅ Core module loaded (src require)');
        } catch {
          console.error('❌ Failed to import core module:', importError);
          console.error('Import error stack:', importError?.stack);
          return res.status(503).json({ ok: false, error: 'Module import failed' });
        }
      }
    }

    // Получаем botInstance - он должен быть экспортирован из index.ts
    // В тестах удобнее подменять botInstance на default-export (Express app object),
    // поэтому проверяем default сначала.
    let botInstance = coreModule.default?.botInstance || coreModule.botInstance;
    let botInitialized = coreModule.default?.botInitialized || coreModule.botInitialized;

    // Если botInstance не найден, возможно модуль еще не загрузился полностью
    if (!botInstance) {
      console.warn('⚠️ Bot instance not found, waiting for initialization...');
      // Даем время на инициализацию (если она асинхронная)
      await new Promise((resolve) => setTimeout(resolve, 200));
      botInstance = coreModule.default?.botInstance || coreModule.botInstance;
      botInitialized = coreModule.default?.botInitialized || coreModule.botInitialized;
    }

    if (!botInstance) {
      console.error('❌ Bot instance not available in webhook handler');
      console.error('Available exports:', Object.keys(coreModule));
      console.error('Module default:', typeof coreModule.default);
      return res.status(503).json({ ok: false, error: 'Bot not initialized' });
    }

    if (!botInitialized) {
      console.warn('⚠️ Bot instance exists but not fully initialized');
    }

    console.log('✅ Bot instance found');
    console.log('Bot initialized:', botInitialized);

    const poolStateBefore = getPostgresPoolState();
    console.log('🔍 PostgreSQL pool state (before):', poolStateBefore);

    const updateId = update?.update_id;

    if (typeof updateId === 'number') {
      cleanupProcessedUpdateIds();

      if (processedUpdateIds.has(updateId)) {
        console.log('✅ Duplicate update detected (already processed), skipping', { updateId });
        return res.status(200).json({ ok: true, deduplicated: true });
      }

      const existingInFlight = inFlightUpdateIds.get(updateId);
      if (existingInFlight) {
        console.log('⏳ Duplicate update detected (in-flight), waiting', { updateId });
        try {
          await withTimeout(existingInFlight, 25000, `Webhook processing timed out (update_id: ${updateId})`);
          return res.status(200).json({ ok: true, deduplicated: true });
        } catch (inFlightError: any) {
          console.error('❌ In-flight update failed', { updateId, error: inFlightError?.message || String(inFlightError) });
          return res.status(503).json({ ok: false, error: 'Update processing failed (in-flight)' });
        }
      }
    }

    const processUpdatePromise = (async () => {
      await botInstance.handleUpdate(update);
    })();

    if (typeof updateId === 'number') {
      inFlightUpdateIds.set(updateId, processUpdatePromise);
    }

    // Обрабатываем обновление с timeout
    try {
      await withTimeout(processUpdatePromise, 25000, `Webhook processing timed out (update_id: ${updateId})`);
      console.log('✅ Update processed successfully');

      if (typeof updateId === 'number') {
        processedUpdateIds.set(updateId, Date.now());
        inFlightUpdateIds.delete(updateId);
      }

      return res.status(200).json({ ok: true });
    } catch (handleError: any) {
      console.error('❌ Error handling update:', handleError);
      console.error('Handle error stack:', handleError?.stack);

      if (typeof updateId === 'number') {
        inFlightUpdateIds.delete(updateId);
      }

      const poolStateAfter = getPostgresPoolState();
      console.log('🔍 PostgreSQL pool state (after):', poolStateAfter);

      return res.status(503).json({ ok: false, error: handleError?.message || String(handleError) });
    }
    
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Error type:', error?.constructor?.name);
    
    // Логируем дополнительную информацию для диагностики
    console.error('🔍 Request details:', {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'],
        'x-telegram-bot-api-secret-token': req.headers['x-telegram-bot-api-secret-token'] ? 'SET' : 'NOT SET',
      },
      bodyLength: req.body ? req.body.length : 0,
    });
    
    return res.status(503).json({ 
      ok: false, 
      error: error?.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

module.exports = handler;


