// Vercel Serverless Function для Telegram Webhook
// Отдельный endpoint для /api/webhook
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Импортируем модуль - это инициализирует бота, если еще не инициализирован
    // @ts-ignore - dist файлы могут не иметь типов
    const coreModule = require('../dist/index');
    
    // Получаем botInstance - он должен быть экспортирован из index.ts
    let botInstance = coreModule.botInstance;
    
    // Если botInstance не найден, возможно модуль еще не загрузился полностью
    // Попробуем подождать немного и повторить
    if (!botInstance) {
      // Даем время на инициализацию (если она асинхронная)
      await new Promise(resolve => setTimeout(resolve, 100));
      botInstance = coreModule.botInstance;
    }
    
    if (!botInstance) {
      console.error('❌ Bot instance not available in webhook handler');
      console.error('Available exports:', Object.keys(coreModule));
      return res.status(503).json({ error: 'Bot not initialized' });
    }

    // Получаем raw body (Telegram отправляет JSON как raw body)
    // На Vercel с @vercel/node body может быть уже распарсен
    let update: any;
    
    // Проверяем, есть ли raw body в req
    if (req.body) {
      if (typeof req.body === 'string') {
        update = JSON.parse(req.body);
      } else if (Buffer.isBuffer(req.body)) {
        update = JSON.parse(req.body.toString());
      } else if (typeof req.body === 'object') {
        // Уже распарсен Vercel
        update = req.body;
      } else {
        update = req.body;
      }
    } else {
      // Если body пустой, возможно нужно читать из stream
      console.error('❌ No body in request');
      return res.status(400).json({ error: 'No body' });
    }
    
    console.log('📨 Webhook received:', {
      updateId: update?.update_id,
      type: update?.message ? 'message' : update?.callback_query ? 'callback_query' : 'unknown',
    });

    // Обрабатываем обновление
    await botInstance.handleUpdate(update);
    
    // Всегда возвращаем 200 OK для Telegram
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    console.error('Error stack:', error?.stack);
    // Всегда возвращаем 200 для Telegram, чтобы не было повторных запросов
    return res.status(200).json({ ok: true, error: error?.message });
  }
}

