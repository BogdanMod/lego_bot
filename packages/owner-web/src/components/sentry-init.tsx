'use client';

import { useEffect } from 'react';

export function SentryInit() {
  useEffect(() => {
    // Only initialize Sentry on client side
    if (typeof window === 'undefined') return;
    
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;

    // Dynamic import to avoid SSR issues
    // @ts-ignore - @sentry/nextjs is optional dependency
    import('@sentry/nextjs')
      .then((Sentry: any) => {
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
      })
      .catch(() => {
        // Sentry не критичен, игнорируем ошибки загрузки
      });
  }, []);

  return null;
}

