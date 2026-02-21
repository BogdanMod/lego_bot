import { z } from 'zod';

const OWNER_PROXY_PREFIX = '/api/core';
let csrfTokenCache: string | null = null;

export type ApiError = {
  code: string;
  message: string;
  request_id?: string;
  details?: unknown;
};

const OwnerMeSchema = z.object({
  user: z.object({
    telegramUserId: z.number(),
    username: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    photoUrl: z.string().nullable().optional(),
  }),
  bots: z.array(
    z.object({
      botId: z.string(),
      name: z.string(),
      role: z.string(),
    })
  ),
  botsCountVisible: z.number().optional(), // Single source of truth for count
  csrfToken: z.string(),
});

const DEFAULT_REQUEST_TIMEOUT_MS = 3000;
const LONG_REQUEST_TIMEOUT_MS = 60000; // generate-schema, create bot (LLM can take 10–30s)

type RequestInitWithTimeout = RequestInit & { timeoutMs?: number };

async function request<T>(path: string, init?: RequestInitWithTimeout): Promise<T> {
  const url = path;
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, ...fetchInit } = init ?? {};
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(url, {
      ...fetchInit,
      signal: controller?.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    });
    
    if (timeoutId) clearTimeout(timeoutId);
    
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Improve error messages for specific cases
      let message = data?.message || 'Ошибка запроса';
      const code = data?.code || 'request_failed';
      
      // Handle proxy misconfiguration
      if (code === 'proxy_misconfigured' || message.includes('CORE_API_ORIGIN')) {
        message = 'CORE_API_ORIGIN не настроен. Проверьте переменные окружения в Railway.';
      }
      // Handle core auth misconfiguration
      else if (code === 'misconfigured' && message.includes('Owner auth is not configured')) {
        // Extract missing vars from message if available
        const missingMatch = message.match(/missing ([^,]+(?:, [^,]+)*)/);
        if (missingMatch) {
          message = `Owner auth не настроен: отсутствуют ${missingMatch[1]}. Проверьте переменные окружения в сервисе core.`;
        } else {
          message = 'Owner auth не настроен. Проверьте JWT_SECRET и TELEGRAM_BOT_TOKEN в сервисе core.';
        }
      }
      // Handle CSRF token mismatch - refresh token and retry
      if (code === 'csrf_failed' || code === 'csrf_token_mismatch') {
        // Clear CSRF cache and try to refresh
        csrfTokenCache = null;
        try {
          const freshData = await ownerMe();
          csrfTokenCache = freshData.csrfToken || null;
          message = 'CSRF токен обновлен. Попробуйте еще раз.';
        } catch (refreshError) {
          message = 'Ошибка CSRF токена. Обновите страницу.';
        }
      }
      // Handle 401/403 auth errors
      else if (response.status === 401 || response.status === 403) {
        if (code === 'unauthorized' || code === 'invalid_telegram_auth') {
          message = message || 'Требуется авторизация. Войдите через Telegram.';
        }
      }
      
      const err: ApiError = {
        code,
        message,
        request_id: data?.request_id,
        details: data?.details,
      };
      throw err;
    }
    return data as T;
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error?.name === 'AbortError') {
      const err: ApiError = {
        code: 'timeout',
        message: `Request timeout (${(init as RequestInitWithTimeout)?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS}ms)`,
      };
      throw err;
    }
    throw error;
  }
}

function normalizeOwnerPath(path: string): string {
  if (path.startsWith('/api/core/')) return path;
  if (path.startsWith('/api/')) {
    return path.replace(/^\/api\//, '/api/core/');
  }
  if (path.startsWith('/')) {
    return `${OWNER_PROXY_PREFIX}${path}`;
  }
  return `${OWNER_PROXY_PREFIX}/${path}`;
}

export function ownerAuthTelegram(payload: Record<string, unknown>) {
  return request<{ ok: boolean }>(normalizeOwnerPath('/api/owner/auth/telegram'), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function ownerAuthBotlink(token: string, next?: string) {
  return request<{ ok: boolean; redirect?: string }>(normalizeOwnerPath('/api/owner/auth/botlink'), {
    method: 'POST',
    body: JSON.stringify({ token, ...(next ? { next } : {}) }),
  });
}

export async function ownerMe() {
  const data = await request<unknown>(normalizeOwnerPath('/api/owner/auth/me'));
  const parsed = OwnerMeSchema.parse(data);
  csrfTokenCache = parsed.csrfToken;
  return parsed;
}

export function ownerLogout() {
  return request<{ ok: boolean }>(normalizeOwnerPath('/api/owner/auth/logout'), { method: 'POST' });
}

// v2: RBAC 2.0 - получить bot context с permissions
export async function ownerBotMe(botId: string) {
  return request<{
    role: string;
    permissions: Record<string, boolean>;
    settingsSummary: { businessName?: string; timezone?: string } | null;
    bot: { id: string; name: string };
  }>(normalizeOwnerPath(`/api/owner/bots/${botId}/me`));
}

async function ensureCsrfToken(forceRefresh = false): Promise<string | null> {
  if (csrfTokenCache && !forceRefresh) return csrfTokenCache;
  try {
    const data = await ownerMe();
    csrfTokenCache = data.csrfToken || null;
    return csrfTokenCache;
  } catch {
    csrfTokenCache = null;
    return null;
  }
}

export async function ownerFetch<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    csrfToken?: string;
    /** Таймаут в мс (для generate-schema и создания бота используем 60s). */
    timeoutMs?: number;
  }
) {
  const method = options?.method || 'GET';
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    const csrf = options?.csrfToken || (await ensureCsrfToken());
    if (csrf) {
      headers['x-csrf-token'] = csrf;
    }
  }
  return request<T>(normalizeOwnerPath(path), {
    method,
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    timeoutMs: options?.timeoutMs,
  });
}

