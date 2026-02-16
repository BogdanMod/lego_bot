/**
 * Utility functions for opening Owner Web (owner-web) via botlink authentication
 * All transitions from Mini App to Owner Web must use botlink tokens for seamless auth
 * 
 * Features:
 * - Toast notifications instead of alert()
 * - Loading states
 * - Token caching (30-60 seconds)
 * - Retry logic with exponential backoff
 * - Request timeouts (5 seconds)
 * - Telegram API availability check
 * - Graceful degradation with fallback options
 * - Metrics and analytics
 */

import { toast } from 'sonner';

// Types
export type BotlinkGenerateResponse = 
  | { ok: true; url: string; token: string; redirect: string }
  | { ok: false; code: string; message: string };

export type BotlinkMetrics = {
  success: number;
  failures: number;
  retries: number;
  cacheHits: number;
  avgGenerationTime: number;
};

// Cache for botlink tokens (key: targetPath, value: { url, expiresAt })
const botlinkCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 45 * 1000; // 45 seconds

// Metrics
const metrics: BotlinkMetrics = {
  success: 0,
  failures: 0,
  retries: 0,
  cacheHits: 0,
  avgGenerationTime: 0,
};

// Allowed next paths for security (whitelist)
const ALLOWED_NEXT_PATHS = [
  '/cabinet',
  '/cabinet/create',
  /^\/cabinet\/[a-z0-9-]+\/(overview|settings|inbox|calendar|orders|leads|customers|team|audit)$/,
];

/**
 * Get Core API base URL
 */
function getCoreApiUrl(): string {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0';
  const isDev = import.meta.env.DEV;

  if (isLocalhost || isDev) {
    return import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:3000';
  }

  return import.meta.env.VITE_API_URL || 'https://core-production.up.railway.app';
}

/**
 * Normalize base URL (remove trailing slash)
 */
function normalizeBase(base: string): string {
  return base.replace(/\/+$/, '');
}

/**
 * Normalize path (ensure it starts with /)
 */
function normalizePath(path: string): string {
  return '/' + path.replace(/^\/+/, '');
}

/**
 * Build API URL with proper normalization
 */
function buildApiUrl(path: string): string {
  const base = getCoreApiUrl();
  const normalizedBase = normalizeBase(base);
  const normalizedPath = normalizePath(path);
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Get Telegram initData from WebApp
 */
function getInitData(): string | null {
  if (typeof window === 'undefined') return null;
  return (window as any).Telegram?.WebApp?.initData || null;
}

/**
 * Check if Telegram WebApp API is available and version is sufficient
 */
function canUseTelegramLink(): boolean {
  if (typeof window === 'undefined') return false;
  const webApp = (window as any).Telegram?.WebApp;
  if (!webApp?.openLink) return false;
  
  // Check version if available (6.0+ recommended)
  const version = webApp.version;
  if (version) {
    const major = parseInt(version.split('.')[0], 10);
    return major >= 6;
  }
  
  // If version is not available, assume it's available if openLink exists
  return true;
}

/**
 * Validate next path against whitelist
 */
function validateNextPath(path: string): boolean {
  // Basic validation: must be relative, start with /, no protocol
  if (!path.startsWith('/') || path.includes('://') || path.startsWith('//')) {
    return false;
  }

  // Check against whitelist
  return ALLOWED_NEXT_PATHS.some((pattern) => {
    if (typeof pattern === 'string') {
      return path === pattern;
    }
    if (pattern instanceof RegExp) {
      return pattern.test(path);
    }
    return false;
  });
}

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 2,
  timeoutMs: number = 5000
): Promise<Response> {
  let lastError: Error | null = null;
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok || retries === maxRetries) {
        if (retries > 0) {
          metrics.retries += retries;
        }
        return response;
      }

      // Retry on 5xx errors or network errors
      if (response.status >= 500 || response.status === 429) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Don't retry on 4xx errors (except 429)
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (retries < maxRetries) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        const delayMs = 500 * Math.pow(2, retries);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        retries++;
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Generate botlink token from Core API
 */
