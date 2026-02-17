import type { Context } from 'telegraf';
import { createLogger } from '@dialogue-constructor/shared';
import { getRedisClientOptional } from '../db/redis';
import { setBotMenuButton } from '../services/telegram-webhook';

const logger = createLogger('tg-menu-button');

const MENU_BUTTON_TEXT = 'Open Mini App';
const DEDUPE_TTL_SEC = 60 * 60 * 24; // 24h

function canonicalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

export function resolveMiniAppUrlForMenu(): { url: string; source: 'MINIAPP_URL' | 'MINI_APP_URL' | 'DEFAULT_MINI_APP_URL' | 'FALLBACK' } {
  const explicit = process.env.MINIAPP_URL?.trim();
  if (explicit) return { url: canonicalizeUrl(explicit), source: 'MINIAPP_URL' };

  // Backward compatible fallbacks (legacy envs)
  const legacy = process.env.MINI_APP_URL?.trim();
  if (legacy) return { url: canonicalizeUrl(legacy), source: 'MINI_APP_URL' };

  const defaultUrl = process.env.DEFAULT_MINI_APP_URL?.trim();
  if (defaultUrl) return { url: canonicalizeUrl(defaultUrl), source: 'DEFAULT_MINI_APP_URL' };

  const fallback = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'https://miniapp-production-325b.up.railway.app';
  return { url: canonicalizeUrl(fallback), source: 'FALLBACK' };
}

export async function ensureChatMenuButton(params: {
  botToken: string | undefined;
  chatId: number | undefined;
  miniAppUrl: string;
  reason: string;
}): Promise<{ ok: boolean; ensured: boolean; skipped?: boolean; error?: string }> {
  const { botToken, chatId, miniAppUrl, reason } = params;

  if (!botToken) {
    return { ok: false, ensured: false, error: 'TELEGRAM_BOT_TOKEN is not set' };
  }
  if (!chatId) {
    return { ok: false, ensured: false, error: 'chatId is not available' };
  }

  try {
    const result = await setBotMenuButton(botToken, MENU_BUTTON_TEXT, miniAppUrl, chatId);
    if (!result.ok) {
      return { ok: false, ensured: false, error: result.description || 'Unknown error from Telegram API' };
    }

    logger.info({ action: 'menu_button_set', chatId, miniAppUrl, reason }, 'Menu button ensured');
    return { ok: true, ensured: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ action: 'menu_button_set_failed', chatId, miniAppUrl, reason, error: message }, 'Failed to ensure menu button');
    return { ok: false, ensured: false, error: message };
  }
}

/**
 * Ensures chat menu button with Redis dedupe:
 * - key: tg:menu_button_set:<chatId>
 * - TTL: 86400
 *
 * NOTE: if MINIAPP_URL changes, we still update even within TTL (value comparison),
 * because the product goal is "always open актуальный miniapp URL".
 */
export async function ensureChatMenuButtonOncePerDay(params: {
  ctx: Context;
  reason: string;
}): Promise<{ ok: boolean; ensured: boolean; skipped?: boolean; url: string }> {
  const chatId = params.ctx.chat?.id;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const { url } = resolveMiniAppUrlForMenu();

  const redis = await getRedisClientOptional();
  const redisKey = chatId ? `tg:menu_button_set:${chatId}` : null;

  if (redis && redisKey) {
    try {
      const existing = await (redis as any).get(redisKey);
      if (existing === url) {
        return { ok: true, ensured: false, skipped: true, url };
      }
    } catch (err) {
      logger.debug({ action: 'menu_button_dedupe_get_failed', chatId, error: err }, 'Redis get failed (dedupe disabled for this request)');
    }
  }

  const ensured = await ensureChatMenuButton({
    botToken,
    chatId,
    miniAppUrl: url,
    reason: params.reason,
  });

  if (redis && redisKey) {
    try {
      // store current url to dedupe repeated calls for the same chatId
      await (redis as any).set(redisKey, url, { EX: DEDUPE_TTL_SEC });
    } catch (err) {
      logger.debug({ action: 'menu_button_dedupe_set_failed', chatId, error: err }, 'Redis set failed (dedupe disabled)');
    }
  }

  return { ok: ensured.ok, ensured: ensured.ensured, url };
}


