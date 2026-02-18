'use client';

import { useEffect } from 'react';

export function SentryInit() {
  useEffect(() => {
    // Only initialize Sentry on client side
    if (typeof window === 'undefined') return;
    
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;

    // Dynamic import with error handling - Sentry is optional
    // Use a more robust approach that doesn't fail at build time
    const initSentry = async () => {
      try {
        // Use dynamic import with a fallback
        // @ts-ignore - @sentry/nextjs is optional dependency
        const SentryModule = await import('@sentry/nextjs').catch(() => null);
        if (!SentryModule) {
          // Sentry package not installed, skip initialization
          return;
        }

        const Sentry = SentryModule.default || SentryModule;
        if (Sentry && typeof Sentry.init === 'function') {
          Sentry.init({
            dsn,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
            beforeSend(event: any, hint: any) {
              // Безопасность: не отправляем чувствительные данные
              if (event.request) {
                delete event.request.cookies;
                if (event.request.headers) {
                  delete event.request.headers.authorization;
                  delete event.request.headers.cookie;
                }
              }
              return event;
            },
          });
        }
      } catch (error) {
        // Sentry не критичен, игнорируем ошибки загрузки
        console.debug('Sentry initialization skipped:', error);
      }
    };

    initSentry();
  }, []);

  return null;
}

