import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { ThemeScript } from '@/components/theme-script';

// v2: Observability - Sentry initialization (optional)
if (process.env.NEXT_PUBLIC_SENTRY_DSN && typeof window !== 'undefined') {
  // @ts-ignore - @sentry/nextjs is optional dependency
  import('@sentry/nextjs').then((Sentry: any) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
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
  }).catch(() => {
    // Sentry не критичен, игнорируем ошибки загрузки
  });
}

export const metadata: Metadata = {
  title: 'Owner Cabinet',
  description: 'Owner Cabinet for Telegram bots',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="Permissions-Policy" content="geolocation=(), microphone=(), camera=()" />
      </head>
      <body>
        <ThemeScript />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