export async function ownerSummary() {
  return request<{
    user: {
      userId: number;
      plan: string;
      botLimit: number;
    };
    bots: {
      active: number;
      total: number;
    };
  }>(normalizeOwnerPath('/api/owner/summary'));
}

export async function ownerBots() {
  return request<{ 
    items: Array<{ botId: string; name: string; role: string }>;
    total: number;
  }>(
    normalizeOwnerPath('/api/owner/bots')
  );
}

/** Остановить бота (остаётся в списке, можно снова запустить). */
export async function ownerStopBot(botId: string) {
  await ensureCsrfToken();
  return ownerFetch<{ ok: boolean }>(`/api/owner/bots/${botId}`, {
    method: 'PATCH',
    body: { isActive: false },
  });
}

/** Удалить бота: исчезает из Owner Web и Mini App (soft delete в БД). */
export async function ownerDeleteBot(botId: string) {
  await ensureCsrfToken();
  return ownerFetch<{ success: boolean; message: string }>(
    `/api/owner/bots/${botId}`,
    { method: 'DELETE' }
  );
}

/** @deprecated Use ownerDeleteBot for delete, ownerStopBot for stop. */
export async function ownerDeactivateBot(botId: string) {
  return ownerDeleteBot(botId);
}

export async function ownerActivateBot(botId: string) {
  await ensureCsrfToken();
  return ownerFetch<{ ok: boolean }>(`/api/owner/bots/${botId}`, {
    method: 'PATCH',
    body: { isActive: true },
  });
}

// Templates API
export interface TemplateMetadata {
  id: string;
  title: string;
  industry: string;
  goal: string;
  shortDescription: string;
  requiredInputs: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'email' | 'phone' | 'url';
    required: boolean;
    description?: string;
  }>;
  defaultFlows: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  tags: string[];
}

export async function ownerGetTemplates() {
  return ownerFetch<{ items: TemplateMetadata[] }>('/api/owner/templates');
}

// Bot creation/update API
export interface CreateBotPayload {
  templateId?: string;
  templateVersion?: string;
  name: string;
  timezone?: string;
  language?: string;
  inputs?: Record<string, unknown>;
  config?: {
    schema: unknown; // BotSchema
    metadata?: Record<string, unknown>;
  };
}

export interface UpdateBotPayload {
  name?: string;
  inputs?: Record<string, unknown>;
}

export async function ownerCreateBot(payload: CreateBotPayload) {
  return ownerFetch<{ bot: { botId: string; name: string; role: string } }>('/api/owner/bots', {
    method: 'POST',
    body: payload,
    timeoutMs: LONG_REQUEST_TIMEOUT_MS,
  });
}

/** Generate BotSchema from wizard answers via LLM (Core). */
export async function ownerGenerateSchema(answers: Record<string, string>) {
  return ownerFetch<{ schema: unknown }>('/api/owner/bots/generate-schema', {
    method: 'POST',
    body: { answers },
    timeoutMs: LONG_REQUEST_TIMEOUT_MS,
  });
}

export async function ownerUpdateBot(botId: string, payload: UpdateBotPayload) {
  return ownerFetch<{ ok: boolean }>(`/api/owner/bots/${botId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function ownerUpdateBotSchema(botId: string, schema: any) {
  // Use ownerFetch to automatically include CSRF token
  return ownerFetch<{ ok: boolean; success?: boolean; message?: string; schema_version?: number }>(
    `/api/owner/bots/${botId}/schema`,
    {
      method: 'PUT',
      body: { schema },
    }
  );
}

