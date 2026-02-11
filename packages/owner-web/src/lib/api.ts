import { z } from 'zod';

const API_BASE = process.env.NEXT_PUBLIC_CORE_API_URL || '';

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
  const url = `${API_BASE}${path}`;
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

export function ownerAuthTelegram(payload: Record<string, unknown>) {
  return request<{ ok: boolean }>('/api/owner/auth/telegram', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function ownerMe() {
  const data = await request<unknown>('/api/owner/auth/me');
  return OwnerMeSchema.parse(data);
}

export function ownerLogout() {
  return request<{ ok: boolean }>('/api/owner/auth/logout', { method: 'POST' });
}

export function ownerFetch<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    csrfToken?: string;
  }
) {
  const headers: Record<string, string> = {};
  if (options?.csrfToken && options.method && options.method !== 'GET') {
    headers['x-csrf-token'] = options.csrfToken;
  }
  return request<T>(path, {
    method: options?.method || 'GET',
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

