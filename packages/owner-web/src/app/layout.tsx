import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { ThemeScript } from '@/components/theme-script';
import { SentryInit } from '@/components/sentry-init';

// v2: Observability - Sentry initialization moved to client component

export const metadata: Metadata = {
  title: 'Zer | Con',
  description: 'Zero Context System — панель для Telegram-ботов',
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
        <SentryInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

