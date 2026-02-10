/**
 * API Client for Mini-App
 * 
 * Environment Detection:
 * - Local: http://localhost:3000 (when mini-app runs on localhost:5174)
 * - Production: https://lego-bot-core.vercel.app (when deployed)
 * 
 * Testing:
 * 1. Start core: cd packages/core && npm run dev
 * 2. Start mini-app: cd packages/mini-app && npm run dev
 * 3. Open http://localhost:5174 in browser
 * 4. Check console for "🏠 Local development detected"
 * 5. Verify API calls go to http://localhost:3000
 * 
 * Manual API Testing:
 * - GET /api/bots: curl "http://localhost:3000/api/bots?user_id=123"
 * - GET /api/bot/:id/schema: curl "http://localhost:3000/api/bot/BOT_ID/schema?user_id=123"
 * - POST /api/bot/:id/schema: curl -X POST "http://localhost:3000/api/bot/BOT_ID/schema?user_id=123" \
 *     -H "Content-Type: application/json" \
 *     -d '{"version":1,"initialState":"start","states":{"start":{"message":"Test"}}}'
 */
import { BotSummary, ApiError, BotUser, AnalyticsEvent, AnalyticsStats, PopularPath, FunnelStep, TimeSeriesData, Broadcast, BroadcastStats, CreateBroadcastData, BotProject, AdminStats, PromoCode, MaintenanceState } from '../types';
import { BotSchema } from '@dialogue-constructor/shared/browser';
import { schemaToProject, projectToSchema } from './brick-adapters';
import { delay } from './debounce';

export interface ValidationErrorIssue {
  path?: Array<string | number>;
  message?: string;
  code?: string;
  received?: string;
  expected?: string;
}

export interface ValidationErrorResponse extends ApiError {
  requestId?: string;
  details?: ValidationErrorIssue[];
  fields?: Record<string, string[]>;
  messages?: string[];
  missingFields?: string[];
}

export class ApiNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiNetworkError';
  }
}

