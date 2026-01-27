import axios from 'axios';
import crypto from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import type { Logger } from '@dialogue-constructor/shared';
import type { BotSchema, WebhookConfig } from '@dialogue-constructor/shared';
import { WEBHOOK_INTEGRATION_LIMITS } from '@dialogue-constructor/shared';

type WebhookSendResult = {
  status: number | null;
  response: unknown;
  retryCount: number;
  error?: string | null;
};

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

export function prepareWebhookPayload(
  botId: string,
  userId: number,
  stateKey: string,
  userProfile: {
    first_name?: string | null;
    phone_number?: string | null;
    email?: string | null;
  } | null,
  botSchema: BotSchema,
  previousState?: string | null
) {
  return {
    bot_id: botId,
    user_id: userId,
    state_key: stateKey,
    timestamp: new Date().toISOString(),
    user: {
      first_name: userProfile?.first_name ?? null,
      phone_number: userProfile?.phone_number ?? null,
      email: userProfile?.email ?? null,
    },
    context: {
      previous_state: previousState ?? null,
      initial_state: botSchema.initialState,
    },
  };
}

export async function sendWebhook(
  config: WebhookConfig,
  payload: unknown,
  logger: Logger
): Promise<WebhookSendResult> {
  if (!config.url) {
    throw new Error('Webhook URL is required');
  }

  await ensureSafeWebhookUrl(config.url);

  const method = config.method ?? 'POST';
  const timeout = config.timeout ?? WEBHOOK_INTEGRATION_LIMITS.TIMEOUT_MS;
  const headers: Record<string, string> = { ...(config.headers ?? {}) };

  const body = method === 'GET' ? '' : JSON.stringify(payload ?? {});
  if (config.signingSecret) {
    const timestamp = new Date().toISOString();
    const signature = crypto
      .createHmac('sha256', config.signingSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    headers['X-Bot-Timestamp'] = timestamp;
    headers['X-Bot-Signature'] = signature;
  }

  if (method !== 'GET') {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  try {
    const response = await axios.request({
      url: config.url,
      method,
      data: method === 'GET' ? undefined : payload,
      headers,
      timeout,
      maxRedirects: 0,
      validateStatus: () => true,
    });

    const responseData = typeof response.data === 'string' ? response.data : response.data;
    logger.info(
      {
        service: 'router',
        metric: 'webhook_delivery',
        status: response.status,
      },
      'Webhook attempt completed'
    );
    return { status: response.status, response: responseData, retryCount: 0, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      {
        service: 'router',
        metric: 'webhook_delivery',
        error: maskSensitive(message),
      },
      'Webhook attempt failed'
    );
    return { status: null, response: null, retryCount: 0, error: message };
  }
}

export async function sendWebhookWithRetry(
  config: WebhookConfig,
  payload: unknown,
  logger: Logger,
  maxRetries = WEBHOOK_INTEGRATION_LIMITS.MAX_RETRY_COUNT
): Promise<WebhookSendResult> {
  let attempt = 0;
  let lastResult: WebhookSendResult = { status: null, response: null, retryCount: 0, error: null };

  while (attempt <= maxRetries) {
    if (attempt > 0) {
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    attempt += 1;
    const result = await sendWebhook(config, payload, logger);
    lastResult = { ...result, retryCount: attempt - 1 };

    if (result.status && result.status >= 200 && result.status < 300) {
      return lastResult;
    }

    if (result.status && result.status < 500) {
      return lastResult;
    }
  }

  return lastResult;
}