async function generateBotlinkToken(
  targetPath: string,
  initData: string
): Promise<BotlinkGenerateResponse> {
  const startTime = Date.now();
  const generateUrl = buildApiUrl(`/api/owner/auth/botlink/generate?next=${encodeURIComponent(targetPath)}`);

  try {
    const response = await fetchWithRetry(
      generateUrl,
      {
        method: 'GET',
        headers: {
          'X-Telegram-Init-Data': initData,
          'Content-Type': 'application/json',
        },
      },
      2, // maxRetries
      5000 // timeoutMs
    );

    const generationTime = Date.now() - startTime;
    metrics.avgGenerationTime = (metrics.avgGenerationTime * metrics.success + generationTime) / (metrics.success + 1);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      metrics.failures++;
      
      return {
        ok: false,
        code: errorData?.code || `http_${response.status}`,
        message: errorData?.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    metrics.success++;

    if (!data.ok || !data.url) {
      metrics.failures++;
      return {
        ok: false,
        code: 'invalid_response',
        message: 'Invalid botlink response from server',
      };
    }

    return {
      ok: true,
      url: data.url,
      token: data.token || '',
      redirect: data.redirect || targetPath,
    };
  } catch (error) {
    metrics.failures++;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log error for debugging
    console.error('[OwnerWeb] Botlink generation error:', {
      error: errorMessage,
      targetPath,
      url: generateUrl,
    });

    return {
      ok: false,
      code: errorMessage.includes('aborted') ? 'timeout' : 'network_error',
      message: errorMessage.includes('aborted') 
        ? 'Request timeout. Please check your connection.'
        : 'Network error. Please try again.',
    };
  }
}

/**
 * Open URL using Telegram WebApp API or fallback
 */
function openUrl(url: string): void {
  if (canUseTelegramLink()) {
    try {
      (window as any).Telegram.WebApp.openLink(url);
      return;
    } catch (error) {
      console.warn('[OwnerWeb] Telegram.openLink failed, using fallback:', error);
    }
  }

  // Fallback to window.open
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!newWindow) {
    // Popup blocked - show fallback options
    toast.error('Не удалось открыть кабинет', {
      description: 'Браузер заблокировал всплывающее окно. Скопируйте ссылку вручную.',
      action: {
        label: 'Скопировать ссылку',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(url);
            toast.success('Ссылка скопирована в буфер обмена');
          } catch {
            toast.error('Не удалось скопировать ссылку');
          }
        },
      },
      duration: 10000,
    });
  }
}

/**
 * Open Owner Web via botlink authentication
 * 
 * This function:
 * 1. Checks cache for existing valid token
 * 2. Gets a botlink token from Core API using Telegram initData
 * 3. Caches the token for 45 seconds
 * 4. Opens Owner Web with the botlink URL
 * 5. Handles errors with toast notifications
 * 
 * @param targetPath - Path in owner-web (e.g., '/cabinet', '/cabinet/botId/settings')
 * @param showLoading - Show loading toast (default: true)
 * @throws Error if botlink generation fails after retries
 */