export class ApiValidationError extends Error {
  constructor(message: string, public details?: ValidationErrorResponse) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

export class ApiConflictError extends Error {
  constructor(message: string, public serverVersion: number) {
    super(message);
    this.name = 'ApiConflictError';
  }
}

function isJsonLike(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractHtmlErrorMessage(html: string): string | null {
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  const h1Match = /<h1[^>]*>([^<]*)<\/h1>/i.exec(html);
  const title = titleMatch?.[1]?.trim();
  const h1 = h1Match?.[1]?.trim();
  const text = stripHtmlTags(html);
  const candidate = title || h1 || text;
  if (!candidate) return null;
  return candidate.length > 200 ? candidate.substring(0, 200) + '...' : candidate;
}

function formatValidationErrorForUser(data: ValidationErrorResponse): string | null {
  if (!data || typeof data !== 'object') return null;

  if (Array.isArray(data.missingFields) && data.missingFields.length > 0) {
    return `Отсутствуют обязательные поля: ${data.missingFields.join(', ')}`;
  }

  if (data.fields && typeof data.fields === 'object') {
    const parts = Object.entries(data.fields)
      .filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`);
    if (parts.length > 0) {
      return `Ошибка валидации: ${parts.join('; ')}`;
    }
  }

  if (Array.isArray(data.messages) && data.messages.length > 0) {
    return `Ошибка валидации: ${data.messages.join('; ')}`;
  }

  if (Array.isArray(data.details) && data.details.length > 0) {
    const parts = data.details.map((issue) => {
      const path = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.map(String).join('.') : '_root';
      const msg = issue.message || 'Ошибка валидации';
      return `${path}: ${msg}`;
    });
    return `Ошибка валидации: ${parts.join('; ')}`;
  }

  return null;
}

function getApiUrl(): string {
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : '';

  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0';

  const isDev = import.meta.env.DEV;

  if (isLocalhost || isDev) {
    const localUrl =
      import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:3000';
    console.log('🏠 Local dev detected, using:', localUrl);
    return localUrl;
  }

  const prodUrl =
    import.meta.env.VITE_API_URL || 'https://lego-bot-core.vercel.app';
  console.log('🌐 Production mode, using:', prodUrl);
  return prodUrl;
}

// Получить user_id из Telegram WebApp
function getUserId(): number | null {
  // Проверяем, что мы в Telegram WebApp
  if (!window.Telegram?.WebApp) {
    return null;
  }
  
  const initData = window.Telegram.WebApp.initDataUnsafe;
  return initData?.user?.id || null;
}

function getInitData(): string | null {
  return window.Telegram?.WebApp?.initData || null;
}

// Проверка, что приложение запущено в Telegram
export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp;
}

async function apiRequestWithRetry<T>(
  endpoint: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiRequest<T>(endpoint, options);
    } catch (error) {
      lastError = error as Error;
      if (error instanceof ApiNetworkError && attempt < maxRetries - 1) {
        await delay(Math.pow(2, attempt) * 1000); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw lastError!;
}

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const userId = getUserId();
  const initData = getInitData();
  
  if (!userId) {
    console.error('❌ User ID not found');
    throw new Error('User ID not found. Make sure you are running in Telegram WebApp.');
  }
  if (!initData) {
    console.error('❌ Telegram initData not found');
    throw new Error('Telegram initData not found. Make sure you are running in Telegram WebApp.');
  }

  const apiUrl = getApiUrl();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const url = `${apiUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}user_id=${userId}`;
  
  console.log('📡 API Request:', {
    timestamp: new Date().toISOString(),
    method: options?.method || 'GET',
    url,
    userId,
    apiUrl,
    hostname,
    isLocalhost: hostname === 'localhost',
  });

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData,
        ...options?.headers,
      },
    });

    console.log('📥 API Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    console.log('📥 Response:', {
      url: response.url,
      status: response.status,
      type: response.type,
      redirected: response.redirected,
      contentType: response.headers.get('content-type'),
    });

    if (!response.ok) {
      let errorData: ApiError | ValidationErrorResponse;
      let responseText = '';
      const contentType = response.headers.get('content-type') || '';
      try {
        responseText = await response.text();

        if (
          (contentType.includes('application/json') || contentType.includes('+json') || isJsonLike(responseText))
          && responseText.trim().length > 0
        ) {
          errorData = JSON.parse(responseText);
        } else {
          const htmlMessage = extractHtmlErrorMessage(responseText);
          errorData = {
            error: htmlMessage || responseText || `HTTP ${response.status}: ${response.statusText}`,
          };
        }
      } catch {
        const htmlMessage = extractHtmlErrorMessage(responseText);
        errorData = {
          error: htmlMessage || responseText || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const redactTextForLog = (s: string) =>
        s.replace(/("?(?:password|token|secret)"?\s*:\s*)"[^"]*"/gi, '$1"***"');
      const redactObjectForLog = (obj: any) => {
        if (!obj || typeof obj !== 'object') return obj;
        const out = Array.isArray(obj) ? [...obj] : { ...obj };
        for (const key of Object.keys(out)) {
          if (/(password|token|secret)/i.test(key)) out[key] = '***';
        }
        return out;
      };

      const responseTextForLog = redactTextForLog(responseText).substring(0, 500);
      const errorDataForLog = redactObjectForLog(errorData);

      console.error('❌ API Error:', {
        timestamp: new Date().toISOString(),
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        errorData: errorDataForLog,
        responseText: responseTextForLog,
      });

      let message = errorData.error || errorData.message || `API request failed: ${response.status} ${response.statusText}`;
      if (response.status === 400) {
        const validationMessage = formatValidationErrorForUser(errorData as ValidationErrorResponse);
        if (validationMessage) {
          message = validationMessage;
        } else if (typeof responseText === 'string' && responseText.trim().startsWith('<')) {
          message = 'Ошибка формата данных';
        }
      }

      if (response.status === 400) {
        const requestError = new ApiValidationError(message, errorData as ValidationErrorResponse);
        (requestError as any).status = response.status;
        (requestError as any).data = errorData;
        throw requestError;
      }

      const requestError = new Error(message);
      (requestError as any).status = response.status;
      (requestError as any).data = errorData;
      throw requestError;
    }

    const data = await response.json();
    console.log('✅ API Success:', data);
    return data;
  } catch (error) {
    console.error('❌ Request failed:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      status: (error as any).status,
      apiUrl,
      endpoint,
      url,
    });

    if (error instanceof ApiNetworkError) {
      throw error;
    }

    if (error instanceof TypeError) {
      const msg = error.message || '';
      if (/failed to fetch|networkerror|load failed|fetch/i.test(msg)) {
        throw new ApiNetworkError('Проблема с сетью. Проверьте подключение / попробуйте позже.');
      }
      throw new ApiNetworkError('Проблема сети. Проверьте подключение / попробуйте позже.');
    }

    throw error;
  }
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiConflictError) {
    return error.message || 'Конфликт версий. Обновите страницу.';
  }

  if (error instanceof ApiNetworkError) {
    return error.message || 'Проблема с сетью. Проверьте подключение.';
  }

  if (error instanceof ApiValidationError) {
    return error.message || 'Ошибка валидации данных';
  }

  const status = (error as any).status;
  const data = (error as any).data as ValidationErrorResponse | ApiError | undefined;

  if (status === 400) {
    const validationMessage = data ? formatValidationErrorForUser(data as ValidationErrorResponse) : null;
    if (validationMessage) {
      return validationMessage;
    }
    if (typeof data?.error === 'string' && /invalid json/i.test(data.error)) {
      return 'Ошибка формата данных';
    }
    return 'Ошибка валидации (400). Проверьте введенные данные.';
  }
  if (status === 500) {
    return 'Ошибка сервера (500). Возможно, база данных недоступна или неверная конфигурация.';
  }
  if (status === 503) {
    return 'Сервис временно недоступен (503). Попробуйте позже.';
  }
  if (status === 401 || status === 403) {
    return 'Ошибка авторизации. Убедитесь, что приложение запущено в Telegram.';
  }
  if (status === 404) {
    return 'Ресурс не найден (404).';
  }
  if (status === 409) {
    return 'Конфликт версий (409). Обновите страницу для получения последней версии.';
  }

  if ((error as any)?.name === 'AbortError' || /timeout/i.test((error as any)?.message || '')) {
    return 'Превышено время ожидания. Попробуйте позже.';
  }

  if (error instanceof SyntaxError) {
    return 'Ошибка формата данных';
  }

  if (error instanceof TypeError) {
    const msg = error.message || '';
    if (/failed to fetch|networkerror|load failed|fetch/i.test(msg)) {
      return 'Проблема сети или CORS. Проверьте подключение / попробуйте позже.';
    }
    return 'Проблема сети. Проверьте подключение / попробуйте позже.';
  }

  if (error instanceof Error) {
    const msg = error.message || '';
    if (/unexpected token|json/i.test(msg)) {
      return 'Ошибка формата данных';
    }
    return error.message;
  }

  return 'Неизвестная ошибка. Проверьте подключение к интернету.';
}

export const api = {
  // Получить список ботов
  getBots: (params?: { limit?: number; offset?: number }): Promise<{ bots: BotSummary[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }> => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) {
      query.set('limit', String(params.limit));
    }
    if (params?.offset !== undefined) {
      query.set('offset', String(params.offset));
    }

    const suffix = query.toString();
    const endpoint = suffix ? `/api/bots?${suffix}` : '/api/bots';
    return apiRequest<{ bots: BotSummary[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }>(endpoint);
  },

  // Получить схему бота
  getBotSchema: (botId: string): Promise<{ schema: BotSchema; schema_version: number; name?: string }> => {
    return apiRequest(`/api/bot/${botId}/schema`);
  },

  // Обновить схему бота
  updateBotSchema: async (botId: string, schema: BotSchema, options?: { force?: boolean }): Promise<{ success: boolean; message: string; schema_version: number }> => {
    const endpoint = options?.force ? `/api/bot/${botId}/schema?force=true` : `/api/bot/${botId}/schema`;
    try {
      return await apiRequestWithRetry(endpoint, {
        method: 'POST',
        body: JSON.stringify(schema),
      });
    } catch (error) {
      const status = (error as any)?.status;

      if (status === 409) {
        // Conflict: server has newer version
        const serverData = (error as any)?.data;
        throw new ApiConflictError(
          'Схема была изменена на сервере. Обновите страницу для получения последней версии.',
          serverData?.schema_version ?? 0
        );
      }

      throw error;
    }
  },

  getBotProject: async (botId: string, botName: string): Promise<BotProject> => {
    const { schema } = await api.getBotSchema(botId);
    return schemaToProject(botId, botName, schema);
  },

  updateBotProject: async (project: BotProject): Promise<{ success: boolean; message: string; schema_version: number }> => {
    const schema = projectToSchema(project);
    return api.updateBotSchema(project.id, schema);
  },

  createBot: async (
    name: string,
    schema?: BotSchema,
    tokenOverride?: string
  ): Promise<{ id: string; name: string; webhook_set: boolean; schema_version: number; created_at: string }> => {
    const userId = getUserId();
    const token = tokenOverride || generatePlaceholderToken(userId);
    try {
      const bot = await apiRequest<{ id: string; name: string; webhook_set: boolean; schema_version: number; created_at: string }>(
        '/api/bots',
        {
          method: 'POST',
          body: JSON.stringify({ name, token }),
        }
      );

      if (schema) {
        await api.updateBotSchema(bot.id, schema);
      }

      return bot;
    } catch (error) {
      const status = (error as any)?.status;
      const data = (error as any)?.data as ValidationErrorResponse | ApiError | undefined;

      let message = 'Не удалось создать бота. Попробуйте позже.';
      if (status === 400) {
        const validationMessage = data ? formatValidationErrorForUser(data as ValidationErrorResponse) : null;
        message = validationMessage || 'Невалидные данные. Проверьте имя и токен бота.';
      } else if (status === 409) {
        message = 'Токен бота уже существует.';
      } else if (status === 429) {
        message = 'Достигнут лимит ботов. Удалите один из ботов и попробуйте снова.';
      } else if (status === 503) {
        message = 'Сервис временно недоступен. Попробуйте позже.';
      }

      const wrapped = new Error(message);
      (wrapped as any).status = status;
      (wrapped as any).data = data;
      throw wrapped;
    }
  },

  getBotUsers: async (
    botId: string,
    params?: { limit?: number; cursor?: string }
  ): Promise<{ users: BotUser[]; nextCursor: string | null; hasMore: boolean }> => {
    try {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) {
        query.set('limit', String(params.limit));
      }
      if (params?.cursor) {
        query.set('cursor', params.cursor);
      }
      const suffix = query.toString();
      const endpoint = suffix ? `/api/bot/${botId}/users?${suffix}` : `/api/bot/${botId}/users`;
      return await apiRequest<{ users: BotUser[]; nextCursor: string | null; hasMore: boolean }>(endpoint);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить контакты';
      window.Telegram?.WebApp?.showAlert?.(message);
      throw error;
    }
  },

  getBotUserStats: async (
    botId: string
  ): Promise<{ total: number; newLast7Days: number; conversionRate: number }> => {
    try {
      return await apiRequest<{ total: number; newLast7Days: number; conversionRate: number }>(
        `/api/bot/${botId}/users/stats`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить статистику';
      window.Telegram?.WebApp?.showAlert?.(message);
      throw error;
    }
  },

  getWebhookLogs: async (
    botId: string,
    params?: { limit?: number; cursor?: string }
  ): Promise<{ logs: any[]; nextCursor: string | null; hasMore: boolean }> => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) {
      query.set('limit', String(params.limit));
    }
    if (params?.cursor) {
      query.set('cursor', params.cursor);
    }
    const suffix = query.toString();
    const endpoint = suffix
      ? `/api/bot/${botId}/webhooks?${suffix}`
      : `/api/bot/${botId}/webhooks`;
    return apiRequest<{ logs: any[]; nextCursor: string | null; hasMore: boolean }>(endpoint);
  },

  getWebhookStats: async (
    botId: string
  ): Promise<{ total: number; successRate: number; states: any[] }> => {
    return apiRequest<{ total: number; successRate: number; states: any[] }>(
      `/api/bot/${botId}/webhooks/stats`
    );
  },

  testWebhook: async (
    botId: string,
    stateKey: string
  ): Promise<{ success: boolean; status: number; response: any }> => {
    return apiRequest<{ success: boolean; status: number; response: any }>(
      `/api/bot/${botId}/test-webhook`,
      {
        method: 'POST',
        body: JSON.stringify({ stateKey }),
      }
    );
  },

  getAnalyticsEvents: async (
    botId: string,
    params?: { limit?: number; cursor?: string; eventType?: string; dateFrom?: string; dateTo?: string }
  ): Promise<{ events: AnalyticsEvent[]; nextCursor: string | null; hasMore: boolean }> => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) {
      query.set('limit', String(params.limit));
    }
    if (params?.cursor) {
      query.set('cursor', params.cursor);
    }
    if (params?.eventType) {
      query.set('event_type', params.eventType);
    }
    if (params?.dateFrom) {
      query.set('date_from', params.dateFrom);
    }
    if (params?.dateTo) {
      query.set('date_to', params.dateTo);
    }
    const suffix = query.toString();
    const endpoint = suffix
      ? `/api/bot/${botId}/analytics/events?${suffix}`
      : `/api/bot/${botId}/analytics/events`;
    return apiRequest<{ events: AnalyticsEvent[]; nextCursor: string | null; hasMore: boolean }>(endpoint);
  },

  getAnalyticsStats: async (
    botId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<AnalyticsStats> => {
    const query = new URLSearchParams();
    if (dateFrom) {
      query.set('date_from', dateFrom);
    }
    if (dateTo) {
      query.set('date_to', dateTo);
    }
    const suffix = query.toString();
    const endpoint = suffix
      ? `/api/bot/${botId}/analytics/stats?${suffix}`
      : `/api/bot/${botId}/analytics/stats`;
    return apiRequest<AnalyticsStats>(endpoint);
  },

  getPopularPaths: async (
    botId: string,
    limit?: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<{ paths: PopularPath[] }> => {
    const query = new URLSearchParams();
    if (limit !== undefined) {
      query.set('limit', String(limit));
    }
    if (dateFrom) {
      query.set('date_from', dateFrom);
    }
    if (dateTo) {
      query.set('date_to', dateTo);
    }
    const suffix = query.toString();
    const endpoint = suffix
      ? `/api/bot/${botId}/analytics/paths?${suffix}`
      : `/api/bot/${botId}/analytics/paths`;
    return apiRequest<{ paths: PopularPath[] }>(endpoint);
  },

  getFunnelData: async (
    botId: string,
    states: string[],
    dateFrom?: string,
    dateTo?: string
  ): Promise<{ steps: FunnelStep[] }> => {
    const query = new URLSearchParams();
    query.set('states', states.join(','));
    if (dateFrom) {
      query.set('date_from', dateFrom);
    }
    if (dateTo) {
      query.set('date_to', dateTo);
    }
    return apiRequest<{ steps: FunnelStep[] }>(
      `/api/bot/${botId}/analytics/funnel?${query.toString()}`
    );
  },

  getTimeSeriesData: async (
    botId: string,
    eventType: string,
    dateFrom?: string,
    dateTo?: string,
    granularity?: string
  ): Promise<{ data: TimeSeriesData[] }> => {
    const query = new URLSearchParams();
    query.set('event_type', eventType);
    if (dateFrom) {
      query.set('date_from', dateFrom);
    }
    if (dateTo) {
      query.set('date_to', dateTo);
    }
    if (granularity) {
      query.set('granularity', granularity);
    }
    return apiRequest<{ data: TimeSeriesData[] }>(
      `/api/bot/${botId}/analytics/timeseries?${query.toString()}`
    );
  },

  createBroadcast: async (botId: string, data: CreateBroadcastData): Promise<Broadcast> => {
    return apiRequest<Broadcast>(`/api/bot/${botId}/broadcasts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getBroadcasts: async (
    botId: string,
    params?: { limit?: number; cursor?: string }
  ): Promise<{ broadcasts: Broadcast[]; nextCursor: string | null; hasMore: boolean }> => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) {
      query.set('limit', String(params.limit));
    }
    if (params?.cursor) {
      query.set('cursor', params.cursor);
    }
    const suffix = query.toString();
    const endpoint = suffix
      ? `/api/bot/${botId}/broadcasts?${suffix}`
      : `/api/bot/${botId}/broadcasts`;
    return apiRequest<{ broadcasts: Broadcast[]; nextCursor: string | null; hasMore: boolean }>(endpoint);
  },

  getBroadcastDetails: async (
    botId: string,
    broadcastId: string
  ): Promise<Broadcast & { stats: BroadcastStats }> => {
    return apiRequest<Broadcast & { stats: BroadcastStats }>(
      `/api/bot/${botId}/broadcasts/${broadcastId}`
    );
  },

  startBroadcast: async (
    botId: string,
    broadcastId: string
  ): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(
      `/api/bot/${botId}/broadcasts/${broadcastId}/start`,
      { method: 'POST' }
    );
  },

