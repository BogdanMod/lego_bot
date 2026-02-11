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
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err: ApiError = {
      code: data?.code || 'request_failed',
      message: data?.message || 'Ошибка запроса',
      request_id: data?.request_id,
      details: data?.details,
    };
    throw err;
  }
  return data as T;
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

