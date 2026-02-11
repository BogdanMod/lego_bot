import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { ThemeScript } from '@/components/theme-script';

export const metadata: Metadata = {
  title: 'Owner Cabinet',
  description: 'Owner Cabinet for Telegram bots',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ThemeScript />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