  cancelBroadcast: async (
    botId: string,
    broadcastId: string
  ): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(
      `/api/bot/${botId}/broadcasts/${broadcastId}/cancel`,
      { method: 'POST' }
    );
  },

  exportAnalytics: async (botId: string, dateFrom?: string, dateTo?: string): Promise<Blob> => {
    const userId = getUserId();
    const initData = getInitData();
    if (!userId) {
      throw new Error('User ID not found. Make sure you are running in Telegram WebApp.');
    }
    if (!initData) {
      throw new Error('Telegram initData not found. Make sure you are running in Telegram WebApp.');
    }

    const apiUrl = getApiUrl();
    const query = new URLSearchParams();
    query.set('user_id', String(userId));
    if (dateFrom) {
      query.set('date_from', dateFrom);
    }
    if (dateTo) {
      query.set('date_to', dateTo);
    }
    const url = `${apiUrl}/api/bot/${botId}/analytics/export?${query.toString()}`;
    try {
      const response = await fetch(url, {
        headers: {
          'X-Telegram-Init-Data': initData,
        },
      });

      if (!response.ok) {
        let errorData: ApiError | null = null;
        try {
          errorData = await response.json();
        } catch {
          errorData = null;
        }
        const message =
          errorData?.error ||
          errorData?.message ||
          `API request failed: ${response.status} ${response.statusText}`;
        throw new Error(message);
      }

      return await response.blob();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось экспортировать отчёт';
      window.Telegram?.WebApp?.showAlert?.(message);
      throw error;
    }
  },

  exportBotUsers: async (botId: string): Promise<Blob> => {
    const userId = getUserId();
    const initData = getInitData();
    if (!userId) {
      throw new Error('User ID not found. Make sure you are running in Telegram WebApp.');
    }
    if (!initData) {
      throw new Error('Telegram initData not found. Make sure you are running in Telegram WebApp.');
    }

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/api/bot/${botId}/users/export?user_id=${userId}`;
    try {
      const response = await fetch(url, {
        headers: {
          'X-Telegram-Init-Data': initData,
        },
      });

      if (!response.ok) {
        let errorData: ApiError | null = null;
        try {
          errorData = await response.json();
        } catch {
          errorData = null;
        }
        const message =
          errorData?.error ||
          errorData?.message ||
          `API request failed: ${response.status} ${response.statusText}`;
        throw new Error(message);
      }

      return await response.blob();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось экспортировать контакты';
      window.Telegram?.WebApp?.showAlert?.(message);
      throw error;
    }
  },

  getAdminStats: (): Promise<AdminStats> => {
    return apiRequest<AdminStats>('/api/admin/stats');
  },

  getAdminPromoCodes: (): Promise<{ items: PromoCode[] }> => {
    return apiRequest<{ items: PromoCode[] }>('/api/admin/promo-codes');
  },

  createAdminPromoCode: (payload: {
    code?: string;
    durationDays: number;
    maxRedemptions?: number;
    expiresAt?: string;
  }): Promise<PromoCode> => {
    return apiRequest<PromoCode>('/api/admin/promo-codes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMaintenanceStatus: (): Promise<MaintenanceState> => {
    return apiRequest<MaintenanceState>('/api/maintenance');
  },

  getAdminMaintenanceStatus: (): Promise<MaintenanceState> => {
    return apiRequest<MaintenanceState>('/api/admin/maintenance');
  },

  updateMaintenanceStatus: (payload: { enabled: boolean; message?: string | null }): Promise<MaintenanceState> => {
    return apiRequest<MaintenanceState>('/api/admin/maintenance', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

function generatePlaceholderToken(userId: number | null): string {
  const prefix = userId && Number.isFinite(userId) ? String(userId) : String(Date.now());
  return `${prefix}:${generateTokenSuffix(35)}`;
}

function generateTokenSuffix(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const values = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < length; i += 1) {
      values[i] = Math.floor(Math.random() * 256);
    }
  }

  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += alphabet[values[i] % alphabet.length];
  }
  return result;
}
