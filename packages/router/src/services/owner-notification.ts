/**
 * Send Telegram notification to bot owners when a lead or appointment is created.
 * Uses Core internal endpoint to get botlink URLs; sends message with inline buttons.
 * If Core is unavailable, sends message without buttons (acceptance: уведомление всё равно отправляется).
 */
import axios from 'axios';
import { getBotById, getBotAdminTelegramIds } from '../db/postgres';
import { decryptToken } from '../utils/encryption';
import { sendTelegramMessage, sendTelegramMessageWithKeyboard } from './telegram';
import type { Logger } from 'pino';

const CORE_API_ORIGIN = process.env.CORE_API_ORIGIN?.replace(/\/$/, '') || '';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN?.trim() || '';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

export type OwnerNotificationPayload = {
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt: string; // ISO
};

function buildMessageText(
  eventType: 'lead' | 'appointment',
  botName: string,
  payload: OwnerNotificationPayload
): string {
  const escape = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const title = eventType === 'lead' ? '🔔 Новая заявка' : '📅 Новая запись';
  const lines: string[] = [title];
  if (payload.customerName) lines.push(`Клиент: ${escape(payload.customerName)}`);
  if (payload.phone) lines.push(`Телефон: ${escape(payload.phone)}`);
  if (payload.email) lines.push(`Email: ${escape(payload.email)}`);
  lines.push(`Время: ${payload.createdAt}`);
  lines.push(`Бот: ${escape(botName)}`);
  return lines.join('\n');
}

export async function notifyOwnersOfNewLeadOrAppointment(
  logger: Logger,
  botId: string,
  eventType: 'lead' | 'appointment',
  payload: OwnerNotificationPayload
): Promise<void> {
  let botToken: string;
  let botName = 'Бот';
  try {
    const bot = await getBotById(botId);
    if (!bot || !bot.token || !ENCRYPTION_KEY) {
      logger.warn({ botId }, 'Owner notification: bot not found or token missing');
      return;
    }
    botToken = decryptToken(bot.token, ENCRYPTION_KEY);
    botName = bot.name ?? botName;
  } catch (err) {
    logger.warn({ botId, error: err instanceof Error ? err.message : String(err) }, 'Owner notification: failed to get bot token');
    return;
  }

  const text = buildMessageText(eventType, botName, payload);
  const tab = eventType === 'lead' ? 'leads' : 'appointments';
  const nextPaths = [
    `/m?botId=${encodeURIComponent(botId)}&tab=${tab}`,
    `/cabinet/${botId}/analytics`,
  ];

  let byTelegramUserId: Record<string, string[]> = {};
  if (CORE_API_ORIGIN && INTERNAL_API_TOKEN) {
    try {
      const linksRes = await axios.post<{ botName?: string; byTelegramUserId?: Record<string, string[]> }>(
        `${CORE_API_ORIGIN}/api/internal/owner/notification-links`,
        { botId, nextPaths },
        {
          headers: { 'X-Internal-Token': INTERNAL_API_TOKEN, 'Content-Type': 'application/json' },
          timeout: 8000,
        }
      );
      byTelegramUserId = linksRes.data?.byTelegramUserId ?? {};
      if (linksRes.data?.botName) botName = linksRes.data.botName;
    } catch (err) {
      logger.warn(
        { botId, eventType, error: axios.isAxiosError(err) ? err.message : String(err) },
        'Owner notification: failed to get botlink URLs from Core, sending without buttons'
      );
    }
  } else {
    logger.warn({ botId, eventType }, 'Owner notification skipped: CORE_API_ORIGIN or INTERNAL_API_TOKEN not set');
  }

  const adminIds = Object.keys(byTelegramUserId).length > 0
    ? Object.keys(byTelegramUserId)
    : (await getBotAdminTelegramIds(botId)).map(String);

  if (adminIds.length === 0) {
    logger.debug({ botId }, 'Owner notification: no admins to notify');
    return;
  }

  const hasButtons = Object.keys(byTelegramUserId).length > 0;
  for (const telegramUserIdStr of adminIds) {
    const chatId = Number(telegramUserIdStr);
    if (!Number.isFinite(chatId)) continue;
    if (hasButtons) {
      const urls = byTelegramUserId[telegramUserIdStr];
      if (urls && urls.length >= 2) {
        const buttons = [
          { text: 'Открыть', url: urls[0] },
          { text: 'Открыть полную версию', url: urls[1] },
        ];
        try {
          await sendTelegramMessageWithKeyboard(logger, botToken, chatId, text, buttons, 'HTML');
          logger.info({ botId, eventType, chatId }, 'Owner notification sent');
        } catch (sendErr) {
          logger.warn({ botId, chatId, error: sendErr instanceof Error ? sendErr.message : String(sendErr) }, 'Owner notification: failed to send');
        }
        continue;
      }
    }
    try {
      await sendTelegramMessage(logger, botToken, chatId, text, 'HTML');
      logger.info({ botId, eventType, chatId }, 'Owner notification sent (no buttons)');
    } catch (sendErr) {
      logger.warn({ botId, chatId, error: sendErr instanceof Error ? sendErr.message : String(sendErr) }, 'Owner notification: failed to send');
    }
  }
}