export async function openOwnerWebViaBotlink(
  targetPath: string,
  showLoading: boolean = true
): Promise<void> {
  // Normalize target path
  const normalizedPath = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  
  // Validate path: must be relative, not contain protocol
  if (normalizedPath.includes('://') || normalizedPath.startsWith('//')) {
    const errorMsg = 'Invalid target path: must be relative';
    console.error('[OwnerWeb]', errorMsg, normalizedPath);
    toast.error('Ошибка', { description: 'Некорректный путь для перехода' });
    throw new Error(errorMsg);
  }

  // Validate against whitelist
  if (!validateNextPath(normalizedPath)) {
    const errorMsg = `Path "${normalizedPath}" is not allowed`;
    console.warn('[OwnerWeb] Path validation failed:', normalizedPath);
    toast.error('Ошибка', { description: 'Некорректный путь для перехода' });
    throw new Error(errorMsg);
  }

  // Get Telegram initData
  const initData = getInitData();
  if (!initData) {
    const errorMsg = 'Telegram initData not found. Make sure you are running in Telegram WebApp.';
    console.error('[OwnerWeb]', errorMsg);
    toast.error('Ошибка авторизации', {
      description: 'Не удалось получить данные Telegram. Откройте мини-приложение из Telegram.',
    });
    throw new Error(errorMsg);
  }

  // Check cache
  const cacheKey = normalizedPath;
  const cached = botlinkCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    metrics.cacheHits++;
    if (import.meta.env.DEV) {
      console.debug('[OwnerWeb] Using cached botlink:', { targetPath: normalizedPath });
    }
    openUrl(cached.url);
    return;
  }

  // Show loading toast
  const loadingToast = showLoading
    ? toast.loading('Подготовка ссылки для входа в кабинет...', { id: 'botlink-loading' })
    : null;

  try {
    // Generate botlink token
    const result = await generateBotlinkToken(normalizedPath, initData);

    // Dismiss loading toast
    if (loadingToast) {
      toast.dismiss('botlink-loading');
    }

    if (!result.ok) {
      // Handle specific error codes
      let errorMessage = 'Не удалось открыть кабинет';
      let errorDescription = result.message;

      if (result.code === 'unauthorized' || result.code === 'invalid_initdata') {
        errorMessage = 'Ошибка авторизации';
        errorDescription = 'Проверьте, что вы открыли мини-приложение из Telegram.';
      } else if (result.code === 'misconfigured') {
        errorMessage = 'Ошибка конфигурации';
        errorDescription = 'Проверьте доступность Core и переменные окружения.';
      } else if (result.code === 'timeout') {
        errorMessage = 'Превышено время ожидания';
        errorDescription = 'Проверьте подключение к интернету и попробуйте снова.';
      } else if (result.code === 'network_error') {
        errorMessage = 'Ошибка сети';
        errorDescription = 'Проверьте подключение к интернету.';
      }

      toast.error(errorMessage, {
        description: errorDescription,
        duration: 5000,
      });

      throw new Error(result.message);
    }

    // Cache the token
    botlinkCache.set(cacheKey, {
      url: result.url,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    // Clean up old cache entries (keep only last 10)
    if (botlinkCache.size > 10) {
      const entries = Array.from(botlinkCache.entries());
      entries.sort((a, b) => b[1].expiresAt - a[1].expiresAt);
      botlinkCache.clear();
      entries.slice(0, 10).forEach(([key, value]) => {
        botlinkCache.set(key, value);
      });
    }

    // Debug log (dev only)
    if (import.meta.env.DEV) {
      console.debug('[OwnerWeb] Botlink generated:', {
        targetPath: normalizedPath,
        redirect: result.redirect,
        urlLength: result.url.length,
        cached: false,
      });
    }

    // Open Owner Web
    openUrl(result.url);

    // Show success toast (brief)
    toast.success('Кабинет открывается...', { duration: 2000 });
  } catch (error) {
    // Dismiss loading toast
    if (loadingToast) {
      toast.dismiss('botlink-loading');
    }

    // Error already handled in generateBotlinkToken or openUrl
    if (error instanceof Error && (error.message.includes('Invalid') || error.message.includes('not found'))) {
      // Already shown toast, just re-throw
      throw error;
    }

    // Unexpected error
    console.error('[OwnerWeb] Unexpected error:', error);
    toast.error('Не удалось открыть кабинет', {
      description: 'Произошла неожиданная ошибка. Попробуйте позже.',
      duration: 5000,
    });
    throw error;
  }
}

/**
 * Open Owner Web cabinet for a specific bot
 * @param botId - Bot ID
 * @param section - Section to open (default: 'settings')
 * @param showLoading - Show loading toast (default: true)
 */
export async function openBotInOwnerWeb(
  botId: string,
  section: string = 'settings',
  showLoading: boolean = true
): Promise<void> {
  await openOwnerWebViaBotlink(`/cabinet/${botId}/${section}`, showLoading);
}

/**
 * Open Owner Web cabinet home (list of bots)
 * @param showLoading - Show loading toast (default: true)
 */
export async function openOwnerWebCabinet(showLoading: boolean = true): Promise<void> {
  await openOwnerWebViaBotlink('/cabinet', showLoading);
}

/**
 * Open Owner Web for creating a new bot
 * @param showLoading - Show loading toast (default: true)
 */
export async function openOwnerWebCreateBot(showLoading: boolean = true): Promise<void> {
  // Try /cabinet/create first, fallback to /cabinet
  try {
    await openOwnerWebViaBotlink('/cabinet/create', showLoading);
  } catch {
    // Fallback to /cabinet if /cabinet/create doesn't exist
    await openOwnerWebViaBotlink('/cabinet', showLoading);
  }
}

/**
 * Get botlink metrics
 */
export function getBotlinkMetrics(): BotlinkMetrics {
  return { ...metrics };
}

/**
 * Clear botlink cache
 */
export function clearBotlinkCache(): void {
  botlinkCache.clear();
}
