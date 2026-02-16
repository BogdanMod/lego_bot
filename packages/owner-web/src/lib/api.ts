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
  csrfToken: z.string(),
});

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path;
  
  // Add timeout for server-side fetch (3000ms)
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 3000) : null;
  
  try {
    const response = await fetch(url, {
      ...init,
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
        message: 'Request timeout (3000ms)',
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

export function ownerAuthBotlink(token: string) {
  return request<{ ok: boolean }>(normalizeOwnerPath('/api/owner/auth/botlink'), {
    method: 'POST',
    body: JSON.stringify({ token }),
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

async function ensureCsrfToken(): Promise<string | null> {
  if (csrfTokenCache) return csrfTokenCache;
  try {
    const data = await ownerMe();
    return data.csrfToken || null;
  } catch {
    return null;
  }
}

export async function ownerFetch<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    csrfToken?: string;
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
  return request<{ items: Array<{ botId: string; name: string; role: string }> }>(
    normalizeOwnerPath('/api/owner/bots')
  );
}

export async function ownerDeactivateBot(botId: string) {
  return request<{ success: boolean; message: string }>(
    normalizeOwnerPath(`/api/owner/bots/${botId}`),
    { method: 'DELETE' }
  );
}

